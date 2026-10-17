"""Schemas for practical tasks, preliminary feedback and human-reviewed results."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from yogyata_ai.common.schemas import EvidenceRecord

Difficulty = Literal["beginner", "intermediate", "advanced"]


class ConceptsCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["concepts"]
    groups: list[list[str]] = Field(..., min_length=1, description="Each group = alternatives; a group is hit if any term appears")
    min_groups: int | None = Field(None, ge=1)


class SectionCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["section"]
    patterns: list[str] = Field(..., min_length=1)


class MinWordsCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["min_words"]
    n: int = Field(..., ge=1)


class HumanCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["human"]


Check = Annotated[ConceptsCheck | SectionCheck | MinWordsCheck | HumanCheck, Field(discriminator="type")]


class RubricCriterion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    description: str
    weight: float = Field(..., gt=0)
    check: Check


class PracticalTask(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    title: str
    description: str
    skills: list[str] = Field(..., min_length=1)
    difficulty: Difficulty
    estimated_hours: float = Field(..., gt=0, le=200)
    prerequisite_skills: list[str] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)
    rubric: list[RubricCriterion] = Field(..., min_length=1)
    source: Literal["synthetic_demo", "platform", "startup"] = "platform"


class CriterionResult(BaseModel):
    id: str
    description: str
    weight: float
    automated_status: Literal["found", "partial", "not_found", "needs_human"]
    detail: str


class PreliminaryFeedback(BaseModel):
    """Automated, unverified first-pass feedback. It can never be treated as a competency judgement."""
    task_id: str
    status: Literal["preliminary_unverified"] = "preliminary_unverified"
    human_review_required: Literal[True] = True
    criteria: list[CriterionResult]
    indicative_completeness: float | None = Field(None, ge=0, le=1, description="Share of automatically checkable rubric weight satisfied; NOT a grade")
    checkable_weight_share: float = Field(..., ge=0, le=1)
    flags: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    suggested_evidence: list[EvidenceRecord] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    method: str = "deterministic rubric checks (keywords, sections, length); no model judges correctness"


class TaskRecommendation(BaseModel):
    task_id: str
    title: str
    skills: list[str]
    difficulty: str
    estimated_hours: float
    score: float
    reasons: list[str]
    already_met_skills: list[str] = Field(default_factory=list)


class NotRecommended(BaseModel):
    task_id: str
    reason: str


class TaskRecommendations(BaseModel):
    recommendations: list[TaskRecommendation]
    not_recommended: list[NotRecommended]
    notes: list[str] = Field(default_factory=list)
    disclaimer: str = ("Recommending or submitting a task does not show competence. Skill status changes only "
                       "after a human-reviewed result is recorded.")


class ReviewedResult(BaseModel):
    """A HUMAN reviewer's result. Only this type can produce verified evidence."""
    model_config = ConfigDict(extra="forbid")
    kind: Literal["task", "portfolio"] = "task"
    item_id: str = Field(..., min_length=1, description="Task id or portfolio item id")
    reviewer_id: str = Field(..., min_length=1, description="Opaque id of the human reviewer (authenticated by the backend)")
    criterion_scores: dict[str, Annotated[float, Field(ge=0, le=1)]] = Field(default_factory=dict)
    overall: float | None = Field(None, ge=0, le=1)
    skills: list[str] = Field(default_factory=list, description="Override skills credited (default: the task's skills)")
    comment: str = ""
