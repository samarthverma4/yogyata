import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass(frozen=True)
class RAGContext:
    selected_question: str
    expected_answer: str
    evaluation_rubric: str
    company: str
    role: str
    subject: str
    topic: str
    related_topics: List[str]
    technologies: List[str]
    skills: List[str]
    difficulty: str
    interview_intent: str
    candidate_history: List[Dict[str, Any]]
    weak_skills: List[str]
    strong_skills: List[str]
    previous_questions: List[str]
    retrieval_explanation: str
    knowledge_source: str
    chunk_id: str

    def to_prompt_string(self) -> str:
        """Generates structured markdown prompt context."""
        history_str = ""
        if self.candidate_history:
            history_lines = []
            for i, turn in enumerate(self.candidate_history):
                q = turn.get("question") or ""
                a = turn.get("answer") or ""
                history_lines.append(f"- Turn {i+1}:\n  Question: {q}\n  Candidate Answer: {a}")
            history_str = "\n".join(history_lines)
        else:
            history_str = "No prior history in this session."

        return f"""
### RETRIEVED KNOWLEDGE SOURCE (DO NOT CONTRADICT)
- **Authoritative Question to Ask**: {self.selected_question}
- **Authoritative Expected Answer**: {self.expected_answer}
- **Target Evaluation Rubric / Key Concepts**: {self.evaluation_rubric or "Grade depth of technical explanation, correctness of terminology, and handling of edge cases."}
- **Difficulty**: {self.difficulty}
- **Metadata**: Company: {self.company} | Role: {self.role} | Subject: {self.subject} | Topic: {self.topic}
- **Related Topics**: {", ".join(self.related_topics) if self.related_topics else "None"}
- **Skills Focus**: {", ".join(self.skills) if self.skills else "None"}
- **Technologies Focus**: {", ".join(self.technologies) if self.technologies else "None"}
- **Knowledge Source Reference**: {self.knowledge_source} (Chunk ID: {self.chunk_id})

### CANDIDATE AND INTERVIEW PROGRESS
- **Current Difficulty Level**: {self.difficulty}
- **Candidate Weak Skills**: {", ".join(self.weak_skills) if self.weak_skills else "None"}
- **Candidate Strong Skills**: {", ".join(self.strong_skills) if self.strong_skills else "None"}
- **Conversation History**:
{history_str}
"""

class ContextManager:
    """Orchestrates structured interview context compilation and RAG prompt injections."""

    def build_context(
        self,
        selected_question_chunk: Dict[str, Any],
        session_context: Dict[str, Any],
        retrieval_explanation: str = ""
    ) -> RAGContext:
        """
        Builds an immutable RAGContext object from selected chunk and active session context.
        """
        metadata = selected_question_chunk.get("metadata") or {}
        doc_text = selected_question_chunk.get("document") or ""
        
        # Split chunk into question and answer
        question = doc_text
        expected_answer = ""
        if "Question:" in doc_text and "Answer:" in doc_text:
            try:
                parts = doc_text.split("Answer:")
                question = parts[0].replace("Question:", "").strip()
                expected_answer = parts[1].strip()
            except Exception:
                pass

        topics = [t.strip() for t in (metadata.get("topics") or "").split(",") if t.strip()]
        primary_topic = metadata.get("topic") or (topics[0] if topics else "")
        related_topics = [t for t in topics if t != primary_topic]
        
        skills = [s.strip() for s in (metadata.get("skills") or "").split(",") if s.strip()]
        techs = [t.strip() for t in (metadata.get("technologies") or "").split(",") if t.strip()]
        
        # Extract evaluation rubric or guidelines if present, else fallback
        rubric = metadata.get("evaluation_rubric") or metadata.get("rubric") or ""

        # Extract history
        cand_history = []
        recent_questions = session_context.get("recent_questions") or []
        recent_answers = session_context.get("recent_answers") or []
        for q, a in zip(recent_questions, recent_answers):
            cand_history.append({"question": q, "answer": a})

        return RAGContext(
            selected_question=question,
            expected_answer=expected_answer,
            evaluation_rubric=rubric,
            company=metadata.get("company") or "Generic",
            role=metadata.get("role") or session_context.get("role") or "Software Engineer",
            subject=metadata.get("subject") or session_context.get("subject") or "Technical",
            topic=primary_topic,
            related_topics=related_topics,
            technologies=techs,
            skills=skills,
            difficulty=metadata.get("difficulty") or session_context.get("difficulty") or "Medium",
            interview_intent=metadata.get("interview_intent") or "TECHNICAL",
            candidate_history=cand_history,
            weak_skills=session_context.get("weak_skills") or [],
            strong_skills=session_context.get("strong_skills") or [],
            previous_questions=recent_questions,
            retrieval_explanation=retrieval_explanation,
            knowledge_source=metadata.get("source_file") or metadata.get("asset_id") or "Knowledge Base",
            chunk_id=selected_question_chunk.get("id") or metadata.get("chunk_id") or ""
        )
