from __future__ import annotations

import json
import logging
from typing import Optional, Any

from interview_agents.agents.base import BaseInterviewAgent
from interview_agents.config.settings import get_settings
from interview_agents.evaluators.scoring import heuristic_evaluate_answer
from interview_agents.schemas.interview import AnswerEvaluationResult
from interview_agents.utils.json_utils import safe_json_dumps
from interview_agents.services.rag.llm_adapter import LLMAdapter

logger = logging.getLogger(__name__)
settings = get_settings()


class AnswerEvaluatorAgent(BaseInterviewAgent):
    """Scores candidate answers using OpenAI, with a deterministic fallback."""

    def evaluate(
        self,
        session_id: str,
        question: str,
        answer: str,
        interview_type: str = "subject",
        expected_answer: Optional[str] = None,
        rubric: Optional[str] = None
    ) -> AnswerEvaluationResult:
        context = self.memory.get_recent_context(session_id)
        session = self.memory.get_session(session_id)
        
        # Get type-specific evaluation criteria
        eval_criteria = {}
        if interview_type == "subject":
            eval_criteria = {
                "technical_knowledge": "depth of understanding",
                "accuracy": "correctness of answer",
                "completeness": "coverage of topic",
            }
        elif interview_type == "verbal":
            eval_criteria = {
                "communication": "clarity and fluency",
                "grammar": "grammatical correctness",
                "vocabulary": "word choice and range",
            }
        elif interview_type == "written":
            eval_criteria = {
                "grammar": "writing grammar",
                "structure": "logical organization",
                "clarity": "clarity of expression",
            }
        elif interview_type == "company":
            eval_criteria = {
                "role_fit": "fit for the position",
                "jd_alignment": "alignment with job description",
                "experience_relevance": "relevance to role",
            }
        elif interview_type == "svar":
            eval_criteria = {
                "pronunciation": "correct pronunciation",
                "vocabulary": "vocabulary usage",
                "fluency": "speech fluency",
            }
        
        # Lookup RAG info from history if not passed
        if not expected_answer or not rubric:
            try:
                rag_history = self.memory.get_rag_history(session_id)
                if rag_history:
                    latest_turn = rag_history[-1]
                    expected_answer = expected_answer or latest_turn.get("expected_answer")
                    rubric = rubric or latest_turn.get("evaluation_rubric")
            except Exception as e:
                logger.warning(f"Failed to lookup RAG info from memory for evaluation: {e}")

        prompt_payload = {
            "candidate_name": context["candidate_name"],
            "role": context["role"],
            "experience": context["experience"],
            "skills": ", ".join(context["skills"]),
            "difficulty": context["difficulty"],
            "question": question,
            "answer": answer,
            "session_context": safe_json_dumps(context),
            "evaluation_criteria": json.dumps(eval_criteria),
        }

        if self.has_llm:
            try:
                # Add expectation context dynamically to user instructions
                user_instruction = "Return only valid JSON."
                if expected_answer:
                    user_instruction += f"\n\n### EXPECTED AUTHORITATIVE CORRECT ANSWER:\n{expected_answer}"
                if rubric:
                    user_instruction += f"\n\n### EVALUATION RUBRIC / REQUIRED KEY CONCEPTS:\n{rubric}"
                
                from interview_agents.utils.prompt_loader import render_prompt
                rendered_prompt = render_prompt('answer_evaluator', prompt_payload)
                
                adapter = LLMAdapter(self.openai_service)
                result = adapter.generate_structured(
                    system_instruction="You are a precise production AI interviewer. Evaluate the answer strictly matching against correct retrieved technical knowledge.",
                    user_prompt=f"{user_instruction}\n\n{rendered_prompt}",
                    response_model=AnswerEvaluationResult
                )
                return self._normalize_result(result, interview_type)
            except Exception:
                logger.warning("LLM evaluation failed, falling back to heuristic scoring", exc_info=True)

        heuristic_result = heuristic_evaluate_answer(question, answer, context["role"], context.get("skills", []), context["experience"])
        return self._normalize_result(heuristic_result, interview_type)

    def _normalize_result(self, result: AnswerEvaluationResult, interview_type: str) -> AnswerEvaluationResult:
        scores = [
            result.technical_score,
            result.communication_score,
            result.relevance_score,
            result.problem_solving_score,
            result.completeness_score,
        ]
        if result.overall_score == 0:
            result.overall_score = int(round(sum(scores) / len(scores)))

        # grammar/vocabulary derive from communication_score for every interview
        # type (parity with the non-avatar flow, which always stores them
        # regardless of type) - reusing the same already-computed score, no
        # extra LLM call.
        result.grammar_score = result.communication_score
        result.vocabulary_score = min(10, result.communication_score + 1)
        if interview_type == "written":
            result.content_structure_score = result.relevance_score
            result.accuracy_score = result.overall_score
        elif interview_type == "company":
            result.accuracy_score = result.relevance_score
        elif interview_type == "svar":
            result.pronunciation_score = result.communication_score
            result.correctness_score = result.overall_score
            result.accuracy_score = result.relevance_score

        result.follow_up_needed = result.follow_up_needed or result.overall_score < settings.interview_success_threshold or result.completeness_score < 6
        return result

    def evaluate_from_context(
        self,
        question: str,
        answer: str,
        interview_type: str,
        difficulty: str | None = None,
        context_dict: dict[str, Any] | None = None,
        expected_answer: Optional[str] = None,
        rubric: Optional[str] = None
    ) -> AnswerEvaluationResult:
        """Evaluate an answer using raw context dict (for GLAMIS stateless calls)."""
        if context_dict is None:
            context_dict = {}

        eval_criteria = {}
        if interview_type == "subject":
            eval_criteria = {
                "technical_knowledge": "depth of understanding",
                "accuracy": "correctness of answer",
                "completeness": "coverage of topic",
            }
        elif interview_type == "verbal":
            eval_criteria = {
                "communication": "clarity and fluency",
                "grammar": "grammatical correctness",
                "vocabulary": "word choice and range",
            }
        elif interview_type == "written":
            eval_criteria = {
                "grammar": "writing grammar",
                "structure": "logical organization",
                "clarity": "clarity of expression",
            }
        elif interview_type == "company":
            eval_criteria = {
                "role_fit": "fit for the position",
                "jd_alignment": "alignment with job description",
                "experience_relevance": "relevance to role",
            }
        elif interview_type == "svar":
            eval_criteria = {
                "pronunciation": "correct pronunciation",
                "vocabulary": "vocabulary usage",
                "fluency": "speech fluency",
            }

        prompt_payload = {
            "candidate_name": context_dict.get("candidate_name") or "Candidate",
            "role": context_dict.get("role") or context_dict.get("job_title") or "",
            "experience": context_dict.get("experience") or "",
            "skills": ", ".join(context_dict.get("skills", [])) if isinstance(context_dict.get("skills"), list) else context_dict.get("skills") or "",
            "difficulty": difficulty or context_dict.get("difficulty") or "Medium",
            "question": question,
            "answer": answer,
            "session_context": safe_json_dumps(context_dict),
            "evaluation_criteria": json.dumps(eval_criteria),
        }

        # Lookup expected answer/rubric from context_dict if passed
        expected_answer = expected_answer or context_dict.get("expected_answer")
        rubric = rubric or context_dict.get("evaluation_rubric") or context_dict.get("rubric")

        if self.has_llm:
            try:
                user_instruction = "Return only valid JSON."
                if expected_answer:
                    user_instruction += f"\n\n### EXPECTED AUTHORITATIVE CORRECT ANSWER:\n{expected_answer}"
                if rubric:
                    user_instruction += f"\n\n### EVALUATION RUBRIC / REQUIRED KEY CONCEPTS:\n{rubric}"

                from interview_agents.utils.prompt_loader import render_prompt
                rendered_prompt = render_prompt('answer_evaluator', prompt_payload)
                
                adapter = LLMAdapter(self.openai_service)
                result = adapter.generate_structured(
                    system_instruction="You are a precise production AI interviewer. Evaluate the answer strictly matching against correct retrieved technical knowledge.",
                    user_prompt=f"{user_instruction}\n\n{rendered_prompt}",
                    response_model=AnswerEvaluationResult
                )
                return self._normalize_result(result, interview_type)
            except Exception:
                logger.warning("LLM evaluation failed, falling back to heuristic scoring", exc_info=True)

        heuristic_result = heuristic_evaluate_answer(
            question,
            answer,
            context_dict.get("role") or "Candidate",
            context_dict.get("skills") or [],
            context_dict.get("experience") or ""
        )
        return self._normalize_result(heuristic_result, interview_type)
