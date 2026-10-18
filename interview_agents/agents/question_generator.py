from __future__ import annotations

import hashlib
import json
import logging
import re
from itertools import cycle
from typing import Any, List

from interview_agents.agents.base import BaseInterviewAgent
from interview_agents.agents.interview_type_router import InterviewTypeRouter
from interview_agents.config.settings import get_settings
from interview_agents.evaluators.scoring import heuristic_evaluate_answer
from interview_agents.schemas.interview import QuestionGenerationResult
from interview_agents.services.web_search_service import WebSearchService, build_grounding_block
from interview_agents.utils.enums import DifficultyLevel, QuestionCategory
from interview_agents.utils.json_utils import safe_json_dumps
from interview_agents.utils.question_style import (
    _MEDIUM_VERBAL,
    depth_specific_rules,
    question_style_directive,
    requires_code_block,
)

logger = logging.getLogger(__name__)
settings = get_settings()
_web_search_service = WebSearchService(settings)

# Maximum fraction of questions that can be Behavioral regardless of source routing
_BEHAVIORAL_CAP_RATIO = 0.20

# Recruiter-grade question type rotation — Technical/Problem Solving/Scenario are
# primary; Behavioral is explicitly limited to ≤20% and must always be JD-tied.
_TECHNICAL_DOMINANT_PATTERN = [
    QuestionCategory.TECHNICAL.value,
    QuestionCategory.PROBLEM_SOLVING.value,
    QuestionCategory.TECHNICAL.value,
    QuestionCategory.PROBLEM_SOLVING.value,
    QuestionCategory.TECHNICAL.value,
    QuestionCategory.BEHAVIORAL.value,   # 1 in 6 = 16%
]


# ── HR adaptive-interview engine ────────────────────────────────────────────
# Turns the flat "question 1, 2, 3... N" HR flow into a recruiter-shaped arc.
# Everything here is pure Python over data the caller already has (turn index,
# total_questions, conversation_history, job_description, resume_text) - no new
# LLM call, no new DB/Redis query, no new agent. Stage bands are proportional
# (percentage of total_questions), not fixed question numbers, so a 5-question
# and a 20-question HR interview both get a recruiter-shaped arc scaled to
# their own length.
_HR_STAGE_BANDS: list[tuple[str, float]] = [
    # (stage, upper-bound % of interview completed)
    ("INTRODUCTION", 9.0),
    ("BACKGROUND", 18.0),
    ("RESUME_EXPLORATION", 30.0),
    ("PROJECT_DISCUSSION", 45.0),
    ("BEHAVIORAL", 58.0),
    ("COLLABORATION", 68.0),
    ("OWNERSHIP", 74.0),
    ("JD_ALIGNMENT", 88.0),
    ("COMPANY_FIT", 94.0),
    ("MOTIVATION", 98.0),
    ("CLOSING", 100.01),  # +.01 so turn == last index (100.0%) still matches
]

# Which existing SCENARIO_TYPES (hr_behavioral_agent.py) are appropriate for
# each stage. Reuses the existing scenario vocabulary/rotation math - this is
# a filter layered on top of DIFFICULTY_SCENARIO_MAP, not a replacement for it.
#
# Each list is deliberately padded with at least one type from every difficulty
# tier (Easy/Medium/Hard) that could plausibly reach this stage - DIFFICULTY_SCENARIO_MAP
# splits types unevenly across tiers (e.g. "closing"/"achievement"/"ethics" are
# Hard-only; "education_choice" is Easy-only), and since Node always schedules
# Hard-tier turns last, a late-arc stage (JD_ALIGNMENT/COMPANY_FIT/MOTIVATION) that
# only listed Easy/Medium types had ZERO overlap with the Hard tier - the filter
# then fell back to the entire unfiltered Hard list (which includes "closing"),
# letting a closing-shaped question leak into the middle of the interview. Verified
# via [HR_DECISION] logs on a 10-question run before this fix.
_HR_STAGE_SCENARIOS: dict[str, list[str]] = {
    "INTRODUCTION": ["introduction"],
    "BACKGROUND": ["education_choice", "strengths_weaknesses", "personality"],
    "RESUME_EXPLORATION": ["experience_project", "achievement"],
    "PROJECT_DISCUSSION": ["experience_project", "initiative", "achievement"],
    "BEHAVIORAL": ["conflict_resolution", "failure_learning", "pressure_handling", "situational", "ethics", "adaptability"],
    "COLLABORATION": ["teamwork", "communication", "conflict_resolution"],
    "OWNERSHIP": ["initiative", "time_management", "ethics", "adaptability"],
    "JD_ALIGNMENT": ["experience_project", "adaptability", "achievement", "leadership"],
    "COMPANY_FIT": ["company_research", "personality"],
    "MOTIVATION": ["career_goals", "salary_expectations", "personality"],
    "CLOSING": ["closing", "personality"],
}

# Short, static tone guidance per stage - a few words, not a paragraph, so the
# prompt doesn't grow meaningfully in size (see performance-audit token budget).
_HR_STAGE_TONE: dict[str, str] = {
    "INTRODUCTION": "warm, welcoming - this is the opening minute of the interview",
    "BACKGROUND": "friendly, curious about their journey",
    "RESUME_EXPLORATION": "genuinely interested in their real experience",
    "PROJECT_DISCUSSION": "focused, technical, digging into specifics",
    "BEHAVIORAL": "evaluative - probing how they actually think and act",
    "COLLABORATION": "evaluative - how they work with others",
    "OWNERSHIP": "evaluative - accountability and initiative",
    "JD_ALIGNMENT": "assessing fit for this specific role",
    "COMPANY_FIT": "assessing genuine interest in this company",
    "MOTIVATION": "reflective, forward-looking",
    "CLOSING": "professional, wrapping up warmly",
}


def _hr_progress_stage(turn: int, total_questions: int | None) -> str:
    """Percentage-of-completion stage lookup - not a fixed question number, so
    this scales correctly whether the drive is configured for 5 or 20 questions."""
    if not total_questions or total_questions <= 1:
        return "INTRODUCTION" if turn == 0 else "CLOSING"
    pct = (turn / (total_questions - 1)) * 100.0
    for stage, upper in _HR_STAGE_BANDS:
        if pct <= upper:
            return stage
    return "CLOSING"


# ── Conversation State Engine (Reality-Based Conversation Engine) ──────────
# Every previous turn must be classified into exactly one of these states
# BEFORE any acknowledgement/callback/summary text is generated about it -
# nothing downstream may treat a turn as "answered" without going through
# this first. Pure deterministic heuristics over the answer text + score
# already sitting in conversation_history; no new LLM call, no new field, no
# new query. INTERRUPTED is defined for completeness but never actively
# assigned below: detecting a genuine timer cutoff would need a new signal
# from the client (a "timedOut" flag) that doesn't exist anywhere in the
# current request payload, and a cut-off answer already falls into
# PARTIAL_RESPONSE, which gets the same non-presumptuous treatment a real
# INTERRUPTED state would.
HR_STATE_VALID = "VALID_RESPONSE"
HR_STATE_PARTIAL = "PARTIAL_RESPONSE"
HR_STATE_NO_RESPONSE = "NO_RESPONSE"
HR_STATE_REFUSAL = "REFUSAL"
HR_STATE_OFF_TOPIC = "OFF_TOPIC"
HR_STATE_TECHNICAL_FAILURE = "TECHNICAL_FAILURE"
HR_STATE_LOW_CONFIDENCE = "LOW_CONFIDENCE_TRANSCRIPT"
HR_STATE_INTERRUPTED = "INTERRUPTED"  # see note above - never assigned yet
_HR_NON_EVIDENCE_STATES = (
    HR_STATE_NO_RESPONSE, HR_STATE_TECHNICAL_FAILURE, HR_STATE_LOW_CONFIDENCE,
    HR_STATE_REFUSAL, HR_STATE_OFF_TOPIC,
)

# Node's handleAudioUpload (interview.middleware.js) substitutes this exact
# sentinel whenever transcription fails or no audio was uploaded at all -
# non-blank, so it needs its own check rather than falling out with a plain
# empty-string test.
_HR_UNAVAILABLE_SENTINELS = {"not available", "n/a", "na"}

# A well-documented Whisper artifact: on silent/near-silent audio it
# hallucinates stock boilerplate instead of returning empty text. Matched
# against the WHOLE trimmed answer, never a substring - a real answer that
# happens to mention one of these phrases in passing is not this.
_HR_STT_HALLUCINATION_PHRASES = {
    "thank you for watching", "thanks for watching", "please subscribe",
    "like and subscribe", "see you in the next video", "bye bye", "you",
}

_HR_REFUSAL_MARKERS = (
    "i don't know", "i do not know", "i'd rather not", "i would rather not",
    "no comment", "i'm not comfortable", "i am not comfortable",
    "skip this question", "pass on this", "prefer not to answer",
    "rather not say", "i don't want to answer",
)

_HR_OFF_TOPIC_MARKERS = (
    "not related to what you asked", "different topic entirely",
    "can we talk about something else", "why are you asking that",
    "that's not what i want to talk about",
)


def _hr_classify_response_state(answer: Any, score: Any) -> str:
    """Deterministic classification of ONE previous turn's response."""
    text = str(answer or "").strip()
    normalized = text.lower().rstrip(".!? ")

    if not text:
        return HR_STATE_NO_RESPONSE
    if normalized in _HR_UNAVAILABLE_SENTINELS:
        return HR_STATE_TECHNICAL_FAILURE
    if normalized in _HR_STT_HALLUCINATION_PHRASES:
        return HR_STATE_LOW_CONFIDENCE

    word_count = len(text.split())
    if any(m in normalized for m in _HR_REFUSAL_MARKERS) and word_count <= 25:
        return HR_STATE_REFUSAL
    if any(m in normalized for m in _HR_OFF_TOPIC_MARKERS):
        return HR_STATE_OFF_TOPIC
    if word_count <= 3:
        return HR_STATE_PARTIAL
    return HR_STATE_VALID


def _hr_last_turn(conversation_history: list[Any] | None) -> tuple[str, str, float | None]:
    """(state, answer_text, score) for the turn immediately preceding this one
    - always the actual LAST entry in conversation_history, never a backward
    search for "the last one with a truthy answer" (that pattern let a blank
    or failed turn get silently skipped over and an OLDER answer get
    presented as if it had just been said). Returns ("", "", None) when
    there is no previous turn to classify at all (first question, or an
    entry that hasn't been answered yet)."""
    if not conversation_history:
        return "", "", None
    last = None
    for entry in reversed(conversation_history):
        if isinstance(entry, dict):
            last = entry
            break
    if last is None or "answer" not in last:
        return "", "", None
    answer = last.get("answer")
    score = last.get("score")
    try:
        score_val = float(score) if score is not None else None
    except (TypeError, ValueError):
        score_val = None
    return _hr_classify_response_state(answer, score), str(answer or "").strip(), score_val


def _hr_consecutive_unproductive_turns(conversation_history: list[Any] | None) -> int:
    """How many turns in a row, most recent first, produced no usable evidence
    (anything other than VALID_RESPONSE/PARTIAL_RESPONSE) - once this reaches
    2, the model is told to stop retrying the same competency and move on
    instead of asking a third variation of a question that isn't landing."""
    if not conversation_history:
        return 0
    count = 0
    for entry in reversed(conversation_history):
        if not isinstance(entry, dict) or "answer" not in entry:
            continue
        state = _hr_classify_response_state(entry.get("answer"), entry.get("score"))
        if state not in _HR_NON_EVIDENCE_STATES:
            break
        count += 1
    return count


def _hr_closing_coverage(conversation_history: list[Any] | None) -> tuple[int, int, int]:
    """(attempted, productive, fully_valid) turn counts - productive means the
    candidate produced VALID_RESPONSE or PARTIAL_RESPONSE content; fully_valid
    counts only VALID_RESPONSE. The distinction matters for the closing
    directive: an interview where every turn was a thin PARTIAL_RESPONSE
    fragment ("It was fine.") is "productive == attempted" but is NOT a rich,
    fully-covered interview, so it must not be treated the same as one where
    every turn was a real VALID_RESPONSE."""
    attempted = 0
    productive = 0
    fully_valid = 0
    for entry in conversation_history or []:
        if not isinstance(entry, dict) or "answer" not in entry:
            continue
        attempted += 1
        state = _hr_classify_response_state(entry.get("answer"), entry.get("score"))
        if state in (HR_STATE_VALID, HR_STATE_PARTIAL):
            productive += 1
        if state == HR_STATE_VALID:
            fully_valid += 1
    return attempted, productive, fully_valid


def _hr_closing_reality_directive(
    conversation_history: list[Any] | None, evidence_board: dict[str, str] | None = None,
) -> str:
    """Phase 9 - the closing turn must reflect what ACTUALLY happened, not
    what a typical interview would cover. Counts how many attempted turns
    produced real evidence (VALID_RESPONSE/PARTIAL_RESPONSE) and returns a
    directive that overrides the default "summarize what was covered"
    instinct whenever there wasn't enough real material to summarize.
    Reuses the adaptive_followup_note prompt slot for the CLOSING turn only
    (see call site) - no new template placeholder."""
    if not conversation_history:
        return ""
    attempted, productive, fully_valid = _hr_closing_coverage(conversation_history)
    if attempted == 0:
        return ""
    if productive == 0:
        return (
            "IMPORTANT: the candidate did not provide a usable verbal response to any "
            "question this interview (silence, refusals, or technical failures throughout). "
            "Do NOT summarize discussion that did not happen and do NOT thank them for "
            "specific answers. Instead, state professionally and neutrally that you weren't "
            "able to collect enough information today to complete an assessment, thank them "
            "for their time, and close - do not invent topics that were supposedly covered."
        )
    if fully_valid < attempted:
        # Naming the exact competencies with real evidence (rather than just
        # telling the model "only mention what was genuinely covered" and
        # trusting it to work that out on its own) - testing showed the softer
        # instruction alone still let generic summary phrasing slip through.
        covered = sorted(
            c for c, v in (evidence_board or {}).items() if v != "UNKNOWN"
        )
        covered_note = (
            f' The ONLY topics you may claim were discussed are: {", ".join(covered)}.'
            if covered else " Do not name any specific topic as discussed - none had a real answer yet."
        )
        return (
            f"IMPORTANT: only {productive} of {attempted} questions this interview produced "
            "a real, usable answer - the rest were silence, refusals, or technical failures. "
            "Your summary must name ONLY the specific topics that were genuinely discussed, "
            f"not a generic full recap, and must not imply the interview covered more ground "
            f"than it actually did.{covered_note}"
        )
    return (
        "Summarize only the specific topics/competencies genuinely discussed this interview, "
        "based on the candidate's real answers - do not pad the summary with anything that "
        "wasn't actually covered."
    )


def _hr_adaptive_followup_note(state: str, answer: str, score: float | None) -> str:
    """Given the already-classified previous turn, returns a short directive
    nudging the next question toward a deeper probe, a clarification, or a
    STAR-completeness check. Only meaningful for a VALID_RESPONSE - anything
    else has no reliable content to build a deeper probe on, and is handled
    instead by the Conversation State rules in hr.txt (acknowledgement_hint)."""
    if state != HR_STATE_VALID or score is None:
        return ""

    word_count = len(answer.split())
    outcome_markers = (
        "result", "outcome", "impact", "led to", "improved", "reduced",
        "increased", "achieved", "resulted in", "successfully", "which helped",
    )
    has_outcome = any(m in answer.lower() for m in outcome_markers)

    # Evidence validation: a real recruiter checks an unquantified improvement
    # claim ("I improved API performance") instead of taking it at face value.
    # Cheap, deterministic signal - an outcome word present with no digit
    # anywhere in the answer means the claim was never actually measured.
    has_digit = any(ch.isdigit() for ch in answer)
    if has_outcome and not has_digit and word_count >= 10:
        return (
            "The candidate's previous answer claimed an improvement or result but gave "
            "no number to back it up. Do NOT repeat the original question - instead ask "
            "them to validate that specific claim: how did they measure it, or what "
            "metric actually changed."
        )

    if score < 40:
        return (
            "The candidate's previous answer was vague or underdeveloped. Ask a "
            "narrower follow-up that makes it easy for them to give one concrete, "
            "specific example instead of a general statement."
        )
    if word_count < 15 or not has_outcome:
        return (
            "The candidate's previous answer described a situation but did not "
            "clearly state the result or outcome. If this turn's scenario type "
            "naturally allows it, nudge them toward that (e.g. ask what actually "
            "happened as a result) rather than moving to a completely unrelated topic."
        )
    if score >= 75 and word_count >= 40:
        return (
            "The candidate's previous answer was strong and detailed. Go one level "
            "deeper on that same thread if this turn's scenario type allows it "
            "(e.g. a harder follow-up on the same project/decision), rather than a "
            "generic new question."
        )
    return ""


def _hr_jd_gap_directive(job_description: str, resume_text: str, recent_questions: list[str] | None) -> str:
    """Cheap, non-LLM JD-vs-coverage check: reuses the existing regex JD-skill
    extractor (services.retrieval.query_builder.extract_jd_skills) to find the
    highest-priority JD requirement not yet touched by the resume or by a
    question already asked, and returns a directive to ground this turn in
    that specific gap. Empty string when there's no JD or no gap left."""
    jd_text = (job_description or "").strip()
    if not jd_text:
        return ""
    try:
        from services.retrieval.query_builder import extract_jd_skills
        skills = extract_jd_skills(jd_text, "")
    except Exception:
        return ""
    if not skills:
        return ""

    resume_lower = (resume_text or "").lower()
    asked_lower = " ".join(str(q) for q in (recent_questions or []) if q).lower()
    for skill in skills:
        s = skill.lower()
        if s not in asked_lower:
            in_resume = s in resume_lower
            if in_resume:
                return (
                    f'This role requires "{skill}", and the resume already shows related '
                    f'experience - ask how they would apply/extend that specifically for '
                    f'"{skill}" in this role.'
                )
            return (
                f'This role requires "{skill}", which is not evident on the resume - ask a '
                f'question that checks their exposure to it directly (e.g. how they would '
                f'approach or learn it for this role).'
            )
    return ""


# Natural bridging phrases between consecutive stages - reused verbatim as an example
# of the TONE to strike, not copied into the output word-for-word. Keyed by
# (from_stage, to_stage); falls back to a generic transition when a specific pair
# isn't listed (e.g. a short interview that skips straight from Introduction to
# Behavioral). Pure string lookup, no LLM, no state beyond the two stage names -
# both of which are recomputed for free from (turn, total_questions).
_HR_STAGE_TRANSITIONS: dict[tuple[str, str], str] = {
    ("INTRODUCTION", "BACKGROUND"): "Thank them for the introduction, then move naturally into asking about their academic/educational background.",
    ("INTRODUCTION", "RESUME_EXPLORATION"): 'Thank them for the introduction, mention you noticed some interesting experience on their profile, and say you would like to understand it better before asking about it.',
    ("BACKGROUND", "RESUME_EXPLORATION"): "Acknowledge what they just shared, then say their project experience looks interesting and you'd like to dig into it.",
    ("RESUME_EXPLORATION", "PROJECT_DISCUSSION"): "Acknowledge their answer, then ask them to walk through a specific project where they faced a real challenge.",
    ("PROJECT_DISCUSSION", "BEHAVIORAL"): "Acknowledge their answer, then shift toward how they handle people/situations rather than pure technical work.",
    ("BEHAVIORAL", "COLLABORATION"): "Acknowledge their answer, then move toward how they work with others on a team.",
    ("COLLABORATION", "OWNERSHIP"): "Acknowledge their answer, then shift toward times they took ownership or initiative without being asked.",
    ("OWNERSHIP", "JD_ALIGNMENT"): "Acknowledge their answer, mention that gives a better sense of their working style, then connect it to what this specific role requires.",
    ("JD_ALIGNMENT", "COMPANY_FIT"): "Acknowledge their answer, then shift toward what draws them to this company specifically.",
    ("COMPANY_FIT", "MOTIVATION"): "Acknowledge their answer, then ask about their longer-term goals.",
    ("MOTIVATION", "CLOSING"): "Acknowledge their answer, then say you've covered their background, experience, and approach, and it's time to wrap up.",
}
_HR_GENERIC_TRANSITION = "Briefly acknowledge their previous answer before moving to the new topic - do not jump straight to the next question with no bridge."


def _hr_stage_transition_note(previous_stage: str, current_stage: str) -> str:
    """Empty when the stage hasn't changed since the last turn (nothing to bridge
    - just acknowledge-and-continue within the same stage); a short bridging
    instruction when it has. previous_stage is recomputed from (turn-1,
    total_questions) - the same pure percentage lookup used for the current
    turn, so no per-turn stage history needs to be stored anywhere."""
    if not previous_stage or previous_stage == current_stage:
        return ""
    return _HR_STAGE_TRANSITIONS.get((previous_stage, current_stage), _HR_GENERIC_TRANSITION)


def _hr_acknowledgement_hint(state: str, answer: str, score: float | None) -> str:
    """The single signal hr.txt uses to decide how - or whether - to open the
    response. For a VALID_RESPONSE this keeps the original strong/weak/neutral
    tone signal (short, separate from _hr_adaptive_followup_note, which
    controls question DEPTH instead). For anything else, returns the state
    name itself, so the prompt applies the exact Conversation State rule for
    that state (Phase 5) instead of fabricating an acknowledgement - this is
    the fix for the reality-based conversation engine's core failure mode."""
    if not state:
        return ""
    if state != HR_STATE_VALID:
        return state
    if score is None:
        return "neutral"
    word_count = len(answer.split())
    if score >= 75 and word_count >= 25:
        return "strong"
    if score < 40 or word_count < 8:
        return "weak"
    return "neutral"


# Cheap, non-LLM keyword classifier over the candidate's own last answer text
# (already in conversation_history - no new call, no new storage). Replaces
# tone-only acknowledgements ("Got it," / "I see," on repeat) with a content-aware
# one ("I can see that was a meaningful experience" for an achievement, "I
# appreciate your honesty" for a failure, ...). Checked in priority order since one
# answer can plausibly match more than one category - failure/leadership/learning
# are rarer, more specific signals worth prioritizing over the broader, more common
# challenge/achievement/collaboration buckets.
_HR_INTENT_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("failure", ("mistake", "failed", "went wrong", "i was wrong", "didn't work", "did not work", "messed up", "error i made")),
    ("leadership", ("i led", "took charge", "as the lead", "managed the team", "delegated", "mentored", "guided the team")),
    ("learning", ("i learned", "realized", "taught me", "lesson", "understood that", "grew from", "eye opening")),
    ("challenge", ("difficult", "challenging", "struggled", "tough", "obstacle", "hard to", "under pressure")),
    ("achievement", ("achieved", "accomplished", "proud", "successfully", "improved", "increased", "reduced", "delivered")),
    ("collaboration", ("my team", "together", "collaborated", "communicated with", "teammate")),
]


def _hr_detect_answer_intent(state: str, answer: str) -> str:
    """Empty string when the previous turn wasn't a VALID_RESPONSE (nothing
    real to build a content-aware callback on - see Conversation State Engine)
    or nothing recognizable matched (the model falls back to a brief generic
    acknowledgement in that case)."""
    if state != HR_STATE_VALID or not answer:
        return ""
    answer_lower = answer.lower()
    for intent, markers in _HR_INTENT_KEYWORDS:
        if any(m in answer_lower for m in markers):
            return intent
    return ""


def _hr_turns_in_stage(turn: int, total_questions: int | None, current_stage: str) -> int:
    """How many consecutive turns (including this one) have shared the current
    stage - e.g. 1 for the first turn in Project Discussion, 2 for the second.
    Stage is a pure function of (turn, total_questions), so this just walks
    backward re-deriving it; no history needs to be stored anywhere for it."""
    count = 1
    i = turn - 1
    while i >= 0 and _hr_progress_stage(i, total_questions) == current_stage:
        count += 1
        i -= 1
    return count


def _hr_depth_directive(turns_in_stage: int) -> str:
    """Long-interview strategy: a stage that spans more than one turn (common
    once an interview has 15-20+ questions) should go DEEPER each time, not ask
    another same-level example - e.g. resume -> architecture -> trade-offs ->
    stakeholder/business impact -> what they'd change now, rather than three
    independent "tell me about a project" questions in a row."""
    if turns_in_stage <= 1:
        return ""
    if turns_in_stage == 2:
        return (
            "This is a second question on the same broad theme as the last turn - go one "
            "level deeper (e.g. the reasoning behind a choice, a trade-off, how they'd defend "
            "the decision) rather than asking for another same-level example from scratch."
        )
    return (
        "This is a further question on the same broad theme - push for the deepest level: "
        "business/stakeholder impact, what they would change if they redid it now, or a "
        "genuine failure/learning angle on that same thread, rather than another fresh example."
    )


# ── Recruiter Evidence Board ────────────────────────────────────────────────
# A real recruiter doesn't ask random questions - they track what they've
# learned and target the gaps. This recomputes a competency confidence map
# EVERY turn from data already in conversation_history/recent_questions (no new
# storage, no new query): for each competency, scan which PAST QUESTIONS probed
# it (by keyword) and use that turn's own score to grade the evidence gathered.
# This only ever narrows the CANDIDATE LIST already produced by the existing
# stage+difficulty rotation (_HR_STAGE_SCENARIOS/DIFFICULTY_SCENARIO_MAP) - it
# is a preference layered on top of that rotation, never a replacement for it,
# and needs zero new prompt text since it only changes WHICH existing
# scenario_type gets picked.
_HR_COMPETENCY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Communication": ("explain", "communicat", "misunderstanding", "presentation"),
    "Leadership": ("led the", "leadership", "took charge", "guide your team", "mentor", "leading"),
    "Ownership": ("initiative", "took ownership", "without being asked", "went beyond"),
    "Conflict": ("disagree", "conflict", "different opinion", "dispute"),
    "Learning Ability": ("learned", "mistake", "lesson", "quickly learn", "new technology or tool"),
    "Decision Making": ("critical decision", "suppose", "imagine", "trade-off", "decide"),
    "Adaptability": ("adapt", "change in", "shift in", "unexpected"),
    "Problem Solving": ("challenge", "problem", "bug", "issue", "solve", "technical"),
    "Business Thinking": ("impact", "business", "users", "customer", "measurable", "metric", "value"),
    "Culture Fit": ("company", "why you", "values", "work style", "motivat", "career"),
}

# Every named competency SCENARIO_TYPES can provide direct evidence for. Several
# competencies share a scenario type (e.g. Ownership and Learning Ability both
# get evidence from initiative/failure_learning) since the existing taxonomy has
# 20 scenario types mapped onto these 10 recruiter-facing competencies, not a 1:1.
_HR_SCENARIO_TO_COMPETENCY: dict[str, str] = {
    "communication": "Communication",
    "leadership": "Leadership",
    "initiative": "Ownership",
    "ethics": "Ownership",
    "conflict_resolution": "Conflict",
    "failure_learning": "Learning Ability",
    "situational": "Decision Making",
    "pressure_handling": "Decision Making",
    "adaptability": "Adaptability",
    "experience_project": "Problem Solving",
    "achievement": "Problem Solving",
    "company_research": "Culture Fit",
    "personality": "Culture Fit",
    "career_goals": "Business Thinking",
    "teamwork": "Communication",
}

_HR_ALL_COMPETENCIES = tuple(dict.fromkeys(_HR_SCENARIO_TO_COMPETENCY.values()))
_HR_CONFIDENCE_RANK = {"UNKNOWN": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3}


def _hr_evidence_board(conversation_history: list[Any] | None) -> dict[str, str]:
    """{competency: 'HIGH'|'MEDIUM'|'LOW'|'UNKNOWN'}, recomputed fresh every call.
    A past turn's own QUESTION text says which competency it targeted (keyword
    match); that same turn's saved score says how well it was evidenced. Where a
    competency was probed more than once, the strongest evidence seen wins -
    one good answer is enough to move on from a competency, matching Phase 3's
    "never revisit a HIGH competency" rule.

    Verified Evidence Model (Phase 3): a turn only ever counts as evidence for
    a competency if the candidate actually produced VALID_RESPONSE or
    PARTIAL_RESPONSE content. A turn that was silence, a refusal, an
    off-topic remark, or an STT/technical failure contributes NOTHING here -
    it stays UNKNOWN, never LOW - because "no evidence" and "weak evidence"
    are different facts and only the model can currently distinguish them
    from a raw score alone (a technical failure and a genuinely weak answer
    could otherwise both land near 0)."""
    board = {c: "UNKNOWN" for c in _HR_ALL_COMPETENCIES}
    if not conversation_history:
        return board
    for entry in conversation_history:
        if not isinstance(entry, dict):
            continue
        q = str(entry.get("question") or "").lower()
        score = entry.get("score")
        if not q or score is None:
            continue
        try:
            score = float(score)
        except (TypeError, ValueError):
            continue
        state = _hr_classify_response_state(entry.get("answer"), score)
        if state not in (HR_STATE_VALID, HR_STATE_PARTIAL):
            continue
        # A PARTIAL_RESPONSE (a few words, some content) is real but thin -
        # cap what it can prove at LOW even if a generous score slipped through,
        # rather than let a fragment count as solid MEDIUM/HIGH evidence.
        level = "LOW" if state == HR_STATE_PARTIAL else (
            "HIGH" if score >= 70 else "MEDIUM" if score >= 40 else "LOW"
        )
        for competency, markers in _HR_COMPETENCY_KEYWORDS.items():
            if any(m in q for m in markers):
                if _HR_CONFIDENCE_RANK[level] > _HR_CONFIDENCE_RANK[board.get(competency, "UNKNOWN")]:
                    board[competency] = level
    return board


# Phase 7: different companies emphasize different competencies. This only ever
# breaks ties between equally-weak competencies in the Evidence Board - it never
# hardcodes a script or a question, and a company not in this map (or no company
# at all) just falls through to the existing rotation, unweighted.
_HR_COMPANY_COMPETENCY_PRIORITY: dict[str, tuple[str, ...]] = {
    "microsoft": ("Communication", "Ownership", "Learning Ability", "Problem Solving"),
    "amazon": ("Ownership", "Culture Fit", "Decision Making"),
    "google": ("Problem Solving", "Learning Ability", "Decision Making"),
    "meta": ("Business Thinking", "Decision Making", "Problem Solving"),
    "facebook": ("Business Thinking", "Decision Making", "Problem Solving"),
    "tcs": ("Communication", "Adaptability", "Culture Fit"),
    "infosys": ("Communication", "Adaptability", "Culture Fit"),
    "accenture": ("Communication", "Adaptability", "Culture Fit"),
    "wipro": ("Communication", "Adaptability", "Culture Fit"),
    "capgemini": ("Communication", "Adaptability", "Culture Fit"),
    "hcl": ("Communication", "Adaptability", "Culture Fit"),
}


def _hr_company_priority_competencies(company: str) -> tuple[str, ...]:
    company_lower = (company or "").strip().lower()
    for name, priorities in _HR_COMPANY_COMPETENCY_PRIORITY.items():
        if name in company_lower:
            return priorities
    return ()


def _hr_weakest_competency(
    evidence_board: dict[str, str], company: str, exclude: str | None = None,
) -> str | None:
    """Lowest-confidence competency, with the company's priority list (if any)
    as the tiebreaker among equally-weak ones - so two UNKNOWN competencies
    resolve toward whichever this specific company actually cares about.

    `exclude` (Phase 5/7 of the Reality-Based Conversation Engine): when the
    last two turns in a row produced no usable evidence, the caller passes in
    whichever competency was just being targeted so a third attempt doesn't
    hammer the same unproductive ground - the model is told to move to a
    different competency instead of retrying."""
    candidates = {c: v for c, v in (evidence_board or {}).items() if c != exclude}
    if not candidates:
        candidates = evidence_board or {}
    if not candidates:
        return None
    min_rank = min(_HR_CONFIDENCE_RANK[v] for v in candidates.values())
    weakest = [c for c, v in candidates.items() if _HR_CONFIDENCE_RANK[v] == min_rank]
    if len(weakest) == 1:
        return weakest[0]
    priority = _hr_company_priority_competencies(company)
    for p in priority:
        if p in weakest:
            return p
    return weakest[0] if weakest else None


def _hr_last_targeted_competency(conversation_history: list[Any] | None) -> str | None:
    """Which competency the immediately-preceding question targeted, by the
    same keyword match _hr_evidence_board uses - so an unproductive-turn
    streak can be steered away from that same competency next turn."""
    if not conversation_history:
        return None
    last_question = None
    for entry in reversed(conversation_history):
        if isinstance(entry, dict) and entry.get("question"):
            last_question = str(entry["question"]).lower()
            break
    if not last_question:
        return None
    for competency, markers in _HR_COMPETENCY_KEYWORDS.items():
        if any(m in last_question for m in markers):
            return competency
    return None


# Phase 6: not every resume line deserves the same confidence. Deterministic,
# no LLM - counts concrete signals (numbers/percentages, role/ownership words,
# internship/project language) against generic buzzwords with nothing backing
# them, so a "detail-oriented team player" line doesn't get treated the same as
# a resume full of quantified, internship-backed project work.
_HR_RESUME_STRONG_SIGNALS = (
    "internship", "intern", "led ", "built", "developed", "designed", "implemented",
    "%", "achieved", "delivered", "launched", "published",
)
_HR_RESUME_BUZZWORDS = (
    "hardworking", "team player", "passionate", "detail-oriented", "detail oriented",
    "quick learner", "self-motivated", "go-getter", "dynamic individual",
)


def _hr_resume_confidence(resume_text: str) -> str:
    """'high' | 'medium' | 'low' - used only to shade the wording of the
    existing resume_directive (no new prompt line), so a deep, specific
    question is only asked when the resume backs it up with real signal;
    otherwise the question stays exploratory rather than assuming expertise."""
    text = (resume_text or "").strip()
    if not text:
        return "low"
    text_lower = text.lower()
    has_digit = any(ch.isdigit() for ch in text)
    strong_hits = sum(1 for s in _HR_RESUME_STRONG_SIGNALS if s in text_lower)
    buzzword_hits = sum(1 for b in _HR_RESUME_BUZZWORDS if b in text_lower)
    if strong_hits >= 2 or (strong_hits >= 1 and has_digit):
        return "high"
    if strong_hits >= 1 or (len(text.split()) >= 15 and buzzword_hits == 0):
        return "medium"
    return "low"


# Recruiter-style acknowledgements ("Got it, that sounds like a good example of
# ownership.", "I see, it sounds like you handled that well.") are short and share
# the same handful of function words almost by construction, so the existing
# near-duplicate detector's STRUCTURAL check (which masks content words and compares
# what's left) started flagging genuinely different HR questions as near-duplicates
# of each other far more often once every turn opened with one - measured a jump
# from ~1 collision per 20-question run to ~1 in 3 turns, each collision costing a
# full extra LLM round-trip. This drops leading short, non-question sentences (the
# acknowledgement/transition clauses) before the text is handed to the dedup check
# only - the full acknowledgement + question is still what the candidate actually
# sees; only the internal similarity comparison starts from the substantive part.
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_HR_ACK_MAX_WORDS = 20


def _strip_hr_ack_prefix(text: str) -> str:
    """Drops leading sentences that look like acknowledgement/transition filler
    (short, and not themselves a question) so dedup comparison focuses on the
    real question. Falls back to the original text if nothing would be left."""
    if not text:
        return text
    sentences = _SENTENCE_SPLIT_RE.split(text.strip())
    idx = 0
    while idx < len(sentences) - 1:
        s = sentences[idx].strip()
        if s and len(s.split()) <= _HR_ACK_MAX_WORDS and not s.endswith("?"):
            idx += 1
        else:
            break
    remainder = " ".join(sentences[idx:]).strip()
    return remainder if len(remainder) >= 10 else text


# Reality-Based Conversation Engine (Phase 8): testing showed the prompt-level
# "do NOT acknowledge" instruction in hr.txt was NOT reliably followed - the
# model would still open with "I appreciate...", "It sounds like...", "That
# sounds like..." (or, for a REFUSAL, "I can see that was a meaningful
# experience") even when acknowledgement_hint correctly identified the state
# and stage_transition_note was correctly suppressed. A "must NEVER" rule
# cannot rely on a probabilistic instruction, so this is a deterministic,
# non-LLM backend guarantee instead: for every state with no real, buildable
# content, strip whatever leading declarative sentence the model wrote (same
# split heuristic as _strip_hr_ack_prefix) and replace it with a fixed,
# honest, state-appropriate lead-in. REFUSAL and OFF_TOPIC still get their
# own brief "that's fine, let's move on" / redirect line (per Phase 5 - a
# refusal is real, if unwelcome, content) - they just can no longer be
# phrased as if the refusal itself was a substantive answer. CLOSING is
# excluded - _hr_enforce_closing_reality already handles that turn.
_HR_NO_ACK_LEAD_INS: dict[str, str] = {
    HR_STATE_PARTIAL: "I didn't quite get enough from that to go on. Let me ask it a bit more clearly.",
    HR_STATE_REFUSAL: "That's completely fine, let's move on to a different topic.",
    HR_STATE_OFF_TOPIC: "Let's bring it back to the original question for a moment.",
}
_HR_NO_ACK_DEFAULT_LEAD_IN = (
    "I couldn't gather enough information from your previous response. Let me ask that another way."
)

# A leading sentence gets stripped either for being short-and-not-a-question
# (the original heuristic) OR for containing one of these marker phrases
# regardless of length - testing found the model sometimes wraps a
# hallucinated acknowledgement in a single long sentence ("It sounds like you
# had a significant impact during your internship... especially with
# improving the API response time by 42 percent.") that the word-count
# threshold alone let through.
_HR_ACK_MARKER_PHRASES = (
    "it sounds like", "that sounds like", "i appreciate", "i can see",
    "i see that", "i understand", "i noticed", "great to hear", "that's impressive",
)


def _hr_enforce_no_ack(question_text: str, state: str, hr_stage: str) -> str:
    if hr_stage == "CLOSING" or state not in (
        HR_STATE_NO_RESPONSE, HR_STATE_TECHNICAL_FAILURE, HR_STATE_LOW_CONFIDENCE,
        HR_STATE_PARTIAL, HR_STATE_REFUSAL, HR_STATE_OFF_TOPIC,
    ):
        return question_text
    text = (question_text or "").strip()
    if not text:
        return text
    sentences = _SENTENCE_SPLIT_RE.split(text)
    idx = 0
    while idx < len(sentences) - 1:
        s = sentences[idx].strip()
        s_lower = s.lower()
        looks_like_filler = s and len(s.split()) <= _HR_ACK_MAX_WORDS and not s.endswith("?")
        looks_like_ack = s and any(m in s_lower for m in _HR_ACK_MARKER_PHRASES) and not s.endswith("?")
        if looks_like_filler or looks_like_ack:
            idx += 1
        else:
            break
    remainder = " ".join(sentences[idx:]).strip()
    if len(remainder) < 10:
        remainder = text
    lead_in = _HR_NO_ACK_LEAD_INS.get(state, _HR_NO_ACK_DEFAULT_LEAD_IN)
    return f"{lead_in} {remainder}"


# Phase 9/12: the closing summary needs a deterministic guarantee, not just a
# prompt instruction - testing showed the model would still name a competency
# as "discussed" (e.g. "leadership", "teamwork") even when handed an explicit
# whitelist of the only topics it was allowed to claim ("The ONLY topics you
# may claim were discussed are: ..."). A "must never invent discussion" rule
# on the interview's final, most-visible turn can't rely on that being
# followed reliably, so this builds the summary sentence itself from the
# Evidence Board's genuinely-covered competencies (Case A/B/C from the spec).
def _hr_enforce_closing_reality(
    question_text: str,
    hr_stage: str,
    conversation_history: list[Any] | None,
    evidence_board: dict[str, str] | None,
    company: str,
) -> str:
    if hr_stage != "CLOSING":
        return question_text
    attempted, productive, fully_valid = _hr_closing_coverage(conversation_history)
    if attempted == 0:
        return question_text
    company = (company or "").strip()
    closing_question = (
        f"is there anything you'd like to know about the role, the team, or {company}?"
        if company else "is there anything you'd like to know about the role or the team?"
    )
    if productive == 0:
        # Case C: silence throughout - do not name a single topic.
        return (
            "I wasn't able to collect enough information during today's interview to perform a "
            f"complete assessment. Thank you for your time today - before we conclude, {closing_question}"
        )
    covered = sorted(c for c, v in (evidence_board or {}).items() if v != "UNKNOWN")
    if not covered or fully_valid == attempted:
        # Case A (every turn was a real, substantive VALID_RESPONSE - not just
        # "productive", which PARTIAL_RESPONSE fragments also count toward) or
        # no board signal to safely name topics from - the original model text
        # already passed through _hr_enforce_no_ack, so only the fully-silent
        # and thin-coverage cases below need a hard override here.
        return question_text
    # Case B: partial coverage - name exactly the genuinely-covered
    # competencies, nothing else, rather than trust a generic model recap.
    topics = ", ".join(covered[:-1]) + (" and " + covered[-1] if len(covered) > 1 else covered[0])
    return (
        f"Thank you for your time today. We were able to cover {topics} during our conversation, "
        f"though a few other questions didn't get a full response. Before we conclude, {closing_question}"
    )


# Candidate Context (Phase 3) includes the target company - but when NO
# company was actually configured for this interview, the closing example's
# own phrasing ("...or Amazon?") was enough to make the model invent a real
# company name out of nowhere often enough in testing that the prompt-level
# "only name it if Company Name is non-blank" instruction couldn't be trusted
# alone (same lesson as _hr_enforce_no_ack). Deterministically replaces any
# well-known company name with a generic phrase when none was ever provided -
# this can only ever remove an invented name, never touch a real one, since it
# is a no-op whenever `company` is actually set.
_HR_KNOWN_COMPANY_NAMES = (
    "Microsoft", "Amazon", "Google", "Meta", "Facebook", "TCS", "Infosys",
    "Accenture", "Wipro", "Capgemini", "HCL", "Apple", "Netflix", "IBM",
)


def _hr_strip_invented_company(question_text: str, company: str) -> str:
    if (company or "").strip():
        return question_text
    text = question_text or ""
    for name in _HR_KNOWN_COMPANY_NAMES:
        text = re.sub(rf"\b{re.escape(name)}\b", "the company", text)
    return text


class QuestionGeneratorAgent(BaseInterviewAgent):
    """Generates the next interview question and avoids duplicates."""

    def generate(
        self,
        session_id: str,
        *,
        category_hint: str | None = None,
        interview_type: str = "subject",
        subject: str | None = None,
    ) -> QuestionGenerationResult:
        context = self.memory.get_recent_context(session_id)
        recent_questions = self.memory.get_previous_question_texts(session_id, limit=10)
        
        # Get session for GLAMIS fields
        session = self.memory.get_session(session_id)
        
        # Prepare prompt based on interview type
        subject_type = InterviewTypeRouter.get_subject_type(subject or "") if interview_type == "subject" else None
        if interview_type == "subject" and subject_type is not None:
            prompt_name = f"subject_{subject_type.value}"
            subdirectory = "subjects"
        elif interview_type in ("generic", "question_generator", "subject"):
            # General interview steered by category_hint (e.g. the Avatar studio
            # types: behavioral / technical / system-design / verbal / dsa).
            prompt_name = "question_generator"
            subdirectory = ""
        else:
            prompt_name = interview_type
            subdirectory = ""
        
        jd_payload = self._build_jd_payload(
            {
                "jd_details": getattr(session, "jd_details", None) or "",
                "role": context.get("role") or "",
                "recent_questions": recent_questions,
                "covered_topics": [],
            },
            session=session,
            session_id=session_id,
        )

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "skills": ", ".join(context["skills"]),
            "difficulty": context["difficulty"],
            "category_hint": category_hint or self._suggest_category(
                context, session_id=session_id,
                recent_questions=recent_questions,
            ),
            "recent_questions": safe_json_dumps(recent_questions),
            "previous_questions": safe_json_dumps(recent_questions),
            "session_context": safe_json_dumps(context),
            # GLAMIS-specific fields
            "subject": subject or getattr(session, "subject", None) or "",
            "company": getattr(session, "company", None) or "",
            "job_title": getattr(session, "job_title", None) or "",
            "jd_details": getattr(session, "jd_details", None) or "",
            "svar_type": getattr(session, "svar_type", None) or "",
            "question_style_directive": question_style_directive(
                len(recent_questions) + 1,
                context.get("difficulty"),
                seed=session_id or f"{subject or ''}|{context.get('role', '')}",
                recent_questions=recent_questions,
            ),
            "session_id": session_id,
            # JD-grounded generation fields (new)
            **jd_payload,
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    prompt_name if prompt_name != "subject_none" else "question_generator.txt",
                    prompt_payload,
                    QuestionGenerationResult,
                    subdirectory=subdirectory,
                )
                # Check for duplicates using new hashing mechanism
                if not self.memory.has_asked_question(session_id, result.question):
                    self.memory.mark_question_asked(session_id, result.question)
                    return result
                # If duplicate, try fallback
                logger.info(f"Question already asked, generating fallback for session {session_id}")
            except Exception:
                logger.warning("LLM question generation failed, falling back to heuristic question", exc_info=True)

        return self._fallback_question(context, recent_questions, session_id=session_id)

    def _suggest_category(
        self,
        context: dict[str, Any],
        session_id: str | None = None,
        recent_questions: list[str] | None = None,
        source: str | None = None,
    ) -> str:
        """
        JD-aware category router.

        Rules:
          * source == 'behavioral'  → always return BEHAVIORAL (router decided)
          * Behavioral cap:         ≤20% of questions asked so far may be behavioral
          * Hard difficulty:        always PROBLEM_SOLVING (scenario/design)
          * Otherwise:              rotate through Technical-dominant pattern
        """
        difficulty = context.get("difficulty", DifficultyLevel.MEDIUM.value)
        questions_asked = int(context.get("questions_asked", 0))

        # Normalize to plain strings: the RAG-enabled fallback path passes
        # recent_questions as dicts ({id, question, ...}) from get_recent_context,
        # and the q.lower() checks below would raise AttributeError on a dict.
        recent_questions = [
            q if isinstance(q, str) else (q.get("question", "") if isinstance(q, dict) else str(q))
            for q in (recent_questions or [])
        ]

        # If the source router explicitly assigned this turn to behavioral, honour it
        # but still respect the hard cap.
        if source == "behavioral":
            # Count how many behavioral questions were already asked
            beh_asked = sum(
                1 for q in (recent_questions or [])
                if any(kw in q.lower() for kw in
                       ("tell me about", "describe a time", "describe a situation",
                        "walk me through a time", "give me an example",
                        "how did you", "what did you do when"))
            )
            total_so_far = max(questions_asked, 1)
            if beh_asked / total_so_far < _BEHAVIORAL_CAP_RATIO:
                return QuestionCategory.BEHAVIORAL.value
            # Cap exceeded — fall through to technical rotation

        # Hard difficulty → always scenario / problem-solving
        if difficulty == DifficultyLevel.HARD.value:
            return QuestionCategory.PROBLEM_SOLVING.value

        # Check behavioral cap: never exceed 20% of questions asked
        beh_asked = sum(
            1 for q in (recent_questions or [])
            if any(kw in q.lower() for kw in
                   ("tell me about", "describe a time", "describe a situation",
                    "walk me through a time", "give me an example",
                    "how did you", "what did you do when"))
        )
        total_so_far = max(questions_asked, 1)
        beh_cap_reached = (beh_asked / total_so_far) >= _BEHAVIORAL_CAP_RATIO

        # Per-session offset ensures different sessions get different rotation starting points
        offset = hash(session_id) if session_id else 0
        raw_cat = _TECHNICAL_DOMINANT_PATTERN[(questions_asked + offset) % len(_TECHNICAL_DOMINANT_PATTERN)]

        # The opening question must establish topic grounding (Technical/DSA/System
        # Design), not open on an off-topic behavioral prompt - behavioral variety
        # only kicks in from turn 2 onward.
        if questions_asked == 0 and raw_cat == QuestionCategory.BEHAVIORAL.value:
            return QuestionCategory.TECHNICAL.value

        # If rotation would produce BEHAVIORAL but cap is reached, substitute TECHNICAL
        if raw_cat == QuestionCategory.BEHAVIORAL.value and beh_cap_reached:
            return QuestionCategory.TECHNICAL.value

        return raw_cat

    def _build_jd_payload(
        self,
        context_dict: dict[str, Any],
        session: Any = None,
        session_id: str | None = None,
        next_question_no: int | None = None,
        total_questions: int | None = None,
    ) -> dict[str, Any]:
        """
        Extract JD-derived skill graph and coverage info into a payload dict
        that is merged into every prompt template, enabling JD-grounded generation.
        """
        jd_text = (
            context_dict.get("jd_details")
            or context_dict.get("jd")
            or (getattr(session, "jd_details", None) if session else None)
            or ""
        )
        role = (
            context_dict.get("role")
            or (getattr(session, "role", None) if session else None)
            or ""
        )

        try:
            from services.retrieval.jd_skill_extractor import extract_jd_skills_llm
            jd_skills: List[str] = extract_jd_skills_llm(jd_text, role, self.openai_service)
        except Exception:
            jd_skills = []

        # extract_jd_skills_llm caches by (role, jd_text) - correctly, since a JD's
        # skill graph shouldn't change between interviews. But the extractor always
        # returns it in the same "most prominent first" order, and turn 1 of any
        # fresh session has nothing covered yet, so uncovered_jd_skills below is
        # just jd_skills verbatim - every interview scheduled against this JD asks
        # about that same top skill first, no matter how the question is phrased.
        # Rotate by a per-interview seed (cyclic, not shuffled, so relative
        # prominence order is preserved) so a different skill leads each session.
        if session_id and len(jd_skills) > 1:
            offset = int(hashlib.md5(session_id.encode("utf-8")).hexdigest(), 16) % len(jd_skills)
            jd_skills = jd_skills[offset:] + jd_skills[:offset]

        recent_qs = context_dict.get("recent_questions") or []
        # covered_topics is an explicit, pre-computed list some callers supply
        # (e.g. the RAG-history path) - honored when present. But it's simply
        # absent from context_dict for the stateless JD-admin flow and
        # hardcoded to [] in generate()'s own call site, so on its own this
        # was permanently empty for those callers: the same top jd_skills got
        # re-offered turn after turn with zero memory of what had already
        # been asked. recent_qs is reliably populated everywhere though, so a
        # skill also counts as covered once its own name shows up in this
        # session's actual asked questions - the same substring-match pattern
        # company_agent.py already uses successfully for its own, separate
        # uncovered-skills tracking.
        recent_text = " ".join(str(q) for q in recent_qs if q).lower()
        covered_topics: List[str] = context_dict.get("covered_topics") or []
        covered_lower = {t.lower() for t in covered_topics}
        uncovered = [
            s for s in jd_skills
            if s.lower() not in covered_lower and s.lower() not in recent_text
        ]

        # Skills dropped by the recent_text match belong in the "already
        # covered" list shown to the model too - otherwise it sees a narrower
        # uncovered_jd_skills but a "Topics already covered: None" line that
        # contradicts it.
        skill_derived_covered = [s for s in jd_skills if s.lower() in recent_text]
        all_covered = covered_topics + [s for s in skill_derived_covered if s not in covered_topics]

        # Uncapped (extract_jd_skills_llm itself caps at 20) - a truncated
        # view here meant the model never even saw skills past the cut, no
        # matter what the mandatory per-turn rotation below assigned. 100% of
        # the extracted JD skill graph needs to reach the prompt for the "use
        # the whole JD" requirement to mean anything.
        jd_skills_str = ", ".join(jd_skills) if jd_skills else ""
        uncovered_str = ", ".join(uncovered) if uncovered else ""
        covered_str   = ", ".join(all_covered) if all_covered else "None"

        # Rule 1 ("prioritise uncovered skills") used to be advisory-only, with a
        # MANDATORY override that fired solely once too few turns remained to hit
        # 80% coverage organically. In practice that meant every turn before the
        # home stretch was unenforced: the "covered" check below only marks a
        # skill covered once its own multi-word phrase (e.g. "Kafka event
        # streaming pipelines") shows up VERBATIM in a previously asked
        # question's text, which it almost never does even when that topic was
        # clearly just asked about - so the same top-of-list skill stayed
        # "uncovered" and got advised again turn after turn, and the model
        # (with nothing forcing it elsewhere) kept fixating on it for the whole
        # interview. Fixed by making every turn mandatory: strict round-robin
        # over the full (session-offset-rotated) skill list by turn index,
        # independent of the fragile text-coverage heuristic, which is now only
        # used for the human-readable ${uncovered_jd_skills} display above.
        coverage_directive = ""
        if jd_skills:
            turn_no = next_question_no or (len(recent_qs) + 1)
            target_skill = jd_skills[(turn_no - 1) % len(jd_skills)]
            logger.info(
                "[JD-ROTATION-DEBUG] next_question_no=%r len(recent_qs)=%d turn_no=%d "
                "len(jd_skills)=%d target_skill=%r",
                next_question_no, len(recent_qs), turn_no, len(jd_skills), target_skill,
            )
            coverage_directive = (
                f'MANDATORY SKILL FOR THIS TURN: this question MUST assess "{target_skill}" '
                f'specifically - not just any uncovered skill. It was chosen by rotation so '
                f'consecutive turns land on different JD requirement areas instead of circling '
                f'back to the same one or two skills all interview. Only substitute a different '
                f'skill from the JD skill graph above if "{target_skill}" is genuinely impossible '
                f'to build a sensible question around for this role.'
            )

        return {
            "jd_skills":          jd_skills_str,
            "uncovered_jd_skills": uncovered_str,
            "covered_topics":     covered_str,
            "jd_details":         jd_text,
            "jd_coverage_directive": coverage_directive,
        }

    def _fallback_question(
        self, context: dict[str, Any], recent_questions: list[str], session_id: str | None = None,
    ) -> QuestionGenerationResult:
        role = context["role"]
        skills = context.get("skills", [])
        difficulty = context.get("difficulty", DifficultyLevel.MEDIUM.value)
        category = self._suggest_category(context, session_id=session_id)

        if category == QuestionCategory.TECHNICAL.value:
            focus = skills[0] if skills else role
            question = f"Explain how you would solve a real-world {focus} problem in this role, and what trade-offs you would consider."
        elif category == QuestionCategory.BEHAVIORAL.value:
            question = f"Tell me about a time you had to learn something quickly for a project related to {role}. How did you approach it?"
        elif category == QuestionCategory.HR.value:
            question = f"Why are you interested in the {role} role, and what kind of team environment helps you do your best work?"
        else:
            question = f"Walk me through how you would approach a difficult {role} problem from first principles."

        if question in recent_questions:
            question = f"What is one concrete example of how you would apply your {', '.join(skills[:2]) or role} knowledge in this role?"

        return QuestionGenerationResult(
            question=question,
            category=QuestionCategory(category),
            difficulty=DifficultyLevel(difficulty),
            rationale="Fallback question generated from the candidate profile and recent interview context.",
        )

    # Avatar studio round types (config.js STUDIO.TYPE_LABELS) that have no
    # matching root-level prompt file of their own - these ride the generic
    # question_generator.txt template, steered by category_hint. "verbal" is
    # excluded: avatar sessions always route "verbal" to VerbalAgent before
    # generate_from_context is ever reached, and the stateless text flow's own
    # "verbal" type has a real verbal.txt template.
    _GENERIC_TEMPLATE_TYPES = ("technical", "behavioral", "dsa", "system-design")

    def generate_from_context(
        self,
        interview_type: str,
        context_dict: dict[str, Any],
        *,
        category_hint: str | None = None,
        subject: str | None = None,
        **kwargs,
    ) -> QuestionGenerationResult:
        """Generate a question using raw context dict (for GLAMIS stateless calls)."""
        session_id = kwargs.get("session_id")
        subject_type = (
            InterviewTypeRouter.get_subject_type(subject or context_dict.get("subject") or "")
            if interview_type == "subject" else None
        )
        if interview_type == "subject" and subject_type is not None:
            prompt_name = f"subject_{subject_type.value}"
            subdirectory = "subjects"
        elif interview_type in ("generic", "question_generator", "subject", *self._GENERIC_TEMPLATE_TYPES):
            prompt_name = "question_generator"
            subdirectory = ""
            if category_hint is None and interview_type in self._GENERIC_TEMPLATE_TYPES:
                category_hint = interview_type
        else:
            prompt_name = interview_type
            subdirectory = ""

        # Only company.txt, question_generator.txt (the generic fallback), and every
        # subject_*.txt template actually render ${question_style_directive} - hr.txt,
        # verbal.txt, written.txt, and svar.txt never reference it at all. The code-block
        # enforcement below (requires_code_block / retry / verbal-fallback) was running
        # unconditionally for every interview type regardless of whether its template
        # even showed the model that instruction, so a Medium-tier HR turn that happened
        # to roll a code-block "shape" internally (never seen by the LLM, since hr.txt
        # ignores it) would always fail requires_code_block's post-hoc check and pay for
        # up to two extra, wasted LLM round-trips - measured adding 5-25s to otherwise
        # ~2-4s HR turns for zero effect on the actual output.
        _uses_question_style_directive = subdirectory == "subjects" or prompt_name in ("company", "question_generator")

        recent_questions_list = context_dict.get("recent_questions") or []
        source_hint = kwargs.get("source")  # passed from generate_rag_question

        jd_payload = self._build_jd_payload(
            context_dict,
            session_id=session_id,
            next_question_no=context_dict.get("next_question_no"),
            total_questions=context_dict.get("total_questions"),
        )

        prompt_payload = {
            "candidate_name": context_dict.get("candidate_name") or "Candidate",
            "role": context_dict.get("role") or context_dict.get("job_title") or "",
            "experience": context_dict.get("experience") or "",
            "skills": ", ".join(context_dict.get("skills", [])) if isinstance(context_dict.get("skills"), list) else context_dict.get("skills") or "",
            "difficulty": context_dict.get("difficulty") or DifficultyLevel.MEDIUM.value,
            "category_hint": category_hint or self._suggest_category(
                context_dict, session_id=session_id,
                recent_questions=recent_questions_list,
                source=source_hint,
            ),
            # Capped to the recent tail, not the full session history: on a
            # 20+ question interview this block was growing to 10+ full
            # previous questions verbatim, and testing showed that much
            # repeated-theme text appears to out-weigh a single-line MANDATORY
            # skill instruction elsewhere in the prompt (the model kept
            # free-associating back to whatever topic dominated this block
            # instead of the newly assigned skill). Coverage/dedup tracking
            # elsewhere in this function already uses the full history - only
            # this rendered display is capped.
            # HR specifically gets a wider tail: a 20-question live run showed the same
            # STAR "teammate disagreement" framing recurring beyond the 8-question lookback
            # (DIFFICULTY_SCENARIO_MAP has up to 11 eligible scenario types per tier, so an
            # 8-question memory doesn't cover a full rotation). Other interview types are
            # left at 8, unchanged, since this wasn't measured or requested for them.
            "recent_questions": safe_json_dumps(recent_questions_list[-10:] if interview_type == "hr" else recent_questions_list[-8:]),
            "previous_questions": safe_json_dumps(recent_questions_list[-10:] if interview_type == "hr" else recent_questions_list[-8:]),
            "session_context": safe_json_dumps(context_dict),
            "subject": subject or context_dict.get("subject") or "",
            "company": context_dict.get("company") or context_dict.get("selected_company") or "",
            "job_title": context_dict.get("job_title") or context_dict.get("role") or "",
            "position": context_dict.get("position") or context_dict.get("job_title") or "",
            "jd_details": context_dict.get("jd_details") or context_dict.get("jd") or "",
            "job_description": context_dict.get("job_description") or context_dict.get("jd_details") or context_dict.get("jd") or "",
            # Populated only on the HR company-grounding retry below (hr.txt); empty on
            # every normal call and ignored entirely by templates that don't reference it.
            "strict_grounding_note": "",
            "svar_type": context_dict.get("svar_type") or context_dict.get("difficulty") or "",
            "resume_text": context_dict.get("resume_text") or "",
            "conversation_history": context_dict.get("conversation_history") or "",
            "history_prompt": context_dict.get("history_prompt") or "",
            "answer": context_dict.get("answer") or "",
            "session_id": session_id or "",
            # Set by _generate_from_context_deduped (interview_service.py) on a
            # regenerate-after-collision retry; empty on a normal first attempt.
            "regen_notice": context_dict.get("regen_notice") or "",
            # Coverage-blueprint slot (interview_engine.blueprint). When the caller
            # supplies an explicit slot it flows straight through; otherwise derive
            # a subtopic from the first uncovered JD skill so company.txt's
            # BLUEPRINT SLOT section renders cleanly instead of leaving a literal
            # ${blueprint_bucket} placeholder.
            "blueprint_bucket": context_dict.get("blueprint_bucket") or "",
            "blueprint_subtopic": (
                context_dict.get("blueprint_subtopic")
                or (jd_payload.get("uncovered_jd_skills") or "").split(",")[0].strip()
                or ""
            ),
            # JD-grounded generation fields (new)
            **jd_payload,
        }
        prompt_payload["web_context"] = build_grounding_block(
            _web_search_service,
            interview_type,
            subject=prompt_payload["subject"],
            company=prompt_payload["company"],
            role=prompt_payload["role"],
            web_search_enabled=bool(kwargs.get("web_search_enabled")),
            # Cache-or-skip: never wait on Tavily inline. The Node backend already
            # prefetches on interview creation, so the cache is usually warm; when
            # it isn't, we skip grounding this turn and warm it for the next.
            blocking=False,
        )
        # Pace company-specific questions to ~1 in 3 for company interviews. The
        # LLM can't reliably self-regulate this ratio (it drifts to all-or-none),
        # so we decide per-question by position and hand it one clear directive:
        # every 3rd question (3, 6, 9 of 10) is an explicit company question, the
        # rest are company-neutral role questions. company.txt renders
        # ${company_focus_directive}; other templates simply ignore it.
        company_name = prompt_payload["company"]
        if interview_type == "company" and company_name:
            q_number = len(context_dict.get("recent_questions") or []) + 1
            if q_number % 3 == 0:
                prompt_payload["company_focus_directive"] = (
                    f"THIS IS QUESTION {q_number} — make it an EXPLICIT {company_name} question: "
                    f"about the clients, industries, delivery model, scale, or ways of working at "
                    f"{company_name}, while still assessing a genuine skill of the role. Name "
                    f"{company_name} in the question."
                )
            else:
                prompt_payload["company_focus_directive"] = (
                    f"THIS IS QUESTION {q_number} — make it a COMPANY-NEUTRAL role question: a strong, "
                    f"standard question for this role that does NOT mention {company_name} at all."
                )
        else:
            prompt_payload["company_focus_directive"] = ""

        # Same lesson as company-focus pacing above, applied to the resume
        # ratio: a purely descriptive "ground roughly 1 in 5 questions in the
        # resume" line in company.txt was NOT reliably followed (testing a
        # 10-question JD+resume interview found 0 resume-grounded questions,
        # not the ~2 expected) - the model can't self-regulate an advisory
        # ratio any better here than it could for company mentions. Decide it
        # deterministically by position instead: exactly 1 in 5 (20%).
        resume_text_val = (context_dict.get("resume_text") or "").strip()
        if interview_type == "company" and resume_text_val:
            q_number = len(context_dict.get("recent_questions") or []) + 1
            if q_number % 5 == 0:
                prompt_payload["resume_focus_directive"] = (
                    f"THIS IS QUESTION {q_number} — make it a RESUME-GROUNDED question. This does NOT "
                    f"replace this turn's MANDATORY JD skill (rule 1) - COMBINE them: ask about the "
                    f"mandatory skill AS APPLIED to a specific project, technology, or employer named "
                    f"in the CANDIDATE RESUME above (e.g. \"in your [resume project], how did you "
                    f"handle [mandatory skill]...\"). Only if the resume genuinely has nothing "
                    f"relevant to that skill, ground it in the resume some other way instead - do not "
                    f"skip the resume grounding for this question."
                )
            else:
                prompt_payload["resume_focus_directive"] = (
                    f"THIS IS QUESTION {q_number} — make it a PURE JD question: do NOT reference the "
                    f"candidate's resume, past projects, or employers at all."
                )
        else:
            prompt_payload["resume_focus_directive"] = ""

        prompt_payload["question_style_directive"] = question_style_directive(
            len(context_dict.get("recent_questions") or []) + 1,
            context_dict.get("difficulty"),
            # Per-interview seed so the structure rotation differs across
            # subjects / companies / candidates, not just across turns.
            seed=session_id or "|".join([
                prompt_payload["subject"], prompt_payload["company"],
                prompt_payload["role"], prompt_payload["candidate_name"],
            ]),
            recent_questions=context_dict.get("recent_questions"),
        )
        # Depth/coverage guidance, kept as a separate variable (not baked into
        # company.txt/subject_<x>.txt as static text) specifically so an Easy
        # turn's prompt never contains the Medium/Hard "cover implementation,
        # not just definitions" language at all - see depth_specific_rules'
        # docstring for why a carve-out on static text didn't work in practice.
        prompt_payload["depth_specific_rules"] = depth_specific_rules(
            context_dict.get("difficulty"),
            question_type_variety=(interview_type == "company"),
        )

        # hr.txt has no session/memory to rotate scenario types with (this is the
        # stateless context-dict path), so without an explicit per-turn assignment
        # the LLM defaults to STAR/behavioral every time and never reaches
        # situational or direct questions. Compute the same deterministic rotation
        # hr_behavioral_agent.generate_question() uses for the stateful path, and
        # hand it to hr.txt as a REQUIRED directive instead of a menu of options.
        #
        # Adaptive HR engine: the rotation candidate list is additionally filtered
        # to whatever scenario types fit the CURRENT STAGE of the interview arc
        # (Introduction -> Background -> Resume -> Project -> Behavioral ->
        # Collaboration -> Ownership -> JD Alignment -> Company Fit -> Motivation
        # -> Closing), computed as a percentage of total_questions - not a fixed
        # question number - so a 5-question and a 20-question HR drive both get a
        # recruiter-shaped arc scaled to their own length. Falls back to the
        # original unfiltered rotation whenever total_questions is unknown (older
        # callers) or the stage/tier intersection is empty, so this is additive,
        # not a replacement for the existing mechanism.
        scenario_type_hint = ""
        scenario_mode = ""
        hr_stage = ""
        evidence_board: dict[str, str] = {}
        if interview_type == "hr":
            from interview_agents.agents.hr_behavioral_agent import (
                DIFFICULTY_SCENARIO_MAP,
                SCENARIO_TYPES,
                _scenario_mode,
            )
            turn = len(recent_questions_list)
            total_questions = context_dict.get("total_questions")
            hr_stage = _hr_progress_stage(turn, total_questions)
            # Free to recompute - stage is a pure function of (turn, total_questions),
            # so "what stage was the previous turn in" needs no stored history at all.
            previous_hr_stage = _hr_progress_stage(turn - 1, total_questions) if turn > 0 else ""
            logger.info(
                "[HR_STAGE] turn=%d total_questions=%s stage=%s previous_stage=%s",
                turn, total_questions, hr_stage, previous_hr_stage,
            )

            if turn == 0:
                scenario_type_hint = "introduction"
            else:
                eligible = DIFFICULTY_SCENARIO_MAP.get(
                    context_dict.get("difficulty") or DifficultyLevel.MEDIUM.value, SCENARIO_TYPES
                )
                stage_candidates = _HR_STAGE_SCENARIOS.get(hr_stage, [])
                stage_filtered = [s for s in eligible if s in stage_candidates] or eligible

                # Recruiter Evidence Board (Phase 2/3/7/8): recomputed fresh every
                # turn from conversation_history already in hand - no new storage,
                # no new query. Narrows the existing stage+difficulty candidate list
                # further, toward whichever tracked competency is weakest, with the
                # target company's own priorities (if any) breaking ties. Falls back
                # to the unweighted stage_filtered list whenever nothing in it maps
                # to the weakest competency - this is a preference, never a
                # replacement for the existing rotation.
                evidence_board = _hr_evidence_board(context_dict.get("conversation_history"))
                # Phase 5/7: two turns in a row with no usable evidence means
                # retrying the same competency a third time isn't working -
                # steer away from it instead of hammering the same ground.
                _unproductive_streak = _hr_consecutive_unproductive_turns(
                    context_dict.get("conversation_history")
                )
                _avoid_competency = (
                    _hr_last_targeted_competency(context_dict.get("conversation_history"))
                    if _unproductive_streak >= 2 else None
                )
                weakest_competency = _hr_weakest_competency(
                    evidence_board, context_dict.get("company") or "", exclude=_avoid_competency
                )
                if _avoid_competency:
                    logger.info(
                        "[HR_DECISION] unproductive_streak=%d avoiding_competency=%s",
                        _unproductive_streak, _avoid_competency,
                    )
                # CLOSING is exempt from competency-gap filtering: "personality" (one of
                # its two candidates) maps to the Culture Fit competency, so if Culture
                # Fit were ever weakest this would knock "closing" out of its own final
                # turn and force a reflective question where a wrap-up belongs (Phase 10 -
                # gap-filling happens in the stages BEFORE closing, never on the closing
                # turn itself).
                competency_filtered = (
                    [s for s in stage_filtered if _HR_SCENARIO_TO_COMPETENCY.get(s) == weakest_competency]
                    if weakest_competency and hr_stage != "CLOSING" else []
                )
                final_candidates = competency_filtered or stage_filtered
                reason = (
                    "evidence-board" if competency_filtered
                    else "stage+difficulty" if stage_filtered is not eligible
                    else "difficulty-only (no stage overlap)"
                )
                offset = hash(session_id or "hr-stateless")
                scenario_type_hint = final_candidates[(turn + offset) % len(final_candidates)]
                logger.info(
                    "[EVIDENCE_BOARD] %s | weakest=%s",
                    ", ".join(f"{k}={v}" for k, v in evidence_board.items()), weakest_competency or "(none)",
                )
                logger.info(
                    "[HR_DECISION] stage=%s difficulty=%s candidates=%s -> %s (%s)",
                    hr_stage, context_dict.get("difficulty"), final_candidates, scenario_type_hint, reason,
                )
            scenario_mode = _scenario_mode(scenario_type_hint)
            logger.info("[COMPETENCY_SELECTED] %s (mode=%s, stage=%s)", scenario_type_hint, scenario_mode, hr_stage)
        prompt_payload["scenario_type_hint"] = scenario_type_hint
        prompt_payload["scenario_mode"] = scenario_mode
        prompt_payload["hr_stage"] = hr_stage
        prompt_payload["hr_stage_tone"] = _HR_STAGE_TONE.get(hr_stage, "")

        # A passive "ground this in the resume if you can" paragraph buried mid-prompt
        # got ignored in testing - the model kept writing generic questions even for
        # resume-eligible categories with a real resume in context. Compute an explicit
        # per-turn directive instead (same fix that worked for scenario rotation above)
        # and surface it right next to the REQUIRED scenario line, not lower down.
        resume_directive = ""
        if interview_type == "hr":
            _RESUME_ELIGIBLE_TYPES = {
                "experience_project", "achievement", "initiative",
                "introduction", "strengths_weaknesses",
            }
            resume_text_val = (context_dict.get("resume_text") or "").strip()
            resume_confidence = _hr_resume_confidence(resume_text_val) if resume_text_val else "low"
            if resume_text_val and scenario_type_hint in _RESUME_ELIGIBLE_TYPES:
                resume_directive = (
                    "MANDATORY: The candidate's resume is provided below. You MUST name a "
                    "SPECIFIC project, technology, company/organization, or role taken "
                    "directly from it inside the question text itself. A generic version of "
                    "this question that could apply to any candidate is NOT acceptable this turn."
                )
                # Phase 6: resume confidence shades HOW deep to go, reusing this same
                # directive slot - no new prompt line needed for it.
                if resume_confidence == "high":
                    resume_directive += (
                        " This resume detail looks well-substantiated (specific, quantified, or "
                        "role-backed) - it's fair to ask a genuinely deep, probing question about it."
                    )
                elif resume_confidence == "low":
                    resume_directive += (
                        " This resume detail is vague or generic - ask an EXPLORATORY question to find "
                        "out what real experience actually backs it up, rather than assuming deep expertise."
                    )
                # Phase 5: business impact layer, reusing the same slot - only for the
                # two scenario types where a project/achievement is actually being discussed.
                if scenario_type_hint in ("experience_project", "achievement"):
                    resume_directive += (
                        " If it fits naturally, also touch on the real-world impact of this work - who "
                        "benefited, what measurably improved, or how success was actually measured."
                    )
            elif resume_text_val:
                resume_directive = "No resume was reference-eligible for this question type - use a realistic generic scenario instead."
            else:
                resume_directive = "No resume was provided - use a realistic generic scenario."
            logger.info(
                "[RESUME_CONTEXT_USED] resume_present=%s eligible_type=%s confidence=%s",
                bool(resume_text_val), scenario_type_hint in _RESUME_ELIGIBLE_TYPES, resume_confidence,
            )
        prompt_payload["resume_directive"] = resume_directive

        # Adaptive HR engine, part 2: JD-gap priority and answer-reactive follow-up.
        # Both are pure functions over data already in context_dict/conversation_history
        # - no new LLM call, no new DB/Redis query, no new agent (see the two helper
        # functions above this class for the full reasoning).
        # Conversation State Engine (Phase 2): classify the immediately-preceding
        # turn ONCE here, and feed that single classification into every
        # downstream conversational function below - nothing may independently
        # re-derive "what did the candidate just say" from conversation_history,
        # which is what previously let a blank/failed turn get silently skipped
        # over in favor of an older real answer (see audit).
        last_state, last_answer, last_score = _hr_last_turn(
            context_dict.get("conversation_history")
        )
        if last_state:
            logger.info(
                "[HR_STATE] state=%s word_count=%d score=%s",
                last_state, len(last_answer.split()) if last_answer else 0, last_score,
            )

        jd_gap_directive = ""
        adaptive_followup_note = ""
        if interview_type == "hr":
            job_description_val = context_dict.get("job_description") or ""
            # Only surface the JD-gap nudge during the stage actually meant for it -
            # forcing it onto every turn would crowd out resume/behavioral grounding.
            if hr_stage == "JD_ALIGNMENT":
                jd_gap_directive = _hr_jd_gap_directive(
                    job_description_val, resume_text_val, recent_questions_list,
                )
            logger.info(
                "[JD_CONTEXT_USED] jd_present=%s stage=%s gap_found=%s",
                bool(job_description_val), hr_stage, bool(jd_gap_directive),
            )
            if hr_stage == "CLOSING":
                # Phase 9: the closing turn reuses this same slot for a
                # reality-based coverage directive instead of the normal
                # answer-reactive note - see _hr_closing_reality_directive.
                # evidence_board was already computed above (scenario
                # selection block) for this same turn - reused here, not
                # recomputed, and only ever read, never mutated.
                adaptive_followup_note = _hr_closing_reality_directive(
                    context_dict.get("conversation_history"), evidence_board
                )
            else:
                adaptive_followup_note = _hr_adaptive_followup_note(
                    last_state, last_answer, last_score
                )
        prompt_payload["jd_gap_directive"] = jd_gap_directive
        prompt_payload["adaptive_followup_note"] = adaptive_followup_note

        # Recruiter-conversation layer: a short acknowledgement of the previous
        # answer, plus a bridging sentence when the stage just changed, so the
        # response reads as a conversation rather than a list of questions.
        # Both empty on turn 0 (nothing to acknowledge yet - that turn gets its
        # own greeting treatment in hr.txt instead).
        stage_transition_note = ""
        acknowledgement_hint = ""
        answer_intent = ""
        if interview_type == "hr" and turn > 0:
            stage_transition_note = _hr_stage_transition_note(previous_hr_stage, hr_stage)
            # _HR_STAGE_TRANSITIONS text is written as "Acknowledge their answer,
            # then..." - a direct instruction that contradicted (and in testing,
            # reliably overrode) the "do NOT acknowledge" rule for a turn with no
            # real answer. There is nothing to acknowledge for these states, so
            # the transition note itself must be suppressed, not just described
            # as skippable elsewhere in the prompt - two conflicting instructions
            # in the same prompt is what produced the hallucinated acknowledgement
            # in the first place (see Reality-Based Conversation Engine audit).
            if last_state in (
                HR_STATE_NO_RESPONSE, HR_STATE_TECHNICAL_FAILURE,
                HR_STATE_LOW_CONFIDENCE, HR_STATE_PARTIAL,
            ):
                stage_transition_note = ""
            acknowledgement_hint = _hr_acknowledgement_hint(last_state, last_answer, last_score)
            answer_intent = _hr_detect_answer_intent(last_state, last_answer)
            logger.info(
                "[HR_DECISION] transition=%r acknowledgement=%s intent=%s",
                stage_transition_note[:60] if stage_transition_note else "(same stage)",
                acknowledgement_hint or "(none)", answer_intent or "(none)",
            )
        prompt_payload["stage_transition_note"] = stage_transition_note
        prompt_payload["acknowledgement_hint"] = acknowledgement_hint
        prompt_payload["answer_intent"] = answer_intent

        # Long-interview strategy: once a stage spans more than one turn (common
        # past ~15 questions, since there are only 11 stages), go deeper on that
        # theme instead of asking another same-level example. turns_in_stage is
        # recomputed for free - see _hr_turns_in_stage's docstring.
        stage_depth_directive = ""
        if interview_type == "hr":
            turns_in_stage = _hr_turns_in_stage(turn, total_questions, hr_stage)
            stage_depth_directive = _hr_depth_directive(turns_in_stage)
            if turns_in_stage > 1:
                logger.info("[HR_DECISION] turns_in_stage=%d depth_directive=%r", turns_in_stage, stage_depth_directive[:60])
        prompt_payload["stage_depth_directive"] = stage_depth_directive

        # Same lesson as scenario rotation and resume grounding above: a passive
        # "vary your opening phrase" instruction gets ignored turn after turn, so
        # every STAR question starts "Tell me about a time when..." verbatim.
        # Assign a specific opener deterministically per turn instead.
        opener_hint = ""
        if interview_type == "hr":
            _STAR_OPENERS = [
                "Tell me about a time when",
                "Walk me through a specific instance where",
                "Give me an example of a time when",
                "Describe a moment when",
                "Can you share an experience where",
                "What's one time when",
            ]
            _SITUATIONAL_OPENERS = [
                "Suppose", "Imagine", "Let's say", "Picture this:",
            ]
            if scenario_mode == "star":
                idx = (len(recent_questions_list) + hash(session_id or "hr-stateless")) % len(_STAR_OPENERS)
                opener_hint = f'Open the question with "{_STAR_OPENERS[idx]}..." — do not default to "Tell me about a time when" if a different opener was assigned.'
            elif scenario_mode == "situational":
                idx = (len(recent_questions_list) + hash(session_id or "hr-stateless")) % len(_SITUATIONAL_OPENERS)
                opener_hint = f'Open the question with "{_SITUATIONAL_OPENERS[idx]}..." — do not default to "Suppose" if a different opener was assigned.'
        prompt_payload["opener_hint"] = opener_hint

        if self.has_llm:
            try:
                import time as _time
                _hr_t0 = _time.perf_counter() if interview_type == "hr" else None
                actual_prompt_name = prompt_name if prompt_name != "subject_none" else "question_generator.txt"
                result = self.openai_service.generate_structured(
                    actual_prompt_name, prompt_payload, QuestionGenerationResult, subdirectory=subdirectory,
                )
                if interview_type == "hr":
                    # The "no em dash" instruction in hr.txt cuts violations roughly in
                    # half but a smaller model still reaches for one under this exact
                    # "X, Y — how did you Z" construction often enough to matter for a
                    # placement-grade question bank. Enforce it deterministically rather
                    # than keep tuning the prompt for the last few percent.
                    result.question = result.question.replace("—", ",").replace("–", ",")
                    # Deterministic guarantees (Phase 8/9/12 of the Reality-Based
                    # Conversation Engine) - see each function's docstring for why
                    # this can't be left to the prompt instruction alone.
                    result.question = _hr_enforce_no_ack(result.question, last_state, hr_stage)
                    result.question = _hr_enforce_closing_reality(
                        result.question, hr_stage, context_dict.get("conversation_history"),
                        evidence_board if hr_stage == "CLOSING" else None,
                        context_dict.get("company") or "",
                    )
                    result.question = _hr_strip_invented_company(
                        result.question, context_dict.get("company") or ""
                    )

                # Lightweight grounding check, same one-retry pattern as the code-block
                # check below: company_research is the one HR scenario type hr.txt
                # requires to name the real company. Testing found the model sometimes
                # writes "our company" / "the company" instead even when Company Name is
                # provided, so regenerate exactly once with a stronger, explicit note
                # rather than silently accepting the weaker question.
                if (
                    interview_type == "hr"
                    and prompt_payload.get("scenario_type_hint") == "company_research"
                    and prompt_payload.get("company")
                    and prompt_payload["company"].lower() not in result.question.lower()
                ):
                    retry_payload = dict(prompt_payload)
                    retry_payload["strict_grounding_note"] = (
                        f'STRICT REQUIREMENT: the previous draft did not name the company. Your '
                        f'question MUST literally say "{prompt_payload["company"]}" by name, not '
                        f'"the company" or "our company".'
                    )
                    try:
                        retried = self.openai_service.generate_structured(
                            actual_prompt_name, retry_payload, QuestionGenerationResult, subdirectory=subdirectory,
                        )
                        if prompt_payload["company"].lower() in retried.question.lower():
                            result = retried
                    except Exception:
                        logger.warning("HR company-grounding retry failed, keeping original question", exc_info=True)

                # A MEDIUM_CODE shape mandates an embedded ``` snippet, but the model
                # sometimes writes the surrounding ask ("read the following code
                # snippet aloud, identify the bug...") without ever including the
                # snippet - leaving the candidate asked to read something that was
                # never generated. One retry with a sharper reminder; if that still
                # comes back without code, fall back to a verbal-only shape rather
                # than show a question the candidate can't actually act on.
                if _uses_question_style_directive and requires_code_block(prompt_payload.get("question_style_directive", "")) and "```" not in result.question:
                    retry_payload = dict(prompt_payload)
                    retry_payload["question_style_directive"] = (
                        prompt_payload["question_style_directive"]
                        + " REMINDER: your previous attempt described a code snippet without actually "
                        "including one. This response MUST contain a real ``` fenced code block with "
                        "actual code/pseudocode inside the question text itself, not just a description of one."
                    )
                    try:
                        retried = self.openai_service.generate_structured(
                            actual_prompt_name, retry_payload, QuestionGenerationResult, subdirectory=subdirectory,
                        )
                        if "```" in retried.question:
                            result = retried
                        else:
                            verbal_payload = dict(prompt_payload)
                            verbal_payload["question_style_directive"] = _MEDIUM_VERBAL[
                                hash(session_id or "code-fallback") % len(_MEDIUM_VERBAL)
                            ]
                            result = self.openai_service.generate_structured(
                                actual_prompt_name, verbal_payload, QuestionGenerationResult, subdirectory=subdirectory,
                            )
                    except Exception:
                        logger.warning("Code-block retry failed for %s, keeping original response", interview_type, exc_info=True)

                if interview_type == "hr" and _hr_t0 is not None:
                    logger.info("[QUESTION_LATENCY] hr turn total=%.0fms", (_time.perf_counter() - _hr_t0) * 1000)
                    logger.info("[QUESTION_GENERATED] stage=%s scenario=%s q=%r", hr_stage, prompt_payload.get("scenario_type_hint"), result.question[:100])
                return result
            except Exception:
                logger.warning(f"LLM question generation failed for {interview_type}, falling back", exc_info=True)

        recent_questions = context_dict.get("recent_questions", [])
        return self._fallback_question(context_dict, recent_questions, session_id=session_id)

