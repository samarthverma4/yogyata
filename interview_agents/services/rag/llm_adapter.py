import logging
from typing import Dict, Any, List, Optional, Type, TypeVar
from pydantic import BaseModel
from interview_agents.services.openai_service import OpenAIService
from interview_agents.services.rag.context_manager import RAGContext

logger = logging.getLogger(__name__)

ResponseModel = TypeVar("ResponseModel", bound=BaseModel)

class LLMAdapter:
    """The sole adapter class for communication with OpenAI LLM service."""

    def __init__(self, openai_service: Optional[OpenAIService] = None):
        self.openai_service = openai_service

    @property
    def has_llm(self) -> bool:
        if self.openai_service is not None:
            return True
        try:
            from interview_agents.config.settings import get_settings
            return bool(get_settings().openai_api_key)
        except Exception:
            return False

    def _get_service(self) -> OpenAIService:
        if not self.openai_service:
            from interview_agents.config.settings import get_settings
            from interview_agents.services.openai_service import OpenAIService
            self.openai_service = OpenAIService(get_settings())
        return self.openai_service

    def generate_completion(
        self,
        system_instruction: str,
        user_prompt: str,
        response_format: Optional[Dict[str, Any]] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> str:
        if not self.has_llm:
            return "What are the core concepts and trade-offs of this approach?"
        service = self._get_service()
        # max_tokens/temperature are OPTIONAL and additive - every existing
        # caller keeps passing neither, keeping both exactly as before
        # (service.settings.openai_temperature, no output ceiling). Added
        # for services.ingestion.svar_document_extractor: max_tokens
        # because a whole-document JSON response (many questions' worth of
        # fields/evidence/confidence at once) can be far larger than any
        # other caller's typical single-fragment response and was observed
        # truncating the last question(s) at the model's default ceiling;
        # temperature because document UNDERSTANDING/extraction wants
        # consistent, literal results run to run, not creative variance -
        # live-reproduced across repeated identical uploads of the same
        # PDF, where the last table row was inconsistently present or
        # absent from the model's response at the shared default
        # temperature.
        create_kwargs = dict(
            model=service.settings.openai_model,
            temperature=temperature if temperature is not None else service.settings.openai_temperature,
            response_format=response_format or {"type": "text"},
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_prompt},
            ],
        )
        if max_tokens is not None:
            create_kwargs["max_tokens"] = max_tokens
        response = service.client.chat.completions.create(**create_kwargs)
        content = ""
        if hasattr(response, "choices") and response.choices:
            choice = response.choices[0]
            message = getattr(choice, "message", None)
            if isinstance(message, dict):
                content = message.get("content", "")
            else:
                content = getattr(message, "content", "")
        return content

    def generate_structured(
        self,
        system_instruction: str,
        user_prompt: str,
        response_model: Type[ResponseModel],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> ResponseModel:
        if not self.has_llm:
            from interview_agents.schemas.interview import AnswerEvaluationResult
            if response_model == AnswerEvaluationResult:
                return response_model(
                    overall_score=7,
                    technical_score=7,
                    communication_score=7,
                    relevance_score=7,
                    problem_solving_score=7,
                    completeness_score=7,
                    feedback="Mock evaluation.",
                    strengths=["Understanding of basics"],
                    weaknesses=[],
                    follow_up_needed=False
                )
            try:
                return response_model()
            except Exception:
                fields = {}
                for name, field in response_model.model_fields.items():
                    if field.is_required():
                        if field.annotation == int:
                            fields[name] = 5
                        elif field.annotation == str:
                            fields[name] = "Mock"
                        elif field.annotation == bool:
                            fields[name] = False
                        elif getattr(field.annotation, "__origin__", None) is list:
                            fields[name] = []
                        else:
                            fields[name] = None
                return response_model(**fields)

        service = self._get_service()
        raw_response = self.generate_completion(
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
            temperature=temperature,
        )
        from interview_agents.utils.json_utils import extract_json
        parsed = extract_json(raw_response)
        normalized = service._normalize_structured_response(parsed, response_model)
        if hasattr(response_model, "model_validate"):
            return response_model.model_validate(normalized)
        return response_model.parse_obj(normalized)

    def rewrite_question(self, rag_context: RAGContext) -> str:
        """
        Transforms a retrieved knowledge-base chunk into a recruiter-grade,
        scenario-based interview question.

        Key change vs old version:
          - OLD: "Rewrite the question naturally."
          - NEW: "Transform the retrieved FACT into a real-world SCENARIO question."

        This is the single most impactful fix for interview quality: instead of
        asking "What are Validation Rules?", the LLM now produces
        "Suppose sales users should never save Opportunities with a negative
        amount. How would you implement this using Validation Rules?" which is
        what a recruiter actually asks.
        """
        if not self.has_llm:
            return rag_context.selected_question

        difficulty = rag_context.difficulty or "Medium"
        role = rag_context.role or "professional"
        company = rag_context.company or ""
        topic = rag_context.topic or rag_context.subject or ""
        skills = ", ".join(rag_context.skills[:5]) if rag_context.skills else topic
        previous_questions = "\n".join(
            f"- {q}" for q in (rag_context.previous_questions or [])[:8]
        ) or "None"

        # Difficulty-specific scenario depth instruction
        depth_instruction = {
            "Easy":   (
                "Ask a concrete, specific concept question about the retrieved topic. "
                "A brief 'what is X' or 'how does X work' is acceptable at Easy, "
                "but prefer a simple scenario where possible."
            ),
            "Medium": (
                "Build a practical scenario: give a realistic business or technical "
                "situation and ask how the candidate would use the retrieved concept "
                "to solve it. The question should require configuration or design "
                "knowledge, not just recall."
            ),
            "Hard": (
                "Build a production-grade scenario: describe a real-world constraint, "
                "failure, or trade-off and ask how the candidate would design or "
                "troubleshoot using the retrieved concept. The question should require "
                "deep knowledge of edge cases, performance, or security implications."
            ),
        }.get(difficulty, (
            "Build a practical scenario using the retrieved concept. Require "
            "the candidate to apply knowledge, not just define it."
        ))

        system_instruction = (
            f"You are a senior technical recruiter conducting a professional mock interview "
            f"for a {role}{' at ' + company if company else ''} position.\n\n"
            f"You have retrieved a knowledge-base chunk with an authoritative question and answer. "
            f"Your task is to TRANSFORM this retrieved fact into a recruiter-grade interview question.\n\n"
            f"RULES (strictly follow ALL of these):\n"
            f"1. USE the retrieved knowledge as the TOPIC and ANSWER KEY — do NOT contradict it.\n"
            f"2. TRANSFORM it into a {difficulty} difficulty scenario/application question.\n"
            f"3. NEVER output a definition question like 'What is X?' unless difficulty is Easy "
            f"   AND the source chunk is purely definitional with no scenario possible.\n"
            f"4. SCENARIO INSTRUCTION for this {difficulty} question: {depth_instruction}\n"
            f"5. The question must be JD-grounded — it should assess the skill: {skills}.\n"
            f"6. DO NOT repeat or rephrase any of these already-asked questions:\n{previous_questions}\n"
            f"7. Output ONLY the question text. No labels, no JSON, no 'Interviewer:' prefix.\n"
            f"8. Write naturally as a human interviewer speaks — conversational, specific, and professional."
        )

        user_prompt = rag_context.to_prompt_string()
        return self.generate_completion(system_instruction, user_prompt)


    def generate_followup(self, rag_context: RAGContext, follow_up_suggestion: str) -> str:
        """
        Converts a retrieved follow-up suggestion into a conversational question.
        """
        if not self.has_llm:
            return follow_up_suggestion
        system_instruction = (
            "You are conducting a professional mock interview.\n"
            "Based on the candidate's history and the retrieved follow-up suggestion, generate a natural conversational follow-up question.\n"
            "Do NOT invent unrelated concepts or contradict the expected answer key. Use the suggestion directly.\n"
            "Output ONLY the conversational question text without any labels or markdown formatting."
        )
        user_prompt = (
            f"{rag_context.to_prompt_string()}\n"
            f"### Authoritative Follow-up Suggestion to Use:\n"
            f"{follow_up_suggestion}"
        )
        return self.generate_completion(system_instruction, user_prompt)
