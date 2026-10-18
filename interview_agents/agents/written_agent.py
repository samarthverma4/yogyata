"""
Written Interview Agent — assesses business English writing: emails, paragraphs, essays.
Always generates a follow-up to show corrected/improved sample.
"""
from __future__ import annotations

import logging
from typing import Any

from interview_agents.agents.base_child_agent import BaseChildAgent
from interview_agents.schemas.agent_schemas import WrittenEvaluationResult, WrittenQuestionResult
from interview_agents.schemas.interview import QuestionGenerationResult
from interview_agents.utils.enums import DifficultyLevel, QuestionCategory
from interview_agents.utils.json_utils import safe_json_dumps

logger = logging.getLogger(__name__)

TASK_TYPES = ["paragraph", "email", "essay", "letter", "report"]


class WrittenAgent(BaseChildAgent):
    """Written communication interview agent for placement written rounds."""

    def generate_question(self, session_id: str, **kwargs) -> QuestionGenerationResult:
        context = self.memory.get_recent_context(session_id)
        recent_questions = self.memory.get_previous_question_texts(session_id, limit=5)
        questions_asked = int(context.get("questions_asked", 0))
        # Per-session offset: without it every fresh session's turn 1 always
        # got "paragraph".
        offset = hash(session_id)
        task_type = TASK_TYPES[(questions_asked + offset) % len(TASK_TYPES)]

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "difficulty": context["difficulty"],
            "recent_questions": safe_json_dumps(recent_questions),
            "task_type_hint": task_type,
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "written_question",
                    prompt_payload,
                    WrittenQuestionResult,
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
                logger.warning("WrittenAgent question generation failed, using fallback", exc_info=True)

        fallback = self._fallback_question(context, questions_asked)
        try:
            self.memory.mark_question_asked(session_id, fallback.question)
        except Exception:
            pass
        return fallback

    def evaluate(self, session_id: str, question: str, answer: str, **kwargs) -> WrittenEvaluationResult:
        context = self.memory.get_recent_context(session_id)
        words = answer.split()
        word_count = len(words)
        task_type = kwargs.get("task_type", "paragraph")

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "difficulty": context["difficulty"],
            "question": question,
            "answer": answer,
            "task_type": task_type,
            "word_limit": kwargs.get("word_limit", 150),
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "written_evaluate",
                    prompt_payload,
                    WrittenEvaluationResult,
                    subdirectory="agents",
                )
                self._track_performance(session_id, result)
                return result
            except Exception:
                logger.warning("WrittenAgent evaluation failed, using fallback", exc_info=True)

        return self._fallback_evaluate(answer, context)

    def should_follow_up(self, evaluation_result: WrittenEvaluationResult) -> bool:
        # Written always gets a follow-up with corrected sample
        return True

    def generate_followup(self, session_id: str, question: str, answer: str, evaluation: dict[str, Any], **kwargs) -> QuestionGenerationResult | None:
        corrected = evaluation.get("corrected_sample", "")
        weaknesses = evaluation.get("weaknesses", [])
        if not weaknesses:
            return None
        weak_focus = weaknesses[0]
        followup_text = (
            f"Here is a revised version of the key part: \"{corrected}\". "
            f"Now rewrite your previous response focusing on improving: {weak_focus}. "
            f"Keep it within the original word limit."
        )
        return QuestionGenerationResult(
            question=followup_text,
            category=QuestionCategory.BEHAVIORAL,
            difficulty=DifficultyLevel(evaluation.get("difficulty", "Medium")),
            rationale="Written improvement follow-up targeting identified weakness",
        )

    def _track_performance(self, session_id: str, result: WrittenEvaluationResult) -> None:
        try:
            if result.grammar_spelling < 6:
                self.memory.update_weak_areas(session_id, "Grammar and Spelling")
            if result.structure_organization < 6:
                self.memory.update_weak_areas(session_id, "Writing Structure")
            if result.overall_score >= 7:
                self.memory.update_strong_areas(session_id, "Written Communication")
        except Exception:
            pass

    def _fallback_question(self, context: dict[str, Any], questions_asked: int) -> QuestionGenerationResult:
        difficulty = context.get("difficulty", "Medium")
        fallbacks = {
            "Easy": "Write a short paragraph (80–100 words) introducing yourself to a new team at your first job.",
            "Medium": "Write a formal email (100–150 words) to an HR manager thanking them for a job interview and reiterating your interest in the role.",
            "Hard": "Write a structured essay (150–200 words) discussing whether Artificial Intelligence will create more jobs than it eliminates in the next decade. Include your own stance with supporting reasons.",
        }
        question = fallbacks.get(difficulty, fallbacks["Medium"])
        return QuestionGenerationResult(
            question=question,
            category=QuestionCategory.BEHAVIORAL,
            difficulty=DifficultyLevel(difficulty),
            rationale="Fallback written task based on difficulty level",
        )

    def _fallback_evaluate(self, answer: str, context: dict[str, Any]) -> WrittenEvaluationResult:
        words = answer.split()
        word_count = len(words)
        sentences = [s.strip() for s in answer.split(".") if s.strip()]

        task_completion = 8 if word_count >= 80 else 5 if word_count >= 40 else 3
        structure = 7 if len(sentences) >= 4 else 5
        grammar = 6
        clarity = 6
        vocabulary = 5
        argument = 5
        conciseness = 7 if word_count <= 200 else 5

        overall = int(round((task_completion + structure + grammar + clarity + vocabulary + argument + conciseness) / 7))

        return WrittenEvaluationResult(
            grammar_spelling=grammar,
            structure_organization=structure,
            clarity_expression=clarity,
            vocabulary_usage=vocabulary,
            argument_strength=argument,
            conciseness=conciseness,
            task_completion=task_completion,
            overall_score=overall,
            feedback="Fallback evaluation: focus on clear structure (intro-body-conclusion) and formal tone.",
            strengths=["Sufficient length"] if word_count >= 80 else [],
            weaknesses=["Answer too short — expand your response"] if word_count < 80 else [],
            follow_up_needed=True,
            corrected_sample="Ensure your response has a clear opening sentence, 2–3 supporting points, and a closing statement.",
        )
