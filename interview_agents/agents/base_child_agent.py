"""
Abstract base class for all interview-type-specific child agents.

Every child agent must implement:
  - generate_question()   → SubjectQuestionResult | VerbalQuestionResult | ...
  - evaluate()            → SubjectEvaluationResult | VerbalEvaluationResult | ...

Optionally override:
  - should_follow_up()    → bool   (default: score < 7 or follow_up_needed)
  - generate_followup()   → QuestionGenerationResult | None
  - adjust_difficulty()   → DifficultyAdjustmentResult
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from interview_agents.evaluators.scoring import heuristic_difficulty_adjustment
from interview_agents.memory.memory_manager import MemoryManager
from interview_agents.schemas.interview import DifficultyAdjustmentResult, QuestionGenerationResult
from interview_agents.services.openai_service import OpenAIService
from interview_agents.utils.json_utils import safe_json_dumps

logger = logging.getLogger(__name__)


class BaseChildAgent(ABC):
    """Shared interface for all interview-type child agents."""

    def __init__(self, openai_service: OpenAIService | None, memory: MemoryManager) -> None:
        self.openai_service = openai_service
        self.memory = memory

    @property
    def has_llm(self) -> bool:
        return self.openai_service is not None

    # ── Must implement ──────────────────────────────────────────────────

    @abstractmethod
    def generate_question(self, session_id: str, **kwargs) -> Any:
        """Generate the next interview question for this type."""

    @abstractmethod
    def evaluate(self, session_id: str, question: str, answer: str, **kwargs) -> Any:
        """Evaluate the candidate's answer and return a typed result."""

    # ── Optional overrides ──────────────────────────────────────────────

    def should_follow_up(self, evaluation_result: Any) -> bool:
        """
        Decide whether a follow-up question is needed.
        Default: follow up if explicit flag is set OR overall_score < 7.
        Override to enforce agent-specific rules (e.g., SVAR never, Written always).
        """
        score = getattr(evaluation_result, "overall_score", 10)
        flag = getattr(evaluation_result, "follow_up_needed", False)
        return bool(flag) or score < 7

    def generate_followup(
        self,
        session_id: str,
        question: str,
        answer: str,
        evaluation: dict[str, Any],
        **kwargs,
    ) -> QuestionGenerationResult | None:
        """
        Generate a follow-up question targeting the identified weakness.
        Return None to skip follow-up (agent will move to next main question).
        Default implementation uses a lightweight LLM prompt if available.
        """
        if not self.has_llm:
            return None

        from interview_agents.utils.answer_validator import is_shallow_answer
        context = self.memory.get_recent_context(session_id)
        weaknesses = evaluation.get("weaknesses", [])
        weakness_text = "; ".join(weaknesses) if weaknesses else "unclear or incomplete answer"
        score = evaluation.get("overall_score", 5)

        # Socratic probe for brief-but-valid answers (F6)
        use_probe = is_shallow_answer(answer, score)
        prompt_key = "socratic_probe" if use_probe else "followup_generator"

        prompt_payload = {
            "question": question,
            "answer": answer,
            "score": score,
            "weakness": weakness_text,
            "role": context.get("role", ""),
            "difficulty": context.get("difficulty", "Medium"),
        }
        if not use_probe:
            prompt_payload["candidate_name"] = context.get("candidate_name", "")
            prompt_payload["experience"] = context.get("experience", "")
            prompt_payload["skills"] = ", ".join(context.get("skills", []))
            prompt_payload["recent_questions"] = safe_json_dumps(
                context.get("recent_questions", [])
            )
            prompt_payload["session_context"] = safe_json_dumps(context)

        try:
            from interview_agents.schemas.interview import FollowUpGenerationResult
            result = self.openai_service.generate_structured(
                prompt_key,
                prompt_payload,
                FollowUpGenerationResult,
                subdirectory="agents" if use_probe else "",
            )
            return QuestionGenerationResult(
                question=result.question,
                category=result.category,
                difficulty=result.difficulty,
                rationale=result.rationale,
            )
        except Exception:
            logger.warning(
                "Follow-up generation failed in %s (probe=%s)",
                self.__class__.__name__,
                use_probe,
                exc_info=True,
            )
            return None

    def adjust_difficulty(
        self,
        session_id: str,
        evaluation: dict[str, Any],
        current_difficulty: str,
    ) -> DifficultyAdjustmentResult:
        """
        Adjust interview difficulty based on recent performance.
        Default: smoothed heuristic using rolling average of last 3 scores.
        Override for type-specific logic.
        """
        overall = evaluation.get("overall_score", 5)

        # Rolling average over last 3 answers for smoother adjustment
        try:
            recent_answers = self.memory.get_recent_answers(session_id, limit=3)
            if len(recent_answers) >= 2:
                scores = [
                    a.evaluation_json.get("overall_score", overall)
                    for a in recent_answers
                    if a.evaluation_json
                ]
                if scores:
                    overall = int(round(sum(scores) / len(scores)))
        except Exception:
            pass

        if self.has_llm:
            try:
                context = self.memory.get_recent_context(session_id)
                from interview_agents.config.settings import get_settings
                result = self.openai_service.generate_structured(
                    "difficulty_controller",
                    {
                        "current_difficulty": current_difficulty,
                        "evaluation": safe_json_dumps(evaluation),
                        "session_context": safe_json_dumps(context),
                    },
                    DifficultyAdjustmentResult,
                )
                return result
            except Exception:
                logger.warning("LLM difficulty adjustment failed, using heuristic", exc_info=True)

        return heuristic_difficulty_adjustment(current_difficulty, overall)
