from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


class AdminTaskRequest(BaseModel):
    task: str = Field(..., min_length=5, description="Natural language description of the administrative task")


class AdminTaskResponse(BaseModel):
    success: bool
    message: str
    actions_executed: list[dict[str, Any]] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class StudentQuestion(BaseModel):
    question: str
    difficulty: Literal["Easy", "Medium", "Hard"] = "Easy"


class CompanyDetails(BaseModel):
    name: str
    company: str
    date: str  # YYYY-MM-DD
    from_time: str = Field(..., alias="from")  # HH:MM
    to_time: str = Field(..., alias="to")  # HH:MM
    no_of_questions: int
    position: str
    easy_remaining: int
    medium_remaining: int
    hard_remaining: int
    job_description: str
    questions: list[StudentQuestion] = Field(default_factory=list)
    students: list[str] = Field(default_factory=list)
    type: Literal["company"] = "company"

    model_config = {
        "populate_by_name": True,
        "populate_by_field_name": True
    }


class SubjectDetails(BaseModel):
    name: str
    subject: str
    date: str  # YYYY-MM-DD
    from_time: str = Field(..., alias="from")  # HH:MM
    to_time: str = Field(..., alias="to")  # HH:MM
    no_of_questions: int
    easy: int
    medium: int
    hard: int
    questions: list[StudentQuestion] = Field(default_factory=list)
    students: list[str] = Field(default_factory=list)
    type: Literal["subject"] = "subject"

    model_config = {
        "populate_by_name": True,
        "populate_by_field_name": True
    }


class WrittenDetails(BaseModel):
    name: str
    domain: str
    date: str  # YYYY-MM-DD
    from_time: str = Field(..., alias="from")  # HH:MM
    to_time: str = Field(..., alias="to")  # HH:MM
    no_of_questions: int
    essay: int = 0
    jumbled: int = 0
    errorDetection: int = 0
    fillInTheBlanks: int = 0
    synonymsAndAntonyms: int = 0
    questions: list[StudentQuestion] = Field(default_factory=list)
    students: list[str] = Field(default_factory=list)
    type: Literal["written"] = "written"

    model_config = {
        "populate_by_name": True,
        "populate_by_field_name": True
    }


class VerbalDetails(BaseModel):
    name: str
    date: str  # YYYY-MM-DD
    from_time: str = Field(..., alias="from")  # HH:MM
    to_time: str = Field(..., alias="to")  # HH:MM
    no_of_questions: int
    easy: int
    medium: int
    hard: int
    questions: list[StudentQuestion] = Field(default_factory=list)
    students: list[str] = Field(default_factory=list)
    type: Literal["verbal"] = "verbal"

    model_config = {
        "populate_by_name": True,
        "populate_by_field_name": True
    }


class SwarDetails(BaseModel):
    name: str
    date: str  # YYYY-MM-DD
    from_time: str = Field(..., alias="from")  # HH:MM
    to_time: str = Field(..., alias="to")  # HH:MM
    no_of_questions: int
    reading: int = 0
    repeating: int = 0
    short: int = 0
    jumbled: int = 0
    comprehension: int = 0
    questions: list[StudentQuestion] = Field(default_factory=list)
    students: list[str] = Field(default_factory=list)
    type: Literal["Svar"] = "Svar"

    model_config = {
        "populate_by_name": True,
        "populate_by_field_name": True
    }


class AdminTaskAction(BaseModel):
    action_type: Literal["schedule_interview", "download_attendance", "fetch_status_counts", "unsupported"]
    interview_type: Optional[Literal["company", "subject", "written", "verbal", "svar"]] = None

    company_details: Optional[CompanyDetails] = None
    subject_details: Optional[SubjectDetails] = None
    written_details: Optional[WrittenDetails] = None
    verbal_details: Optional[VerbalDetails] = None
    svar_details: Optional[SwarDetails] = None

    interview_name_or_id: Optional[str] = None
    interview_ids: Optional[list[str]] = None
    message: Optional[str] = None


class AdminTaskPlan(BaseModel):
    actions: list[AdminTaskAction] = Field(default_factory=list)
