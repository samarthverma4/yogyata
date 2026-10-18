"""
Verbal Interview Agent — assesses spoken English fluency, grammar, vocabulary, and coherence.
Used for HR verbal rounds in campus placements.
"""
from __future__ import annotations

import logging
from typing import Any

from interview_agents.agents.base_child_agent import BaseChildAgent
from interview_agents.config.settings import get_settings
from interview_agents.schemas.agent_schemas import VerbalEvaluationResult, VerbalQuestionResult
from interview_agents.schemas.interview import QuestionGenerationResult
from interview_agents.services.web_search_service import WebSearchService, build_grounding_block
from interview_agents.utils.enums import DifficultyLevel, QuestionCategory
from interview_agents.utils.json_utils import safe_json_dumps

logger = logging.getLogger(__name__)
_web_search_service = WebSearchService(get_settings())

PROMPT_TYPES = ["situational", "opinion", "explanatory", "descriptive", "persuasive"]

# Topic progression ensures each verbal question covers a genuinely different life/work area
VERBAL_TOPICS = [
    "teamwork and working with others",
    "professional growth and continuous learning",
    "communication and explaining complex ideas",
    "work-life balance and stress management",
    "leadership and taking initiative",
    "handling failures or setbacks",
    "adapting to change or uncertainty",
    "career aspirations and long-term goals",
    "time management and prioritization",
    "giving and receiving feedback",
]


class VerbalAgent(BaseChildAgent):
    """Verbal communication interview agent for placement HR rounds."""

    def generate_question(self, session_id: str, **kwargs) -> QuestionGenerationResult:
        context = self.memory.get_recent_context(session_id)
        recent_questions = self.memory.get_previous_question_texts(session_id, limit=5)

        questions_asked = int(context.get("questions_asked", 0))
        # Per-session offset: without this, every fresh session's turn N always
        # lands on the same PROMPT_TYPES/VERBAL_TOPICS index (turn 0 was always
        # "situational" + "teamwork and working with others" for every single
        # candidate). hash() is stable for the lifetime of this process, which
        # is all that's needed - just varies the starting point per session.
        offset = hash(session_id)
        prompt_type = PROMPT_TYPES[(questions_asked + offset) % len(PROMPT_TYPES)]
        topic_hint = VERBAL_TOPICS[(questions_asked + offset) % len(VERBAL_TOPICS)]

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "difficulty": context["difficulty"],
            "recent_questions": safe_json_dumps(recent_questions),
            "prompt_type_hint": prompt_type,
            "topic_hint": topic_hint,
            "web_context": build_grounding_block(
                _web_search_service,
                "verbal",
                role=context["role"],
                web_search_enabled=bool(kwargs.get("web_search_enabled")),
                # Cache-or-skip: never block question generation on Tavily inline.
                blocking=False,
            ),
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "verbal_question",
                    prompt_payload,
                    VerbalQuestionResult,
                    subdirectory="agents",
                )
                if not self.memory.has_asked_question(session_id, result.question):
                    self.memory.mark_question_asked(session_id, result.question)
                    return QuestionGenerationResult(
                        question=result.question,
                        category=QuestionCategory.BEHAVIORAL,
                        difficulty=DifficultyLevel(result.difficulty),
                        rationale=result.rationale,
                    )
            except Exception:
                logger.warning("VerbalAgent question generation failed, using fallback", exc_info=True)

        fallback = self._fallback_question(context, questions_asked, session_id=session_id)
        try:
            self.memory.mark_question_asked(session_id, fallback.question)
        except Exception:
            pass
        return fallback

    def evaluate(self, session_id: str, question: str, answer: str, **kwargs) -> VerbalEvaluationResult:
        context = self.memory.get_recent_context(session_id)
        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "difficulty": context["difficulty"],
            "question": question,
            "answer": answer,
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "verbal_evaluate",
                    prompt_payload,
                    VerbalEvaluationResult,
                    subdirectory="agents",
                )
                self._track_performance(session_id, result)
                return result
            except Exception:
                logger.warning("VerbalAgent evaluation failed, using fallback", exc_info=True)

        return self._fallback_evaluate(question, answer, context)

    def should_follow_up(self, evaluation_result: VerbalEvaluationResult) -> bool:
        return evaluation_result.follow_up_needed or evaluation_result.overall_score < 7

    def _track_performance(self, session_id: str, result: VerbalEvaluationResult) -> None:
        try:
            if result.grammar_accuracy < 6:
                self.memory.update_weak_areas(session_id, "Grammar")
            if result.fluency < 6:
                self.memory.update_weak_areas(session_id, "Fluency")
            if result.vocabulary_richness < 6:
                self.memory.update_weak_areas(session_id, "Vocabulary")
            if result.overall_score >= 7:
                self.memory.update_strong_areas(session_id, "Verbal Communication")
        except Exception:
            pass

    def _fallback_question(
        self, context: dict[str, Any], questions_asked: int, session_id: str | None = None,
    ) -> QuestionGenerationResult:
        difficulty = context.get("difficulty", "Medium")
        fallbacks = {
            "Easy": [
                "Tell me about yourself in 2–3 sentences.",
                "Describe your college campus and what you like most about it.",
                "What is your favourite subject and why?",
            ],
            "Medium": [
                f"Describe a project you worked on during your studies related to {context.get('role', 'your field')} and what you learned from it.",
                "Tell me about a time you had to work as part of a team. What was your role?",
                "What are your career goals for the next 3 years and how are you preparing for them?",
            ],
            "Hard": [
                "Convince me why you are the best candidate for this role over other applicants.",
                "Explain a complex technical concept from your field to someone with no technical background.",
                "Describe a situation where you had to make a difficult decision under time pressure.",
            ],
        }
        options = fallbacks.get(difficulty, fallbacks["Medium"])
        # Per-session offset - see the matching comment further up this file.
        offset = hash(session_id) if session_id else 0
        question = options[(questions_asked + offset) % len(options)]
        return QuestionGenerationResult(
            question=question,
            category=QuestionCategory.BEHAVIORAL,
            difficulty=DifficultyLevel(difficulty),
            rationale="Fallback verbal question based on difficulty level",
        )

    def _fallback_evaluate(self, question: str, answer: str, context: dict[str, Any]) -> VerbalEvaluationResult:
        words = answer.split()
        word_count = len(words)
        filler_words = {"um", "uh", "like", "basically", "actually", "literally", "you know", "kind of"}
        filler_count = sum(1 for w in words if w.lower() in filler_words)

        fluency = max(0, min(10, 8 - filler_count))
        completeness = 4 if word_count < 20 else 6 if word_count < 50 else 8
        grammar = 6
        coherence = 6 if word_count >= 30 else 4
        vocabulary = 5
        confidence = 6

        overall = int(round((fluency + completeness + grammar + coherence + vocabulary + confidence) / 6))

        return VerbalEvaluationResult(
            grammar_accuracy=grammar,
            vocabulary_richness=vocabulary,
            fluency=fluency,
            coherence=coherence,
            response_completeness=completeness,
            confidence_signal=confidence,
            overall_score=overall,
            feedback="Fallback evaluation: ensure you answer in complete sentences with minimal filler words.",
            strengths=["Attempted the question"] if word_count > 10 else [],
            weaknesses=["Answer too brief"] if word_count < 20 else (["Filler words detected"] if filler_count > 2 else []),
            follow_up_needed=overall < 7,
            improvement_tip="Structure your answer: make one clear point, give a reason, then an example.",
        )
