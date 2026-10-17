"""Shared schemas used across modules (student profile and competency evidence).

Evidence integrity rule: a record counts as *verified* only when its source is a human-review
source. Callers cannot set `verified` directly, so automated results and self-declarations can
never be promoted to verified competency by accident (or by prompt injection).
"""
from __future__ import annotations

import datetime as _dt
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EvidenceSource = Literal[
    "declared",          # skill listed by the student (resume/LinkedIn/form)
    "resume_evidence",   # skill used in a described project or job (still self-reported)
    "interview_auto",    # automated mock-interview assessment
    "task_auto",         # automated preliminary task feedback
    "task_review",       # human-reviewed practical task result
    "interview_review",  # human-reviewed interview assessment
    "portfolio_review",  # human-reviewed portfolio item
]
REVIEWED_SOURCES = {"task_review", "interview_review", "portfolio_review"}


def parse_timestamp(value: str | _dt.date | _dt.datetime | None) -> _dt.datetime | None:
    """Parse an ISO-8601 date or datetime into a timezone-aware UTC datetime (naive values are taken as UTC)."""
    if value is None or value == "":
        return None
    if isinstance(value, _dt.datetime):
        d = value
    elif isinstance(value, _dt.date):
        d = _dt.datetime(value.year, value.month, value.day)
    elif isinstance(value, str):
        try:
            d = _dt.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError as e:
            raise ValueError(f"invalid ISO-8601 date/time: {value!r}") from e
    else:
        raise ValueError(f"invalid date/time value: {value!r}")
    return d.replace(tzinfo=_dt.timezone.utc) if d.tzinfo is None else d.astimezone(_dt.timezone.utc)


def _validate_ts(v):
    if v is None or v == "":
        return None
    parse_timestamp(v)  # raises ValueError when malformed
    return v if isinstance(v, str) else v.isoformat()


class EvidenceRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skill: str = Field(..., min_length=1)
    source: EvidenceSource
    strength: float = Field(..., ge=0.0, le=1.0, description="0 = shows weakness, 1 = strong demonstration")
    ref_id: str | None = Field(None, description="Opaque id of the interview/task/review this came from")
    note: str = ""
    assessed_at: str | None = Field(None, description="ISO-8601 date/time the assessment was made (optional; unknown = None)")
    capped_from: float | None = Field(None, ge=0.0, le=1.0, description="Reviewer's own score when `strength` was lowered by the per-review readiness cap")

    @field_validator("assessed_at", mode="before")
    @classmethod
    def _ts(cls, v):
        return _validate_ts(v)

    @property
    def verified(self) -> bool:
        return self.source in REVIEWED_SOURCES


class AssessmentAttempt(BaseModel):
    """An assessment (interview, task, portfolio review) WAS attempted for a skill but produced no usable evidence.

    This is what separates `missing_evidence` (we tried, got nothing usable) from `not_assessed` (never tried).
    """
    model_config = ConfigDict(extra="forbid")

    skill: str = Field(..., min_length=1)
    kind: Literal["interview", "task", "portfolio"]
    reason: str = Field("no usable evidence", max_length=200)
    ref_id: str | None = None
    assessed_at: str | None = None

    @field_validator("assessed_at", mode="before")
    @classmethod
    def _ts(cls, v):
        return _validate_ts(v)


class EducationInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    degree: str | None = None
    graduation_year: int | None = Field(None, ge=1990, le=2060)
    cgpa: float | None = Field(None, ge=0, le=10)


class StudentProfile(BaseModel):
    """Everything modules may know about a student. All fields are optional and None means unknown."""

    model_config = ConfigDict(extra="forbid")

    student_id: str | None = Field(None, description="Opaque backend id; never put names or emails here")
    target_role: str | None = None
    goals: str = ""
    declared_skills: list[str] = Field(default_factory=list)
    education: EducationInfo = Field(default_factory=EducationInfo)
    experience_years: float | None = Field(None, ge=0, le=60)
    location: str | None = None
    preferred_work_modes: list[Literal["remote", "onsite", "hybrid"]] = Field(default_factory=list)
    preferred_opportunity_types: list[Literal["job", "internship", "startup_task"]] = Field(default_factory=list)
    weekly_hours: float | None = Field(None, gt=0, le=80)
    timeline_weeks: int | None = Field(None, gt=0, le=156)
    budget_per_session_inr: float | None = Field(None, ge=0)
    evidence: list[EvidenceRecord] = Field(default_factory=list)
    assessment_attempts: list[AssessmentAttempt] = Field(default_factory=list)
    completed_activity_ids: list[str] = Field(default_factory=list)
    profile_text: str = Field("", description="Free text (resume summary etc.). Treated as untrusted.")

    @field_validator("profile_text")
    @classmethod
    def _cap(cls, v: str) -> str:
        if len(v) > 60_000:
            raise ValueError("profile_text too long")
        return v
