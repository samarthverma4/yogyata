"""
HR / Behavioral Interview Agent — covers three question modes:
  - STAR (past-experience stories: conflict, leadership, failure, teamwork, ...)
  - Situational (hypothetical "how would you handle..." scenarios)
  - Direct (introduction, education, strengths/weaknesses, company research,
    career goals, salary expectations, closing, personality)
Each mode has its own evaluation rubric/prompt (see _scenario_mode / hr_evaluate*.txt).
"""
from __future__ import annotations

import logging
from typing import Any

from interview_agents.agents.base_child_agent import BaseChildAgent
from interview_agents.schemas.agent_schemas import HREvaluationResult, HRQuestionResult
from interview_agents.schemas.interview import QuestionGenerationResult
from interview_agents.utils.enums import DifficultyLevel, QuestionCategory
from interview_agents.utils.json_utils import safe_json_dumps

logger = logging.getLogger(__name__)

# STAR-shaped: real past-experience stories, scored on the 6-dimension STAR rubric.
STAR_SCENARIO_TYPES = [
    "conflict_resolution", "leadership", "failure_learning", "teamwork",
    "achievement", "adaptability", "pressure_handling", "communication",
    "initiative", "ethics", "time_management", "experience_project",
]

# Hypothetical "how would you handle..." scenarios: problem solving / communication /
# professionalism / ownership, scored via hr_evaluate_situational.txt.
SITUATIONAL_SCENARIO_TYPES = ["situational"]

# Direct, non-story HR questions: clarity / specificity / genuineness / relevance,
# scored via hr_evaluate_direct.txt.
DIRECT_SCENARIO_TYPES = [
    "introduction", "education_choice", "strengths_weaknesses",
    "company_research", "career_goals", "salary_expectations", "closing",
    "personality",
]

SCENARIO_TYPES = STAR_SCENARIO_TYPES + SITUATIONAL_SCENARIO_TYPES + DIRECT_SCENARIO_TYPES

# Which scenario types are appropriate at each difficulty tier, per the platform's
# Beginner/Intermediate/Advanced category guidance.
DIFFICULTY_SCENARIO_MAP: dict[str, list[str]] = {
    "Easy": [
        "introduction", "strengths_weaknesses", "education_choice",
        "experience_project", "company_research", "teamwork", "adaptability",
        "personality",
    ],
    "Medium": [
        "teamwork", "conflict_resolution", "time_management", "career_goals",
        "communication", "initiative", "adaptability", "situational",
        "experience_project", "company_research", "personality",
    ],
    "Hard": [
        "leadership", "ethics", "salary_expectations", "failure_learning",
        "achievement", "pressure_handling", "situational", "closing",
        "conflict_resolution", "personality",
    ],
}

_REFRAME_PREFIXES = [
    "Let's try a different example — ",
    "Thinking of another instance — ",
    "In a separate situation — ",
    "Consider another case — ",
    "Looking at this from a fresh angle — ",
]


def _scenario_mode(scenario_type: str) -> str:
    if scenario_type in SITUATIONAL_SCENARIO_TYPES:
        return "situational"
    if scenario_type in DIRECT_SCENARIO_TYPES:
        return "direct"
    return "star"


FALLBACK_QUESTIONS: dict[str, dict[str, list[str]]] = {
    "conflict_resolution": {
        "Easy": [
            "Tell me about a time you had a disagreement with a classmate during a group project. How did you handle it?",
            "Describe a time you disagreed with a friend or teammate about how to approach a task. What did you do?",
        ],
        "Medium": [
            "Describe a situation where you had a conflict with a team member during an internship or project. What steps did you take to resolve it?",
            "Tell me about a time you disagreed with a colleague's approach on a project. How did you reach a resolution?",
        ],
        "Hard": [
            "Tell me about the most difficult interpersonal conflict you have faced. How did you navigate it while maintaining professional relationships and achieving the goal?",
            "Describe a conflict with a senior colleague or manager where you still believed you were right. How did you handle it professionally?",
        ],
    },
    "leadership": {
        "Easy": [
            "Describe a time when you took charge of a group project or activity.",
            "Tell me about a time you volunteered to lead something, even informally.",
        ],
        "Medium": [
            "Tell me about a time you led a team through a challenging situation. What was your approach?",
            "Describe a time you had to motivate a team that was losing momentum. What did you do?",
        ],
        "Hard": [
            "Describe a time when you had to lead a team through a major setback or failure. What specifically did you do and what was the measurable outcome?",
            "Tell me about a time you had to lead people who did not report to you. How did you gain their buy-in?",
        ],
    },
    "failure_learning": {
        "Easy": [
            "Tell me about a time you made a mistake in your studies. What did you learn from it?",
            "Describe a small mistake you made recently. How did you fix it?",
        ],
        "Medium": [
            "Describe a project or task that did not go as planned. What went wrong and what did you learn?",
            "Tell me about a time you underestimated how long something would take. What happened?",
        ],
        "Hard": [
            "Tell me about your biggest professional or academic failure. How did you take responsibility, and what concrete changes did you make as a result?",
            "Describe a time a decision you made caused real harm to a project or team. How did you own it and recover?",
        ],
    },
    "teamwork": {
        "Easy": [
            "Describe a group project you worked on. What was your role and how did the team function?",
            "Tell me about a time you helped a teammate who was struggling.",
        ],
        "Medium": [
            "Tell me about a time when you had to work with a difficult team member to achieve a common goal.",
            "Describe a time your team had very different opinions on how to proceed. How did you align everyone?",
        ],
        "Hard": [
            "Describe a situation where your team was underperforming and you had to step in. What specifically did you do and what was the result?",
            "Tell me about a time you had to rebuild trust within a team after something went wrong.",
        ],
    },
    "achievement": {
        "Easy": [
            "What is your proudest academic achievement and why?",
            "Tell me about something you built or accomplished on your own that you're proud of.",
        ],
        "Medium": [
            "Tell me about a significant achievement you accomplished that required sustained effort over time.",
            "Describe an achievement where you had to push past a setback to get there.",
        ],
        "Hard": [
            "Describe your most impactful achievement — ideally with a quantifiable result. What was the challenge, your specific contribution, and the measurable outcome?",
            "Tell me about an achievement that changed how others on your team or in your organization worked.",
        ],
    },
    "adaptability": {
        "Easy": [
            "Tell me about a time you had to learn something new quickly for a class or project.",
            "Describe a time your plans changed at the last minute. How did you adjust?",
        ],
        "Medium": [
            "Describe a situation where plans changed suddenly and you had to adapt. How did you respond?",
            "Tell me about a time you had to switch tools, technologies, or approaches mid-project.",
        ],
        "Hard": [
            "Tell me about a time you were asked to take on a completely unfamiliar responsibility with minimal guidance. How did you handle it and what was the result?",
            "Describe a time a major change in priorities forced you to abandon significant work. How did you respond?",
        ],
    },
    "pressure_handling": {
        "Easy": [
            "How do you manage stress during exam season?",
            "Tell me about a time you felt overwhelmed with work. What did you do?",
        ],
        "Medium": [
            "Tell me about a time you had multiple deadlines at once. How did you prioritize and manage your time?",
            "Describe a situation where something went wrong right before a deadline. How did you handle the pressure?",
        ],
        "Hard": [
            "Describe a high-stakes situation where you had to deliver results under extreme time pressure. What was your strategy and what was the outcome?",
            "Tell me about a time you had to make a critical decision quickly, with incomplete information, under pressure.",
        ],
    },
    "communication": {
        "Easy": [
            "Tell me about a time you had to explain something complex to someone who didn't understand it initially.",
            "Describe a time you had to give instructions to someone and make sure they understood.",
        ],
        "Medium": [
            "Describe a situation where you had to present an idea to a group. How did you prepare and how was it received?",
            "Tell me about a time your first explanation didn't land and you had to try a different approach.",
        ],
        "Hard": [
            "Tell me about a time when poor communication caused a significant problem. What was your role, how did you identify it, and how did you fix it?",
            "Describe a time you had to deliver difficult or unwelcome information to someone. How did you approach it?",
        ],
    },
    "initiative": {
        "Easy": [
            "Give an example of a time you went beyond what was required for a class assignment.",
            "Tell me about a time you noticed something that needed fixing and did it without being asked.",
        ],
        "Medium": [
            "Tell me about a time you identified a problem and took initiative to solve it without being asked.",
            "Describe a time you proposed a new idea or process improvement. What happened?",
        ],
        "Hard": [
            "Describe a time you identified a significant opportunity or gap and took independent action to address it. What was the measurable impact?",
            "Tell me about a time you took a risk by acting without explicit approval because you believed it was the right call.",
        ],
    },
    "ethics": {
        "Easy": [
            "Tell me about a time you had to make a choice between what was easy and what was right.",
            "Describe a time you were tempted to cut corners but chose not to.",
        ],
        "Medium": [
            "Describe a situation where you faced an ethical dilemma. How did you handle it?",
            "Tell me about a time you saw someone else act unethically. What did you do?",
        ],
        "Hard": [
            "Tell me about a time when doing the right thing put you at a disadvantage personally or professionally. What did you do and why?",
            "Describe a time you had to push back on a request from someone senior to you because it felt wrong.",
        ],
    },
    "time_management": {
        "Easy": [
            "How do you usually plan your week when you have several assignments due?",
            "Tell me about a time you had to juggle coursework and another commitment.",
        ],
        "Medium": [
            "Tell me about a time you had multiple project deadlines in the same week. How did you prioritize?",
            "Describe a time poor time management caused a problem for you. What did you change afterward?",
        ],
        "Hard": [
            "Describe a time you had to manage competing priorities from multiple stakeholders with conflicting deadlines. How did you resolve it?",
            "Tell me about a time you had to say no to a request because of time constraints. How did you handle that conversation?",
        ],
    },
    "experience_project": {
        "Easy": [
            "Tell me about a project or internship you worked on. What was your role?",
            "Walk me through a project you're proud of and what you specifically contributed.",
        ],
        "Medium": [
            "Tell me about the most technically or logistically challenging project you've worked on. What made it hard?",
            "Describe a project where the requirements changed partway through. How did you handle it?",
        ],
        "Hard": [
            "Walk me through a project where your individual contribution directly changed the outcome. What was the measurable impact?",
            "Tell me about a project you would do very differently if you started it again today. What would you change and why?",
        ],
    },
    "situational": {
        "Easy": [
            "Suppose you realize you're going to miss a deadline by a day. What would you do?",
            "Imagine a teammate isn't pulling their weight on a group project. How would you handle it?",
        ],
        "Medium": [
            "Suppose you discover a mistake in work you already submitted to your manager. What would you do?",
            "Imagine a customer or client is upset about a delay that wasn't your fault. How would you respond?",
        ],
        "Hard": [
            "Suppose you're leading a project and realize halfway through that the original plan won't work, but your manager is attached to it. What would you do?",
            "Imagine you discover a colleague made an error that could affect a client, but they've asked you not to mention it. How would you handle this?",
        ],
    },
    "introduction": {
        "Easy": [
            "Tell me about yourself.",
            "Walk me through your background in a couple of minutes.",
        ],
        "Medium": [
            "Tell me about yourself, and how your background has prepared you for this role.",
            "Give me a quick walkthrough of your journey so far and why you're here today.",
        ],
        "Hard": [
            "In two minutes, tell me about yourself and make the case for why you're the right fit for this specific role.",
            "Tell me about yourself, focusing on the experiences most relevant to this position.",
        ],
    },
    "education_choice": {
        "Easy": [
            "Why did you choose your degree or field of study?",
            "What made you interested in this field in the first place?",
        ],
        "Medium": [
            "Why did you choose your degree, and how has it shaped the kind of work you want to do?",
            "Looking back, what about your education has been most useful for the role you're applying to?",
        ],
        "Hard": [
            "Why did you choose your degree, and if you could restart your education knowing what you know now, what would you change?",
            "How has your academic background specifically prepared you for the challenges of this role?",
        ],
    },
    "strengths_weaknesses": {
        "Easy": [
            "What would you say are your greatest strengths?",
            "What's one area you'd like to improve on?",
        ],
        "Medium": [
            "What are your greatest strengths and weaknesses, and how do they show up in your work?",
            "Why should we hire you over other candidates?",
        ],
        "Hard": [
            "What's a weakness you've actively worked to improve, and what tangible progress have you made?",
            "What's your biggest strength, and can you give a specific example where it made a measurable difference?",
        ],
    },
    "company_research": {
        "Easy": [
            "What do you know about our company?",
            "Why are you interested in this company specifically?",
        ],
        "Medium": [
            "What do you know about our company, and why does that make you want to work here?",
            "What recent news or development about our company stood out to you, and why?",
        ],
        "Hard": [
            "Based on what you know about our company's strategy and challenges, where do you see the biggest opportunity for you to contribute?",
            "How does our company's direction align with your own career goals, specifically?",
        ],
    },
    "career_goals": {
        "Easy": [
            "Where do you see yourself in the next few years?",
            "What are you hoping to get out of this role?",
        ],
        "Medium": [
            "Where do you see yourself in five years, and how does this role fit into that plan?",
            "What kind of work do you want to be doing a few years from now, and why?",
        ],
        "Hard": [
            "Walk me through your career plan for the next five years and how this specific role advances it.",
            "How do your long-term career goals align with what this role and company can realistically offer you?",
        ],
    },
    "salary_expectations": {
        "Easy": [
            "What are your salary expectations for this role?",
            "Do you have a compensation range in mind for this position?",
        ],
        "Medium": [
            "What are your salary expectations, and how did you arrive at that number?",
            "How flexible are you on compensation, and what matters most to you in an offer?",
        ],
        "Hard": [
            "Walk me through how you researched and arrived at your salary expectations for this role and market.",
            "If our offer came in below your expectation but with stronger growth potential, how would you think about it?",
        ],
    },
    "closing": {
        "Easy": [
            "Do you have any questions for me?",
            "Is there anything else you'd like me to know about you?",
        ],
        "Medium": [
            "Do you have any questions about the role or the team?",
            "Is there anything we haven't covered that you think is important for us to know?",
        ],
        "Hard": [
            "Based on our conversation today, do you have any concerns about this role that you'd like to address before we wrap up?",
            "What would you need to see in the next steps of this process to be confident this is the right role for you?",
        ],
    },
    "personality": {
        "Easy": [
            "How would your friends or classmates describe you in three words?",
            "Are you more of a team player, or do you prefer working independently?",
        ],
        "Medium": [
            "How do you usually handle stress or criticism?",
            "What motivates you to do your best work?",
        ],
        "Hard": [
            "How do you adjust your communication style when working with very different personalities on a team?",
            "What personality trait of yours do you think could work against you in a professional setting, and how do you manage it?",
        ],
    },
}


class HRBehavioralAgent(BaseChildAgent):
    """HR and behavioral interview agent covering STAR, situational, and direct
    HR question modes (see SCENARIO_TYPES / DIFFICULTY_SCENARIO_MAP)."""

    def generate_question(self, session_id: str, **kwargs) -> QuestionGenerationResult:
        context = self.memory.get_recent_context(session_id)
        # Widened from 5: over a long interview the rotation naturally cycles back
        # through the same eligible scenario types (DIFFICULTY_SCENARIO_MAP has as few
        # as 8-11 entries per tier), and a 5-question lookback let near-identical STAR
        # "teammate disagreement" framings recur well before that. A wider window costs
        # a few hundred extra prompt tokens but meaningfully cuts repetition.
        recent_questions = self.memory.get_previous_question_texts(session_id, limit=10)
        questions_asked = int(context.get("questions_asked", 0))
        weak_areas = self.memory.get_weak_areas(session_id, top_n=3)
        difficulty = context.get("difficulty", "Medium")

        eligible = DIFFICULTY_SCENARIO_MAP.get(difficulty, SCENARIO_TYPES)

        if questions_asked == 0:
            # Real interviews open with an introduction question regardless of the
            # configured difficulty tier — it's always an appropriate opener.
            scenario_type = "introduction"
        else:
            # Prioritize weak scenario types that are still appropriate at this
            # difficulty; otherwise rotate through the eligible set.
            weak_scenarios = [k for k in weak_areas if k in eligible]
            if weak_scenarios:
                scenario_type = weak_scenarios[0]
            else:
                # Per-session offset: without it every fresh session's turn 1 (no
                # weak areas identified yet) always got the same scenario.
                offset = hash(session_id)
                scenario_type = eligible[(questions_asked + offset) % len(eligible)]

        resume_text = (context.get("resume_text") or "").strip()
        company = str(kwargs.get("company") or "").strip() or str(context.get("company") or "").strip()
        position = str(kwargs.get("position") or "").strip() or str(context.get("job_title") or "").strip()
        job_description = (
            str(kwargs.get("job_description") or kwargs.get("jd_details") or "").strip()
            or str(context.get("jd_details") or "").strip()
        )
        resume_context = (
            f"CANDIDATE RESUME (ground this question in it when the scenario type allows —\n"
            f"e.g. ask about a specific project, tool, or role named below instead of a generic\n"
            f"example — but do NOT force it onto scenario types where it doesn't fit):\n{resume_text[:3000]}"
            if resume_text
            else "No resume was provided for this candidate — use generic, role-appropriate scenarios."
        )

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "skills": ", ".join(context["skills"]),
            "difficulty": difficulty,
            "recent_questions": safe_json_dumps(recent_questions),
            "weak_areas": ", ".join(weak_areas.keys()) if weak_areas else "none identified yet",
            "scenario_type_hint": scenario_type,
            "scenario_mode": _scenario_mode(scenario_type),
            "company": company,
            "position": position,
            "job_description": job_description,
            "resume_context": resume_context,
            "strict_grounding_note": "",
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "hr_question",
                    prompt_payload,
                    HRQuestionResult,
                    subdirectory="agents",
                )
                # Lightweight grounding check, not a redesign: company_research is the
                # one scenario type the prompt explicitly requires to name the real
                # company. If the model dodged it with "our company" / "the company",
                # regenerate exactly once with a stronger, explicit instruction rather
                # than silently accepting a weaker question.
                if (
                    company
                    and scenario_type == "company_research"
                    and company.lower() not in result.question.lower()
                ):
                    logger.info("HR company-grounding retry triggered (company=%r missing from draft)", company)
                    try:
                        retry_payload = dict(prompt_payload)
                        retry_payload["strict_grounding_note"] = (
                            f'STRICT REQUIREMENT: the previous draft did not name the company. '
                            f'Your question MUST literally say "{company}" by name — not '
                            f'"the company" or "our company".'
                        )
                        retried = self.openai_service.generate_structured(
                            "hr_question",
                            retry_payload,
                            HRQuestionResult,
                            subdirectory="agents",
                        )
                        if company.lower() in retried.question.lower():
                            logger.info("HR company-grounding retry succeeded")
                            result = retried
                        else:
                            logger.info("HR company-grounding retry still missing company name; keeping original")
                    except Exception:
                        logger.warning("HR company-grounding retry failed; keeping original question", exc_info=True)
                if not self.memory.has_asked_question(session_id, result.question):
                    self.memory.mark_question_asked(session_id, result.question)
                    return QuestionGenerationResult(
                        question=result.question,
                        category=QuestionCategory.BEHAVIORAL,
                        difficulty=DifficultyLevel(result.difficulty),
                        rationale=result.rationale,
                        scenario_type=result.scenario_type or scenario_type,
                    )
            except Exception:
                logger.warning("HRBehavioralAgent question generation failed, using fallback", exc_info=True)

        fallback = self._fallback_question(scenario_type, context, questions_asked, session_id)
        try:
            self.memory.mark_question_asked(session_id, fallback.question)
        except Exception:
            pass
        return fallback

    def evaluate(self, session_id: str, question: str, answer: str, **kwargs) -> HREvaluationResult:
        context = self.memory.get_recent_context(session_id)
        scenario_type = kwargs.get("scenario_type", "general")

        # A follow-up answer is a continuation of the same story, not a fresh one.
        # Score it merged with the original Q&A instead of judging it alone against the
        # full 6-dimension rubric, which unfairly tanks scores for narrow, targeted probes.
        if kwargs.get("is_follow_up") and kwargs.get("parent_question") and kwargs.get("parent_answer"):
            merged = self._evaluate_followup(session_id, question, answer, context, scenario_type, kwargs)
            if merged is not None:
                return merged
            # LLM merge unavailable or failed — fall through to standalone evaluation below.

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "difficulty": context["difficulty"],
            "scenario_type": scenario_type,
            "question": question,
            "answer": answer,
        }

        prompt_name = {
            "situational": "hr_evaluate_situational",
            "direct": "hr_evaluate_direct",
        }.get(_scenario_mode(scenario_type), "hr_evaluate")

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    prompt_name,
                    prompt_payload,
                    HREvaluationResult,
                    subdirectory="agents",
                )
                self._track_performance(session_id, result, scenario_type)
                return result
            except Exception:
                logger.warning("HRBehavioralAgent evaluation failed, using fallback", exc_info=True)

        return self._fallback_evaluate(question, answer, context)

    def _evaluate_followup(
        self,
        session_id: str,
        question: str,
        answer: str,
        context: dict[str, Any],
        scenario_type: str,
        kwargs: dict[str, Any],
    ) -> HREvaluationResult | None:
        if not self.has_llm:
            return None

        parent_evaluation = kwargs.get("parent_evaluation") or {}
        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "difficulty": context["difficulty"],
            "scenario_type": scenario_type,
            "original_question": kwargs.get("parent_question", ""),
            "original_answer": kwargs.get("parent_answer", ""),
            "original_star_completeness": parent_evaluation.get("star_completeness", ""),
            "followup_question": question,
            "followup_answer": answer,
        }

        try:
            result = self.openai_service.generate_structured(
                "hr_evaluate_followup",
                prompt_payload,
                HREvaluationResult,
                subdirectory="agents",
            )
        except Exception:
            logger.warning("HRBehavioralAgent follow-up merge evaluation failed, using standard evaluation", exc_info=True)
            return None

        result.supersedes_question_id = kwargs.get("parent_question_id")
        self._track_performance(session_id, result, scenario_type)
        return result

    def should_follow_up(self, evaluation_result: HREvaluationResult) -> bool:
        # Follow up if Result (R) was missing or Action was vague
        return evaluation_result.follow_up_needed or evaluation_result.result_quantification < 5

    def generate_followup(self, session_id: str, question: str, answer: str, evaluation: dict[str, Any], **kwargs) -> QuestionGenerationResult | None:
        star_completeness = evaluation.get("star_completeness", "")
        improvement_tip = evaluation.get("improvement_tip", "")
        probe_target = (evaluation.get("probe_target") or "").strip()

        if probe_target:
            followup = probe_target if probe_target.endswith("?") else f"{probe_target}?"
        elif "R✗" in star_completeness or "result" in star_completeness.lower():
            followup = "You described the situation and actions well, but I did not hear a clear result. What was the actual outcome? Was it measurable — for example, did it improve a grade, save time, or resolve the conflict permanently?"
        elif "A✗" in star_completeness or "action" in star_completeness.lower():
            followup = "Can you be more specific about what YOU personally did in that situation? Walk me through the exact steps you took, one by one."
        elif "T✗" in star_completeness or "task" in star_completeness.lower():
            followup = "What specifically was YOUR responsibility in that situation? What were you expected to deliver or achieve?"
        else:
            followup = f"Can you elaborate further? Specifically: {improvement_tip}" if improvement_tip else "Can you give more details about the specific actions you took and the outcome?"

        return QuestionGenerationResult(
            question=followup,
            category=QuestionCategory.BEHAVIORAL,
            difficulty=DifficultyLevel(evaluation.get("difficulty", "Medium")),
            rationale="Content-specific probe grounded in the candidate's answer" if probe_target else "STAR follow-up targeting missing component",
        )

    def _track_performance(self, session_id: str, result: HREvaluationResult, scenario_type: str) -> None:
        try:
            if result.result_quantification < 5:
                self.memory.update_weak_areas(session_id, "STAR Result")
            if result.action_specificity < 5:
                self.memory.update_weak_areas(session_id, "STAR Action")
            if result.overall_score < 6:
                self.memory.update_weak_areas(session_id, scenario_type)
            if result.overall_score >= 7:
                self.memory.update_strong_areas(session_id, "Behavioral Interviews")
        except Exception:
            pass

    def _fallback_question(
        self, scenario_type: str, context: dict[str, Any], questions_asked: int = 0, session_id: str | None = None,
    ) -> QuestionGenerationResult:
        difficulty = context.get("difficulty", "Medium")
        bank = FALLBACK_QUESTIONS.get(scenario_type, FALLBACK_QUESTIONS["teamwork"])
        variants = bank.get(difficulty) or bank.get("Medium") or ["Tell me about a relevant experience."]

        question = variants[0]
        if session_id:
            try:
                unused = [q for q in variants if not self.memory.has_asked_question(session_id, q)]
                if unused:
                    question = unused[0]
                else:
                    # Every stock variant for this scenario+difficulty was already asked
                    # this session — reframe instead of ever repeating the exact text.
                    base = variants[questions_asked % len(variants)]
                    prefix = _REFRAME_PREFIXES[questions_asked % len(_REFRAME_PREFIXES)]
                    question = prefix + base[0].lower() + base[1:]
            except Exception:
                pass

        return QuestionGenerationResult(
            question=question,
            category=QuestionCategory.BEHAVIORAL,
            difficulty=DifficultyLevel(difficulty),
            rationale=f"Fallback HR question for {scenario_type} scenario",
            scenario_type=scenario_type,
        )

    def _fallback_evaluate(self, question: str, answer: str, context: dict[str, Any]) -> HREvaluationResult:
        words = answer.split()
        word_count = len(words)
        answer_lower = answer.lower()

        has_situation = any(w in answer_lower for w in ["when", "time", "situation", "once", "during", "while"])
        has_action = any(w in answer_lower for w in ["i did", "i decided", "i took", "i worked", "i helped", "i led", "i created"])
        has_result = any(w in answer_lower for w in ["result", "outcome", "achieved", "improved", "success", "finally", "eventually", "as a result"])

        situation_clarity = 7 if has_situation else 4
        task_definition = 6
        action_specificity = 7 if has_action else 3
        result_quantification = 6 if has_result else 2
        self_awareness = 5
        communication_structure = 6 if word_count >= 40 else 3

        overall = int(round((situation_clarity + task_definition + action_specificity + result_quantification + self_awareness + communication_structure) / 6))

        missing = []
        star_parts = []
        star_parts.append("S✓" if has_situation else "S✗")
        star_parts.append("T?")
        star_parts.append("A✓" if has_action else "A✗")
        star_parts.append("R✓" if has_result else "R✗")
        if not has_result:
            missing.append("Missing: quantified result (R)")
        if not has_action:
            missing.append("Missing: specific personal actions (A)")

        red_flags = []
        if word_count < 10:
            red_flags.append(f"Very short answer ({word_count} words) — too brief to assess")

        return HREvaluationResult(
            situation_clarity=situation_clarity,
            task_definition=task_definition,
            action_specificity=action_specificity,
            result_quantification=result_quantification,
            self_awareness=self_awareness,
            communication_structure=communication_structure,
            overall_score=overall,
            feedback="Ensure your answer follows the STAR format: Situation → Task → Action → Result.",
            strengths=["Clear situation context"] if has_situation else [],
            weaknesses=missing,
            follow_up_needed=not has_result or action_specificity < 5,
            star_completeness=" ".join(star_parts),
            improvement_tip="Always end your STAR answer with a specific, measurable result — even if it is 'the team submitted the project on time and received an A grade'.",
            red_flags=red_flags,
        )
