"""Pydantic schemas: the stable integration boundary for Resume Intelligence."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

MAX_TEXT_CHARS = 60_000  # guard against pathological inputs


class ResumeInput(BaseModel):
    """Plain resume text (backend is responsible for PDF/DOCX -> text extraction)."""

    resume_text: str = Field(..., description="Full resume as plain text")

    @field_validator("resume_text")
    @classmethod
    def _limit(cls, v: str) -> str:
        if len(v) > MAX_TEXT_CHARS:
            raise ValueError(f"resume_text exceeds {MAX_TEXT_CHARS} characters")
        return v


class Contact(BaseModel):
    email: str | None = None
    phone: str | None = None
    links: list[str] = Field(default_factory=list)


class ExtractedSkill(BaseModel):
    name: str  # canonical skill name
    category: str
    mentions: int = 1
    in_skills_section: bool = False
    in_experience_or_projects: bool = False  # evidence of applied use (self-reported, not verified)
    in_quantified_bullet: bool = False  # used in a bullet that states a measurable result
    support: Literal["declared_only", "evidenced", "mentioned"] = "mentioned"


class EducationEntry(BaseModel):
    degree: str | None = None
    institution: str | None = None
    year: int | None = None
    cgpa: float | None = None
    raw: str = ""


class ExperienceEntry(BaseModel):
    title: str | None = None
    organization: str | None = None
    date_range: str | None = None
    bullets: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)


class ProjectEntry(BaseModel):
    name: str | None = None
    descriptions: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)


class InfoIssue(BaseModel):
    """Something absent or unclear. Never filled in by guesswork."""

    kind: Literal["missing", "ambiguous"]
    field: str
    message: str


class ParsedResume(BaseModel):
    contact: Contact
    sections: dict[str, str] = Field(default_factory=dict)
    skills: list[ExtractedSkill] = Field(default_factory=list)
    education_mentioned: bool = False
    graduation_year: int | None = None
    word_count: int = 0
    bullet_count: int = 0
    quantified_bullet_count: int = 0
    action_verb_bullet_count: int = 0
    education: list[EducationEntry] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)


class ScoreComponent(BaseModel):
    name: str
    score: float = Field(..., ge=0, le=100)
    weight: float
    detail: str


class Suggestion(BaseModel):
    severity: Literal["high", "medium", "low"]
    message: str


class ResumeAnalysis(BaseModel):
    parsed: ParsedResume
    overall_score: float = Field(..., ge=0, le=100)
    components: list[ScoreComponent]
    suggestions: list[Suggestion]
    warnings: list[str] = Field(default_factory=list)
    information_gaps: list[InfoIssue] = Field(default_factory=list)
    method: str = "rule-based + tf-idf (no trained model)"


class JobMatchInput(BaseModel):
    resume_text: str
    job_description: str

    @field_validator("resume_text", "job_description")
    @classmethod
    def _limit(cls, v: str) -> str:
        if len(v) > MAX_TEXT_CHARS:
            raise ValueError("text too long")
        return v


class JobMatchResult(BaseModel):
    match_score: float = Field(..., ge=0, le=100)
    required_skills_found: list[str]
    matched_skills: list[str]
    missing_skills: list[str]
    text_similarity: float = Field(..., ge=0, le=1)
    notes: list[str] = Field(default_factory=list)
