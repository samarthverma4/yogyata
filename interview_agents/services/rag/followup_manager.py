import logging
from typing import Dict, Any, List, Optional
from services.retrieval.retriever import Retriever
from services.retrieval.question_selector import QuestionSelector
from interview_agents.services.rag.context_manager import ContextManager, RAGContext
from interview_agents.services.rag.llm_adapter import LLMAdapter

logger = logging.getLogger(__name__)

class FollowupManager:
    """Manages retrieving and generating natural conversational follow-up questions."""

    def __init__(
        self,
        retriever: Retriever,
        question_selector: QuestionSelector,
        context_manager: ContextManager,
        llm_adapter: LLMAdapter
    ):
        self.retriever = retriever
        self.question_selector = question_selector
        self.context_manager = context_manager
        self.llm_adapter = llm_adapter

    def generate_followup(
        self,
        previous_question: str,
        candidate_answer: str,
        evaluation: Dict[str, Any],
        session_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Retrieves matching follow-up candidates, selects one, and converts it conversationally.
        """
        covered_topics = session_context.get("covered_topics") or []
        
        # Retrieve candidates
        retrieved_result = self.retriever.retrieve_followups(
            previous_question=previous_question,
            covered_topics=covered_topics,
            limit=3
        )
        
        context_payload = retrieved_result.get("context") or {}
        retrieved_candidates = context_payload.get("retrieved_questions") or []
        
        selected_cand = None
        alternates = []
        confidence = 0.5
        reason = "Fallback follow-up suggestion selected"

        if retrieved_candidates:
            selected_cand = retrieved_candidates[0]
            alternates = retrieved_candidates[1:]
            confidence = 0.9
            reason = "Selected follow-up candidate from retrieved database chunks"

        if not selected_cand:
            weaknesses = evaluation.get("weaknesses") or []
            weak_area = weaknesses[0] if weaknesses else "technical depth"
            fallback_text = f"Can you go one level deeper and explain how that works internally?"
            selected_cand = {
                "question": fallback_text,
                "expected_answer": "Provide details on internals, optimizations and trade-offs.",
                "company": "Generic",
                "role": session_context.get("role") or "Software Engineer",
                "subject": session_context.get("subject") or "Technical",
                "topic": "Follow-up",
                "related_topics": [],
                "skills": [weak_area],
                "technologies": [],
                "difficulty": "Medium",
                "interview_intent": "TECHNICAL",
                "source_asset": "Fallback Generator",
                "retrieval_id": "fallback_followup"
            }
            confidence = 0.3
            reason = "Used fallback follow-up suggestion due to empty database retrieval"

        # Compile RAGContext
        rag_context = self.context_manager.build_context(
            selected_question_chunk={
                "id": selected_cand.get("retrieval_id") or "followup_chunk",
                "document": f"Question: {selected_cand.get('question')} Answer: {selected_cand.get('expected_answer')}",
                "metadata": {
                    "company": selected_cand.get("company") or session_context.get("company") or "Generic",
                    "role": selected_cand.get("role") or session_context.get("role") or "Software Engineer",
                    "subject": selected_cand.get("subject") or session_context.get("subject") or "Technical",
                    "topic": selected_cand.get("topic") or "General",
                    "topics": ",".join(selected_cand.get("related_topics") or []),
                    "skills": ",".join(selected_cand.get("skills") or []),
                    "technologies": ",".join(selected_cand.get("technologies") or []),
                    "difficulty": selected_cand.get("difficulty") or session_context.get("difficulty") or "Medium",
                    "interview_intent": selected_cand.get("interview_intent") or "TECHNICAL",
                    "source_file": selected_cand.get("source_asset") or "Knowledge Base",
                    "chunk_id": selected_cand.get("retrieval_id") or ""
                }
            },
            session_context=session_context,
            retrieval_explanation=reason
        )

        suggestion = selected_cand.get("followup_candidates")
        suggestion_str = suggestion[0] if suggestion else selected_cand["question"]
        
        conversational_followup = self.llm_adapter.generate_followup(rag_context, suggestion_str)

        return {
            "follow_up_question": conversational_followup,
            "selected_candidate": selected_cand,
            "alternate_candidates": alternates,
            "confidence": confidence,
            "reason": reason,
            "rag_context": rag_context
        }
