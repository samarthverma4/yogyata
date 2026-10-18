from __future__ import annotations

import json
import logging

from interview_agents.agents.base import BaseInterviewAgent
from interview_agents.schemas.interview import FollowUpGenerationResult
from interview_agents.utils.enums import DifficultyLevel, QuestionCategory
from interview_agents.utils.json_utils import safe_json_dumps

logger = logging.getLogger(__name__)


class FollowUpQuestionGeneratorAgent(BaseInterviewAgent):
    """Creates a targeted follow-up question for weak or incomplete answers."""

    def generate(
        self,
        session_id: str,
        question: str,
        answer: str,
        evaluation: dict,
        interview_type: str = "subject",
    ) -> FollowUpGenerationResult:
        context = self.memory.get_recent_context(session_id)
        session = self.memory.get_session(session_id)
        
        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "skills": ", ".join(context["skills"]),
            "difficulty": context["difficulty"],
            "question": question,
            "answer": answer,
            "evaluation": json.dumps(evaluation, ensure_ascii=False),
            "recent_questions": safe_json_dumps(context.get("recent_questions", [])),
            "previous_questions": safe_json_dumps(context.get("recent_questions", [])),
            "session_context": safe_json_dumps(context),
            "interview_type": interview_type,
        }

        if self.has_llm:
            try:
                result = self.openai_service.generate_structured(
                    "followup_generator.txt",
                    prompt_payload,
                    FollowUpGenerationResult,
                )
                # Check for duplicates
                if not self.memory.has_asked_question(session_id, result.question):
                    self.memory.mark_question_asked(session_id, result.question)
                    return result
                logger.info(f"Follow-up question already asked, generating fallback for session {session_id}")
            except Exception:
                logger.warning("LLM follow-up generation failed, falling back to heuristic question", exc_info=True)

        weakness = "technical depth" if evaluation.get("technical_score", 0) < 6 else "clarity"
        follow_up_question = self._fallback_follow_up(question, answer, context["role"], context.get("skills", []), weakness)
        return FollowUpGenerationResult(
            question=follow_up_question,
            category=QuestionCategory.TECHNICAL if weakness == "technical depth" else QuestionCategory.PROBLEM_SOLVING,
            difficulty=DifficultyLevel.MEDIUM,
            rationale="Fallback follow-up generated from the evaluation weaknesses.",
        )

    def _fallback_follow_up(self, question: str, answer: str, role: str, skills: list[str], weakness: str) -> str:
        question_text = question.lower()
        answer_text = answer.lower()

        if "normalization" in question_text:
            return "Can you explain the differences between 1NF, 2NF and 3NF?"
        if "hashmap" in question_text or "hashmap" in answer_text or "collision" in answer_text:
            return "How does a HashMap handle collisions, and what are the trade-offs of each method?"
        if "deadlock" in question_text or "deadlock" in answer_text:
            return "How would you detect and resolve a deadlock in an operating system?"
        if "tcp" in question_text or "tcp" in answer_text:
            return "Can you walk through the TCP three-way handshake and how it ensures reliable delivery?"

        skill_focus = skills[0] if skills else role
        if weakness == "technical depth":
            return f"Can you go one level deeper and explain how {skill_focus} works internally in a production setting?"
        return f"Can you clarify your reasoning step by step and show how you would apply it to a {role} scenario?"
