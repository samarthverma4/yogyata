"""
Psychometric Interview Agent — workplace personality, behavioral, and
situational-judgment assessment across the 10 golden pillars.

Sourcing: the ephemeral, per-batch admin bank lives in the Node backend's
MongoDB (a different database from this agent's own `glamis` session store —
see psychometricQuestionBank.models.js), so this agent never queries it
directly. Node selects the next unused bank question (if any) and passes it
in as `bank_question`; this agent only has to fall back to LLM generation
when that's absent. This keeps the two services' data ownership boundaries
intact instead of adding a second, competing Mongo connection here.

Scoring is deterministic wherever possible (candidate picks a fixed option,
the option already carries its pillar score from generation time) — the LLM
is only invoked to judge the one free-text response type, open_ended. This
keeps trait scores reproducible instead of subject to LLM variance across a
report's radar chart.

NEVER generates follow-up questions or adjusts "difficulty" — this is a
trait assessment via 100% manual on-screen choices, not a skill assessment.
"""
from __future__ import annotations

import logging
from typing import Any

from interview_agents.agents.base_child_agent import BaseChildAgent
from interview_agents.schemas.agent_schemas import (
    PsychometricEvaluationResult,
    PsychometricOpenEndedJudgment,
    PsychometricOption,
    PsychometricQuestionResult,
)
from interview_agents.schemas.interview import DifficultyAdjustmentResult
from interview_agents.utils.enums import DifficultyLevel, PsychometricPillar, PsychometricResponseType
from interview_agents.utils.json_utils import safe_json_dumps

logger = logging.getLogger(__name__)

# Deterministic round-robin so all 10 pillars get even coverage across a
# session without needing any new persistent per-pillar tracking state.
PILLAR_ORDER: list[PsychometricPillar] = list(PsychometricPillar)

# Response types cycle too, so a session isn't e.g. all Likert scales.
RESPONSE_TYPE_ORDER: list[PsychometricResponseType] = list(PsychometricResponseType)

FALLBACK_OPTIONS: dict[str, list[dict[str, Any]]] = {
    "likert": [
        {"id": "1", "label": "Strongly Disagree", "score": 2},
        {"id": "2", "label": "Disagree", "score": 4},
        {"id": "3", "label": "Neutral", "score": 5},
        {"id": "4", "label": "Agree", "score": 7},
        {"id": "5", "label": "Strongly Agree", "score": 9},
    ],
    "yes_no": [
        {"id": "yes", "label": "Yes", "score": 8},
        {"id": "no", "label": "No", "score": 3},
    ],
    "true_false": [
        {"id": "true", "label": "True", "score": 8},
        {"id": "false", "label": "False", "score": 3},
    ],
}


class PsychometricAgent(BaseChildAgent):
    """Psychometric assessment agent — ephemeral bank first, LLM fallback, no follow-ups."""

    # ── Question generation ─────────────────────────────────────────────

    def generate_question(self, session_id: str, **kwargs) -> PsychometricQuestionResult:
        bank_question = kwargs.get("bank_question")
        if bank_question:
            return self._from_bank_question(session_id, bank_question)

        # Node's real interview flow calls GLAMIS statelessly per question
        # (like every other type here) — it keeps conversation_history itself
        # and resends it each turn rather than GLAMIS holding a Mongo
        # session. session_id is only non-empty when called through the
        # separate stateful /glamis/* surface. Both paths are supported:
        # with a session, dedup is a persistent hash check; without one,
        # "don't repeat" relies on the LLM prompt seeing conversation_history,
        # same as every other stateless agent here.
        conversation_history = kwargs.get("conversation_history") or []
        if session_id:
            context = self.memory.get_recent_context(session_id)
            recent_questions = self.memory.get_previous_question_texts(session_id, limit=5)
            candidate_name = context.get("candidate_name", "Candidate")
        else:
            candidate_name = kwargs.get("candidate_name", "Candidate")
            recent_questions = [
                m.get("question") for m in conversation_history if m.get("question")
            ][-5:]

        question_number = int(kwargs.get("question_number") or len(recent_questions) + 1)
        # Node generates a fresh random seed per ATTEMPT (see
        # createInterviewByPsychometricAdmin), not per interview/candidate -
        # without this, the round-robin is 100% deterministic from
        # question_number alone, so every candidate on every drive saw the
        # identical question 1 ("communication" + "likert"), and retaking the
        # same interview during testing reproduced it too. Different offsets
        # for pillar vs. response_type (x7 mod) so they don't shift in
        # lockstep and repeat the same pairings shuffled. Full pillar/type
        # coverage per 10/13 questions is unaffected — this only rotates
        # *where in the cycle* an attempt starts.
        seed = kwargs.get("seed")
        pillar_offset = (seed % len(PILLAR_ORDER)) if seed else 0
        response_type_offset = ((seed * 7) % len(RESPONSE_TYPE_ORDER)) if seed else 0
        pillar = kwargs.get("pillar") or PILLAR_ORDER[(question_number - 1 + pillar_offset) % len(PILLAR_ORDER)]
        response_type = kwargs.get("response_type") or RESPONSE_TYPE_ORDER[(question_number - 1 + response_type_offset) % len(RESPONSE_TYPE_ORDER)]
        if isinstance(pillar, str):
            pillar = PsychometricPillar(pillar)
        if isinstance(response_type, str):
            response_type = PsychometricResponseType(response_type)

        # The pillar round-robin repeats every 10 questions, but recent_questions
        # above only looks back 5 - so a repeated pillar's prior question has
        # already scrolled out of view by the time it comes back around in any
        # session longer than 10 questions, and nothing stopped the LLM from
        # asking a near-rephrase of it under a different response_type (observed
        # in practice: two "value of analyzing options before deciding" questions
        # 10 apart, one importance-scale, one likert). Filtering the FULL
        # conversation_history by pillar (Node tags each turn with the pillar it
        # was generated for - see saveQuestionAndReturn) catches this regardless
        # of how many turns have passed since.
        same_pillar_questions = [
            m.get("question") for m in conversation_history
            if m.get("question") and m.get("pillar") == pillar.value
        ]

        prompt_payload = {
            "candidate_name": candidate_name,
            "pillar": pillar.value,
            "response_type": response_type.value,
            "recent_questions": safe_json_dumps(recent_questions),
            "same_pillar_questions": safe_json_dumps(same_pillar_questions) if same_pillar_questions else "(none yet)",
            # Rotating the pillar/response_type combo alone (above) doesn't
            # stop the model converging on the same textbook phrasing for a
            # GIVEN combo across separate attempts, since each attempt's
            # conversation_history starts empty with no memory of the last
            # one. This explicit per-attempt tag is the only signal that
            # varies run-to-run for an otherwise-identical prompt.
            "variation_tag": f"assessment-variant-{seed}" if seed else "default",
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "psychometric_question",
                    prompt_payload,
                    PsychometricQuestionResult,
                    subdirectory="agents",
                )
                if not session_id or not self.memory.has_asked_question(session_id, result.question):
                    result.source = "llm"
                    if session_id:
                        self.memory.mark_question_asked(session_id, result.question)
                    return result
            except Exception:
                logger.warning("PsychometricAgent question generation failed, using fallback", exc_info=True)

        fallback = self._fallback_question(pillar, response_type)
        if session_id:
            try:
                self.memory.mark_question_asked(session_id, fallback.question)
            except Exception:
                pass
        return fallback

    def _from_bank_question(self, session_id: str, bank_question: dict[str, Any]) -> PsychometricQuestionResult:
        options = [
            PsychometricOption(
                id=str(opt.get("id") or opt.get("_id") or idx),
                label=opt.get("label", ""),
                score=int(opt.get("score", 0)),
            )
            for idx, opt in enumerate(bank_question.get("options") or [])
        ]
        result = PsychometricQuestionResult(
            question=bank_question["text"],
            pillar=PsychometricPillar(bank_question["pillar"]),
            secondary_pillars=[PsychometricPillar(p) for p in bank_question.get("secondary_pillars") or []],
            response_type=PsychometricResponseType(bank_question["response_type"]),
            options=options,
            scenario_context=bank_question.get("scenario_context", ""),
            rationale="Sourced from admin-uploaded batch question bank.",
            source="bank",
        )
        if session_id:
            try:
                self.memory.mark_question_asked(session_id, result.question)
            except Exception:
                pass
        return result

    def _fallback_question(
        self, pillar: PsychometricPillar, response_type: PsychometricResponseType
    ) -> PsychometricQuestionResult:
        options_data = FALLBACK_OPTIONS.get(response_type.value, FALLBACK_OPTIONS["likert"])
        return PsychometricQuestionResult(
            question=f"I consistently demonstrate strong {pillar.value.replace('_', ' ')} in my work.",
            pillar=pillar,
            secondary_pillars=[],
            response_type=(
                response_type
                if response_type.value in FALLBACK_OPTIONS
                else PsychometricResponseType.LIKERT
            ),
            options=[PsychometricOption(**opt) for opt in options_data],
            scenario_context="",
            rationale=f"Fallback {pillar.value} self-assessment question.",
            source="llm",
        )

    # ── Evaluation ───────────────────────────────────────────────────────

    def evaluate(self, session_id: str, question: str, answer: str, **kwargs) -> PsychometricEvaluationResult:
        pillar = kwargs.get("pillar", PsychometricPillar.COMMUNICATION.value)
        response_type = kwargs.get("response_type", PsychometricResponseType.LIKERT.value)
        options = kwargs.get("options") or []

        if response_type == PsychometricResponseType.OPEN_ENDED.value:
            score, feedback = self._evaluate_open_ended(pillar, question, answer)
        else:
            score = self._score_from_options(response_type, options, answer)
            feedback = "Response recorded."

        result = PsychometricEvaluationResult(
            pillar_scores={pillar: score},
            overall_score=score,
            feedback=feedback,
            consistency_flag=self._check_consistency(session_id, pillar, score),
            follow_up_needed=False,
        )
        return result

    def _evaluate_open_ended(self, pillar: str, question: str, answer: str) -> tuple[int, str]:
        if self.has_llm:
            try:
                judgment = self.openai_service.generate_structured(
                    "psychometric_evaluate_open_ended",
                    {"pillar": pillar, "question": question, "answer": answer},
                    PsychometricOpenEndedJudgment,
                    subdirectory="agents",
                )
                return judgment.score, judgment.feedback
            except Exception:
                logger.warning("PsychometricAgent open_ended evaluation failed, using fallback", exc_info=True)

        word_count = len(answer.split())
        score = 6 if word_count > 15 else (4 if word_count > 5 else 2)
        return score, "Fallback evaluation based on response length only."

    @staticmethod
    def _score_from_options(response_type: str, options: list[dict[str, Any]], answer: str) -> int:
        """Deterministic scoring: look up the candidate's selection(s) in the
        question's own option scores (set at generation time), never re-judged
        by an LLM at evaluation time."""
        if not options:
            return 5

        by_id = {str(opt.get("id")): opt for opt in options}

        if response_type == PsychometricResponseType.MULTIPLE_SELECT.value:
            selected_ids = [s.strip() for s in answer.split(",") if s.strip()]
            scores = [int(by_id[sid]["score"]) for sid in selected_ids if sid in by_id]
            return round(sum(scores) / len(scores)) if scores else 5

        if response_type == PsychometricResponseType.RANKING.value:
            candidate_order = [s.strip() for s in answer.split(",") if s.strip()]
            ideal_order = sorted(options, key=lambda o: int(o.get("score", 0)))
            ideal_ids = [str(o.get("id")) for o in ideal_order]
            n = len(ideal_ids)
            if not candidate_order or len(candidate_order) != n:
                return 5
            # Sum of |ideal position - candidate position| per item (footrule
            # distance). Normalized against the worst possible case for n
            # items — a fully reversed order — so the result is a stable 0-10
            # scale regardless of how many items this question ranks.
            total_distance = sum(
                abs(ideal_ids.index(cid) - pos) if cid in ideal_ids else n
                for pos, cid in enumerate(candidate_order)
            )
            worst_case = sum(abs(i - (n - 1 - i)) for i in range(n)) or 1
            return max(0, round(10 * (1 - total_distance / worst_case)))

        # Single-selection types (likert/frequency/agreement/importance/
        # multiple_choice/forced_choice/sjt/scenario_rating/yes_no/true_false)
        selected = answer.strip()
        if selected in by_id:
            return int(by_id[selected]["score"])
        return 5

    def _check_consistency(self, session_id: str, pillar: str, score: int) -> bool:
        """Flags this answer if it swings sharply from the candidate's own
        recent average on the same pillar — feeds the report's Authenticity
        Meter. Heuristic, not a hard fraud signal. No-op without a session —
        the stateless call path (real Node traffic) has no answer history to
        compare against here; Node resends conversation_history itself but
        not structured per-pillar scores, so this only activates on the
        stateful /glamis/* surface."""
        if not session_id:
            return False
        try:
            recent_answers = self.memory.get_recent_answers(session_id, limit=6)
            pillar_scores = [
                a.evaluation_json["pillar_scores"][pillar]
                for a in recent_answers
                if a.evaluation_json and pillar in (a.evaluation_json.get("pillar_scores") or {})
            ]
            if len(pillar_scores) < 2:
                return False
            avg = sum(pillar_scores) / len(pillar_scores)
            return abs(score - avg) >= 5
        except Exception:
            return False

    # ── No follow-ups, no difficulty adjustment ─────────────────────────

    def should_follow_up(self, evaluation_result: PsychometricEvaluationResult) -> bool:
        return False

    def generate_followup(self, session_id: str, question: str, answer: str, evaluation: dict[str, Any], **kwargs):
        return None

    def adjust_difficulty(
        self, session_id: str, evaluation: dict[str, Any], current_difficulty: str
    ) -> DifficultyAdjustmentResult:
        return DifficultyAdjustmentResult(
            difficulty=DifficultyLevel(current_difficulty.capitalize()) if current_difficulty else DifficultyLevel.MEDIUM,
            action="maintain",
            reason="Psychometric assessments score fixed traits, not adjustable skill difficulty.",
        )
