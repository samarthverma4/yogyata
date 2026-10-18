"""
SVAR Interview Agent — Speech, Verbal, and Reading assessment.
NEVER generates follow-up questions (by design — linear progression only).
Each sub-type (reading, repeating, jumbled, short_question, comprehension) has its own flow.
"""
from __future__ import annotations

import logging
from typing import Any

from interview_agents.agents.base_child_agent import BaseChildAgent
from interview_agents.schemas.agent_schemas import SVAREvaluationResult, SVARQuestionResult
from interview_agents.schemas.interview import DifficultyAdjustmentResult, QuestionGenerationResult
from interview_agents.utils.enums import DifficultyLevel, QuestionCategory
from interview_agents.utils.json_utils import safe_json_dumps

logger = logging.getLogger(__name__)

SVAR_CATEGORIES = {
    "reading": QuestionCategory.SVAR,
    "repeating": QuestionCategory.SVAR,
    "jumbled_sentence": QuestionCategory.SVAR,
    "short_question": QuestionCategory.SVAR,
    "comprehension": QuestionCategory.SVAR,
}

# Fallback question banks per SVAR type and difficulty
FALLBACK_QUESTIONS: dict[str, dict[str, str]] = {
    "reading": {
        "Easy": "Please read the following passage aloud: 'The sun rises in the east and sets in the west. It gives us light and warmth every day.'",
        "Medium": "Please read the following passage aloud: 'Technology has transformed the way people communicate, enabling instant exchange of information across the globe.'",
        "Hard": "Please read the following passage aloud: 'The proliferation of artificial intelligence in contemporary industries necessitates a re-evaluation of workforce competencies and organizational structures.'",
    },
    "repeating": {
        "Easy": "Please repeat the following sentence: 'I enjoy learning new things every day.'",
        "Medium": "Please repeat the following sentence: 'Effective communication is essential for professional success in any organization.'",
        "Hard": "Please repeat the following sentence: 'The implementation of sophisticated algorithms enables automated systems to make complex decisions with remarkable efficiency.'",
    },
    "jumbled_sentence": {
        "Easy": "Arrange these words to form a correct sentence: is / my / name / Rahul",
        "Medium": "Arrange these words to form a correct sentence: hardworking / am / student / I / a / very",
        "Hard": "Arrange these words to form a correct sentence: despite / many / challenges / succeeded / the / team / faced / it",
    },
    "short_question": {
        "Easy": "In 1–2 sentences, tell me: What is your name and which city are you from?",
        "Medium": "In 2–3 sentences, tell me: What are your career goals after completing your degree?",
        "Hard": "In 3 sentences, describe: A challenge you faced in a team project and how you resolved it.",
    },
    "comprehension": {
        "Easy": "Read this passage: 'Ravi woke up early to study for his exam. He made notes and reviewed them twice.' Question: Why did Ravi wake up early?",
        "Medium": "Read this passage: 'Despite facing several setbacks, the startup team continued to iterate on their product based on user feedback, eventually achieving market fit.' Question: What strategy helped the startup succeed?",
        "Hard": "Read this passage: 'The paradox of choice suggests that while freedom of choice is desirable, an overabundance of options can lead to decision paralysis, decreased satisfaction, and increased regret.' Question: What is the central argument of this passage and do you agree with it?",
    },
}


class SVARAgent(BaseChildAgent):
    """SVAR language proficiency interview agent — no follow-ups, strict language evaluation."""

    def generate_question(self, session_id: str, **kwargs) -> QuestionGenerationResult:
        context = self.memory.get_recent_context(session_id)
        session = self.memory.get_session(session_id)
        recent_questions = self.memory.get_previous_question_texts(session_id, limit=5)

        svar_type = getattr(session, "svar_type", None) or kwargs.get("svar_type", "short_question")
        difficulty = context.get("difficulty", "Medium")

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "svar_type": svar_type,
            "difficulty": difficulty,
            "recent_questions": safe_json_dumps(recent_questions),
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "svar_question",
                    prompt_payload,
                    SVARQuestionResult,
                    subdirectory="agents",
                )
                if not self.memory.has_asked_question(session_id, result.question):
                    self.memory.mark_question_asked(session_id, result.question)
                    return QuestionGenerationResult(
                        question=result.question,
                        category=QuestionCategory.SVAR,
                        difficulty=DifficultyLevel(result.difficulty),
                        rationale=result.rationale,
                    )
            except Exception:
                logger.warning("SVARAgent question generation failed, using fallback", exc_info=True)

        fallback = self._fallback_question(svar_type, difficulty)
        try:
            self.memory.mark_question_asked(session_id, fallback.question)
        except Exception:
            pass
        return fallback

    def evaluate(self, session_id: str, question: str, answer: str, **kwargs) -> SVAREvaluationResult:
        context = self.memory.get_recent_context(session_id)
        session = self.memory.get_session(session_id)
        svar_type = getattr(session, "svar_type", None) or "short_question"

        # Get expected answer from stored question metadata if available
        expected_answer = kwargs.get("expected_answer", "")

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "svar_type": svar_type,
            "difficulty": context.get("difficulty", "Medium"),
            "question": question,
            "answer": answer,
            "expected_answer": expected_answer,
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "svar_evaluate",
                    prompt_payload,
                    SVAREvaluationResult,
                    subdirectory="agents",
                )
                # Force follow_up_needed = False — SVAR never has follow-ups
                result.follow_up_needed = False
                self._track_performance(session_id, result)
                return result
            except Exception:
                logger.warning("SVARAgent evaluation failed, using fallback", exc_info=True)

        return self._fallback_evaluate(question, answer, svar_type)

    def should_follow_up(self, evaluation_result: SVAREvaluationResult) -> bool:
        # SVAR NEVER generates follow-ups — this is by design
        return False

    def generate_followup(self, session_id: str, question: str, answer: str, evaluation: dict[str, Any], **kwargs) -> QuestionGenerationResult | None:
        # SVAR never generates follow-ups
        return None

    def adjust_difficulty(self, session_id: str, evaluation: dict[str, Any], current_difficulty: str) -> DifficultyAdjustmentResult:
        # SVAR difficulty is fixed per session — do not adjust dynamically
        from interview_agents.schemas.interview import DifficultyAdjustmentResult
        from interview_agents.utils.enums import DifficultyLevel
        return DifficultyAdjustmentResult(
            difficulty=DifficultyLevel(current_difficulty.capitalize()),
            action="maintain",
            reason="SVAR difficulty is fixed per session type.",
        )

    def _track_performance(self, session_id: str, result: SVAREvaluationResult) -> None:
        try:
            if result.pronunciation_accuracy < 6:
                self.memory.update_weak_areas(session_id, "Pronunciation")
            if result.grammar_correctness < 6:
                self.memory.update_weak_areas(session_id, "Grammar")
            if result.comprehension_accuracy < 6:
                self.memory.update_weak_areas(session_id, "Comprehension")
            if result.overall_score >= 7:
                self.memory.update_strong_areas(session_id, "Language Proficiency")
        except Exception:
            pass

    def _fallback_question(self, svar_type: str, difficulty: str) -> QuestionGenerationResult:
        type_map = FALLBACK_QUESTIONS.get(svar_type, FALLBACK_QUESTIONS["short_question"])
        question = type_map.get(difficulty, type_map["Medium"])
        return QuestionGenerationResult(
            question=question,
            category=QuestionCategory.SVAR,
            difficulty=DifficultyLevel(difficulty),
            rationale=f"Fallback SVAR {svar_type} question",
        )

    def _fallback_evaluate(self, question: str, answer: str, svar_type: str) -> SVAREvaluationResult:
        words = answer.split()
        word_count = len(words)

        pronunciation = 6
        grammar = 6 if word_count > 3 else 3
        vocabulary = 6
        appropriateness = 7 if word_count > 5 else 4
        comprehension = 6

        overall = int(round((pronunciation + grammar + vocabulary + appropriateness + comprehension) / 5))

        return SVAREvaluationResult(
            pronunciation_accuracy=pronunciation,
            grammar_correctness=grammar,
            vocabulary_match=vocabulary,
            response_appropriateness=appropriateness,
            comprehension_accuracy=comprehension,
            overall_score=overall,
            feedback="Fallback SVAR evaluation. Focus on clear pronunciation and complete sentence formation.",
            strengths=["Attempted the task"] if word_count > 3 else [],
            weaknesses=["Response too short"] if word_count <= 3 else [],
            follow_up_needed=False,
            correction="Ensure you answer in complete, grammatically correct sentences.",
        )
