"""Shared opportunity schema (jobs, internships, startup practical tasks) and match results."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

OpportunityType = Literal["job", "internship", "startup_task"]
WorkMode = Literal["remote", "onsite", "hybrid"]


class EligibilityRules(BaseModel):
    """Mandatory conditions. Any rule left as None is not checked."""

    model_config = ConfigDict(extra="forbid")

    allowed_graduation_years: list[int] | None = None
    min_cgpa: float | None = Field(None, ge=0, le=10)
    min_experience_years: float | None = Field(None, ge=0)
    allowed_degree_keywords: list[str] | None = Field(None, description="Student's degree must contain one (case-insensitive)")
    location_required: bool = Field(False, description="True only if the student must already be in `location`")


class Opportunity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: OpportunityType
    title: str
    organisation: str = ""
    description: str = ""
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    location: str | None = None
    work_mode: WorkMode | None = None
    eligibility: EligibilityRules = Field(default_factory=EligibilityRules)
    is_demo: bool = Field(False, description="True for synthetic demonstration records")


class MatchWeights(BaseModel):
    """Configurable scoring weights (renormalised over the components that apply)."""

    required_coverage: float = Field(0.45, ge=0)
    preferred_coverage: float = Field(0.15, ge=0)
    text_similarity: float = Field(0.25, ge=0)
    preference_fit: float = Field(0.15, ge=0)


class EligibilityCheck(BaseModel):
    rule: str
    status: Literal["pass", "fail", "unknown"]
    detail: str


class SkillMatch(BaseModel):
    skill: str
    level: str  # none | declared | demonstrated | verified
    credit: float


class RankedOpportunity(BaseModel):
    opportunity_id: str
    type: OpportunityType
    title: str
    rank: int
    score: float = Field(..., ge=0, le=100)
    eligibility_status: Literal["eligible", "eligibility_unknown"]
    components: dict[str, float]
    matched_skills: list[SkillMatch]
    missing_skills: list[str]
    weakly_supported_skills: list[str]
    unknown_eligibility: list[EligibilityCheck] = Field(default_factory=list)
    explanation: list[str]
    is_demo: bool = False
    score_meaning: str = "Fit indicator used only for ranking; it is not a probability of being hired or selected."


class ExcludedOpportunity(BaseModel):
    opportunity_id: str
    title: str
    failed_rules: list[EligibilityCheck]


class MatchResult(BaseModel):
    ranked: list[RankedOpportunity]
    excluded: list[ExcludedOpportunity]
    warnings: list[str] = Field(default_factory=list)
    backend_status: str
    weights_used: dict[str, float]
    method: str = "hybrid: deterministic eligibility + evidence-weighted skill coverage + text similarity"
