"""
GLAMIS-specific request and response schemas.

These schemas enable seamless integration with the GLAMIS platform
while maintaining backward compatibility with existing APIs.
"""
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def to_camel(string: str) -> str:
    parts = string.split("_")
    return parts[0] + "".join(word.title() for word in parts[1:])


# ============================================================================
# GLAMIS REQUEST SCHEMAS
# ============================================================================


class SubjectInterviewRequest(BaseModel):
    """Subject-based interview request"""
    subject: str = Field(..., description="Subject name (DBMS, OS, CN, DSA, ML, Cybersecurity)")
    answer: str = Field(default="", description="Candidate's answer")
    score: int = Field(default=0, ge=0, le=100, description="Previous score if any")
    interviewId: str = Field(..., description="Interview session ID")


class VerbalInterviewRequest(BaseModel):
    """Verbal interview request"""
    subject: str = Field(..., description="Subject name")
    answer: str = Field(default="", description="Candidate's voice transcription")
    score: int = Field(default=0, ge=0, le=100, description="Previous score")
    interviewId: str = Field(..., description="Interview session ID")


class WrittenInterviewRequest(BaseModel):
    """Written interview request (only asks questions, no answer submitted)"""
    subject: str = Field(..., description="Subject name")
    interviewId: str = Field(..., description="Interview session ID")


class CompanyInterviewRequest(BaseModel):
    """Company/JD-based interview request"""
    selectedCompany: str = Field(..., description="Company name")
    jobTitle: str = Field(..., description="Job title")
    jdDetails: str = Field(default="", description="Job description details")


class SVARInterviewRequest(BaseModel):
    """SVAR interview request"""
    question: str = Field(..., description="SVAR question")
    answer: str = Field(default="", description="Candidate's answer")
    difficulty: Literal["reading", "repeating", "jumbled_sentence", "short_question", "comprehension"] = Field(
        default="reading", description="SVAR difficulty level"
    )


class GLAMISRequest(BaseModel):
    """Unified GLAMIS request that can represent any interview type"""

    @field_validator("interview_type", mode="before")
    @classmethod
    def normalize_interview_type(cls, value: Optional[str]) -> Optional[str]:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized == "jd":
                return "company"
            return normalized
        return value

    interview_type: Optional[Literal["subject", "verbal", "written", "company", "svar", "hr", "system_design"]] = Field(
        default=None, description="Type of interview"
    )
    
    # Subject/Verbal/Written common fields
    subject: Optional[str] = Field(default=None)
    answer: Optional[str] = Field(default=None)
    score: Optional[int] = Field(default=None, ge=0, le=100)
    interviewId: Optional[str] = Field(default=None)
    
    # Company interview fields
    selectedCompany: Optional[str] = Field(default=None)
    jobTitle: Optional[str] = Field(default=None)
    jdDetails: Optional[str] = Field(default=None)
    
    # SVAR fields
    question: Optional[str] = Field(default=None)
    difficulty: Optional[str] = Field(default=None)
    
    # Additional GLAMIS metadata
    metadata: dict[str, Any] = Field(default_factory=dict)
    resume_text: Optional[str] = Field(default=None, description="Parsed resume text for context-aware questioning")
    student_id: Optional[str] = Field(default=None, description="Student ID for cross-session memory")


# ============================================================================
# GLAMIS RESPONSE SCHEMAS
# ============================================================================


class GLAMISEvaluation(BaseModel):
    """Evaluation result for GLAMIS interviews"""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    technical_score: int = Field(ge=0, le=10)
    communication_score: int = Field(ge=0, le=10, description="For verbal/SVAR interviews")
    grammar_score: int = Field(ge=0, le=10, description="For verbal/SVAR interviews")
    accuracy_score: int = Field(ge=0, le=10)
    vocabulary_score: int = Field(ge=0, le=10, default=0)
    content_structure_score: int = Field(ge=0, le=10, default=0)
    pronunciation_score: int = Field(ge=0, le=10, default=0)
    correctness_score: int = Field(ge=0, le=10, default=0)
    overall_score: int = Field(ge=0, le=10)
    feedback: str
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    expected_answer: str = Field(default="", description="Expected answer for reference")
    improvement_suggestions: list[str] = Field(default_factory=list)
    follow_up_needed: bool = Field(default=False, description="Indicates whether a follow-up question is recommended")
    is_invalid: bool = Field(default=False, description="True when answer was blocked by F9 guard")


class GLAMISResponse(BaseModel):
    """Unified GLAMIS response"""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    status: str = Field(default="success")
    interviewId: str
    question: Optional[str] = Field(default=None, description="Next question to ask")
    evaluation: Optional[GLAMISEvaluation] = Field(default=None, description="Evaluation if answer was submitted")
    difficulty: str = Field(default="Medium")
    interview_complete: bool = Field(default=False)
    audio_url: Optional[str] = Field(default=None, description="Audio URL for TTS")
    audio_file_name: Optional[str] = Field(default=None, alias="audioFileName")
    follow_up_question: Optional[str] = Field(default=None)
    error: Optional[str] = Field(default=None)
    metadata: dict[str, Any] = Field(default_factory=dict)


class GLAMISReportResponse(BaseModel):
    """Interview report for GLAMIS"""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    interviewId: str
    candidate_name: Optional[str] = None
    subject: Optional[str] = None
    interview_type: str
    total_questions: int
    average_score: float
    technical_score: int
    communication_score: int
    overall_score: int
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
    summary: str
    interview_outcome: str
    duration: Optional[int] = None
    question_statistics: Optional[dict[str, Any]] = None
    feedback: Optional[str] = None
