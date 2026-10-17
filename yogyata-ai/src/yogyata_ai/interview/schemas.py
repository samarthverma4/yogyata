"""Schemas for the mock-interview module (question bank, evaluation results, history)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

InterviewType = Literal["technical", "hr"]

TECH_DIMENSIONS = ("correctness", "reasoning", "completeness", "relevance")
HR_DIMENSIONS = ("relevance", "structure", "clarity", "examples")
DEFAULT_WEIGHTS = {
    "technical": {"correctness": 0.40, "reasoning": 0.20, "completeness": 0.25, "relevance": 0.15},
    "hr": {"relevance": 0.25, "structure": 0.25, "clarity": 0.20, "examples": 0.30},
}
MAX_ANSWER_CHARS = 8_000


class Concept(BaseModel):
    name: str
    aliases: list[str] = Field(default_factory=list)
    explanation: str = ""
    weight: float = Field(1.0, gt=0)
    required: bool = True


class Misconception(BaseModel):
    pattern: str = Field(..., description="Case-insensitive regex that signals the misconception")
    explanation: str


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: InterviewType
    roles: list[str] = Field(default_factory=lambda: ["any"])
    topic: str
    difficulty: int = Field(..., ge=1, le=3)
    text: str
    skills: list[str] = Field(default_factory=list, description="Canonical skills this question gives evidence for")
    reference_answer: str = ""
    concepts: list[Concept] = Field(default_factory=list)
    misconceptions: list[Misconception] = Field(default_factory=list)
    hr_focus: list[str] = Field(default_factory=list)
    follow_ups: dict[str, str] = Field(default_factory=dict)
    weights: dict[str, float] | None = None


class AnswerInput(BaseModel):
    question_id: str
    answer_text: str

    @field_validator("answer_text")
    @classmethod
    def _cap(cls, v: str) -> str:
        if len(v) > MAX_ANSWER_CHARS:
            raise ValueError(f"answer_text exceeds {MAX_ANSWER_CHARS} characters")
        return v


class EvidenceSnippet(BaseModel):
    dimension: str
    quote: str  # always a verbatim excerpt of the student's own answer
    note: str


class AnswerEvaluation(BaseModel):
    question_id: str
    attempt_id: str | None = Field(None, description="Backend id of this attempt (needed to attach a human review to it)")
    assessed_at: str | None = Field(None, description="ISO-8601 time of the assessment, set by the backend")
    interview_type: InterviewType
    topic: str
    difficulty: int
    scores: dict[str, float]
    overall: float = Field(..., ge=0, le=100)
    confidence: Literal["low", "medium", "high"]
    evaluator: Literal["deterministic", "hybrid_llm"]
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    evidence: list[EvidenceSnippet] = Field(default_factory=list)
    missed_concepts: list[str] = Field(default_factory=list)
    misconceptions_detected: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    practice_topics: list[str] = Field(default_factory=list)
    uncertainty_notes: list[str] = Field(default_factory=list)
    llm_status: str = "not_used"
    status: Literal["automated_unverified"] = "automated_unverified"
    disclaimer: str = ("Automated assessment. It estimates answer quality against a rubric and cannot verify "
                       "correctness or competence; it is not a human-reviewed result.")


class HistoryItem(BaseModel):
    """One past answer, supplied by the backend (this module stores nothing)."""

    question_id: str
    topic: str
    difficulty: int = Field(..., ge=1, le=3)
    overall: float = Field(..., ge=0, le=100)
    interview_type: InterviewType = "technical"
    confidence: Literal["low", "medium", "high"] = "medium"


class TopicPerformance(BaseModel):
    topic: str
    attempts: int
    mean_score: float
    latest_score: float
    trend: float | None
    status: Literal["strong", "developing", "weak", "insufficient_data"]


class SelectedQuestion(BaseModel):
    question: Question
    reason: str
    target_difficulty: int
