"""
GLAMIS Adapter - Converts GLAMIS requests to internal format and routes them.

This adapter layer ensures:
- Backward compatibility with existing APIs
- Seamless integration with GLAMIS platform
- Proper request/response conversion
- Interview type routing and handling
"""
from __future__ import annotations

from typing import Any

from interview_agents.agents.interview_type_router import InterviewTypeRouter
from interview_agents.schemas.glamis import (
    GLAMISEvaluation,
    GLAMISRequest,
    GLAMISResponse,
)
from interview_agents.utils.enums import InterviewType


class GLAMISAdapter:
    """
    Adapter for GLAMIS interview platform integration.
    
    Responsibilities:
    - Convert GLAMIS requests to internal format
    - Route interview types appropriately
    - Convert internal responses to GLAMIS format
    - Maintain backward compatibility
    """

    @staticmethod
    def convert_request_to_internal(glamis_request: GLAMISRequest | dict) -> dict[str, Any]:
        """
        Convert GLAMIS request to internal interview format.
        
        Args:
            glamis_request: GLAMIS request object or dictionary
        
        Returns:
            Internal format dictionary for processing
        """
        if isinstance(glamis_request, dict):
            req = glamis_request
        else:
            req = glamis_request.model_dump(exclude_none=True)
        
        interview_type = req.get("interview_type", "subject")
        internal_request = {
            "interview_type": interview_type,
        }
        
        # Subject/Verbal/Written interviews
        if interview_type in ("subject", "verbal", "written"):
            internal_request.update({
                "subject": req.get("subject"),
                "answer": req.get("answer", ""),
                "score": req.get("score", 0),
                "session_id": req.get("interviewId"),
            })
        
        # Company interview
        elif interview_type == "company":
            internal_request.update({
                "company": req.get("selectedCompany"),
                "job_title": req.get("jobTitle"),
                "jd_details": req.get("jdDetails", ""),
            })
        
        # SVAR interview
        elif interview_type == "svar":
            internal_request.update({
                "question": req.get("question"),
                "answer": req.get("answer", ""),
                "svar_type": req.get("difficulty", "reading"),
            })

        # HR / Behavioral interview
        elif interview_type in ("hr", "hr_behavioral", "behavioral"):
            internal_request.update({
                "answer": req.get("answer", ""),
            })

        # System Design interview
        elif interview_type == "system_design":
            internal_request.update({
                "answer": req.get("answer", ""),
            })

        return internal_request

    @staticmethod
    def convert_response_to_glamis(
        session_id: str,
        next_question: str = "",
        evaluation: dict[str, Any] | None = None,
        difficulty: str = "Medium",
        interview_complete: bool = False,
        audio_url: str | None = None,
        follow_up_question: str | None = None,
        interview_type: str = "subject",
        metadata: dict[str, Any] | None = None,
    ) -> GLAMISResponse:
        """
        Convert internal response to GLAMIS format.
        
        Args:
            session_id: Interview session ID
            next_question: Next question to ask
            evaluation: Evaluation result dictionary
            difficulty: Current difficulty level
            interview_complete: Whether interview is complete
            audio_url: URL for TTS audio
            follow_up_question: Follow-up question if any
            interview_type: Type of interview
        
        Returns:
            GLAMIS formatted response
        """
        glamis_eval = None
        
        if evaluation:
            glamis_eval = GLAMISEvaluation(
                technical_score=evaluation.get("technical_score", 0),
                communication_score=evaluation.get("communication_score", 0),
                grammar_score=evaluation.get("grammar_score", 0),
                accuracy_score=evaluation.get("accuracy_score", 0),
                vocabulary_score=evaluation.get("vocabulary_score", 0),
                content_structure_score=evaluation.get("content_structure_score", 0),
                pronunciation_score=evaluation.get("pronunciation_score", 0),
                correctness_score=evaluation.get("correctness_score", 0),
                overall_score=evaluation.get("overall_score", 0),
                feedback=evaluation.get("feedback", ""),
                strengths=evaluation.get("strengths", []),
                weaknesses=evaluation.get("weaknesses", []),
                expected_answer=evaluation.get("expected_answer", ""),
                improvement_suggestions=evaluation.get("improvement_suggestions", []),
                follow_up_needed=evaluation.get("follow_up_needed", False),
                is_invalid=evaluation.get("is_invalid", False),
            )
        
        return GLAMISResponse(
            status="success",
            interviewId=session_id,
            question=next_question if not interview_complete else None,
            evaluation=glamis_eval,
            difficulty=difficulty,
            interview_complete=interview_complete,
            audio_url=audio_url,
            audio_file_name=audio_url,
            follow_up_question=follow_up_question,
            metadata=metadata or {},
        )

    @staticmethod
    def get_interview_type(request: dict | GLAMISRequest) -> InterviewType:
        """
        Detect interview type from request.
        
        Args:
            request: GLAMIS request object or dictionary
        
        Returns:
            InterviewType enum value
        """
        if isinstance(request, dict):
            req_dict = request
        else:
            req_dict = request.model_dump(exclude_none=True)
        
        return InterviewTypeRouter.detect_interview_type(req_dict)

    @staticmethod
    def get_prompt_name(
        interview_type: InterviewType,
        subject: str | None = None,
    ) -> str:
        """
        Get prompt file name for the given interview type.
        
        Args:
            interview_type: Type of interview
            subject: Subject name (for subject interviews)
        
        Returns:
            Prompt file name
        """
        return InterviewTypeRouter.get_prompt_name(interview_type, subject)

    @staticmethod
    def should_generate_followup(
        interview_type: InterviewType,
        score: int,
        evaluation: dict[str, Any] | None = None,
    ) -> bool:
        """
        Determine if follow-up question should be generated.
        
        Args:
            interview_type: Type of interview
            score: Candidate's score (0-10)
            evaluation: Full evaluation result
        
        Returns:
            True if follow-up should be generated
        """
        if not InterviewTypeRouter.should_include_follow_up(interview_type, score):
            return False
        
        # For evaluation-based determination
        if evaluation:
            follow_up_needed = evaluation.get("follow_up_needed", False)
            if follow_up_needed:
                return True
        
        return score < 6

    @staticmethod
    def prepare_context_for_question_generation(
        session_id: str,
        interview_type: InterviewType,
        candidate_name: str = "",
        role: str = "",
        experience: str = "",
        skills: list[str] | None = None,
        subject: str | None = None,
        company: str | None = None,
        job_title: str | None = None,
        jd_details: str | None = None,
        previous_questions: list[str] | None = None,
        difficulty: str = "Medium",
    ) -> dict[str, Any]:
        """
        Prepare context for question generation agent.
        
        Args:
            session_id: Interview session ID
            interview_type: Type of interview
            candidate_name: Candidate's name
            role: Role being interviewed for
            experience: Candidate's experience level
            skills: List of candidate skills
            subject: Subject (for subject interviews)
            company: Company (for company interviews)
            job_title: Job title (for company interviews)
            jd_details: JD details (for company interviews)
            previous_questions: List of previous questions
            difficulty: Current difficulty level
        
        Returns:
            Context dictionary for question generation
        """
        context = {
            "session_id": session_id,
            "interview_type": interview_type.value,
            "candidate_name": candidate_name,
            "role": role,
            "experience": experience,
            "skills": skills or [],
            "previous_questions": previous_questions or [],
            "difficulty": difficulty,
        }
        
        if interview_type == InterviewType.SUBJECT:
            context["subject"] = subject or "DSA"
        elif interview_type == InterviewType.VERBAL:
            context["subject"] = subject or "General"
        elif interview_type == InterviewType.WRITTEN:
            context["subject"] = subject or "General"
        elif interview_type == InterviewType.COMPANY:
            context["company"] = company or ""
            context["job_title"] = job_title or ""
            context["jd_details"] = jd_details or ""
        elif interview_type == InterviewType.SVAR:
            context["svar_type"] = context.get("svar_type", "reading")
        
        return context

    @staticmethod
    def prepare_evaluation_context(
        interview_type: InterviewType,
        question: str,
        answer: str,
        candidate_experience: str = "",
        subject: str | None = None,
    ) -> dict[str, Any]:
        """
        Prepare context for answer evaluation.
        
        Args:
            interview_type: Type of interview
            question: The question asked
            answer: The candidate's answer
            candidate_experience: Candidate's experience level
            subject: Subject (for subject interviews)
        
        Returns:
            Context dictionary for evaluation
        """
        context = {
            "interview_type": interview_type.value,
            "question": question,
            "answer": answer,
            "candidate_experience": candidate_experience,
            "evaluation_criteria": InterviewTypeRouter.get_evaluation_criteria(interview_type),
        }
        
        if subject:
            context["subject"] = subject
        
        return context
