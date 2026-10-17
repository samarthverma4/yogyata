from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from yogyata_ai.common.schemas import StudentProfile

GroupBy = Literal["department", "program", "graduation_year", "target_role"]


class CohortRecord(BaseModel):
    """One student's record as supplied by the university backend. Pseudonymous: no names/emails/phones accepted."""
    model_config = ConfigDict(extra="forbid")
    department: str | None = None
    program: str | None = None
    graduation_year: int | None = Field(None, ge=1990, le=2060)
    target_role: str | None = None
    profile: StudentProfile
    placed: bool | None = Field(None, description="None = outcome unknown (NOT 'not placed')")


class SkillRow(BaseModel):
    skill: str
    applicable_n: int
    assessed_n: int
    weakness_share_of_assessed: float
    met_share_of_assessed: float
    unassessed_share_of_applicable: float


class GroupStats(BaseModel):
    label: str
    n: int
    readiness_mean: float
    readiness_mean_range: list[float] = Field(..., description="[mean of lower bounds, mean of upper bounds]")
    evidence_sufficiency_share: dict[str, float]
    skill_rows: list[SkillRow]
    top_gaps: list[str]
    placement: dict
    members: list[str] = Field(default_factory=list, description="Group labels pooled here (pooled group only)")


class AnalyticsReport(BaseModel):
    group_by: str
    k: int
    overall: GroupStats | None
    groups: list[GroupStats]
    pooled: GroupStats | None
    suppression_notes: list[str]
    skipped_records: int
    warnings: list[str]
    interpretation: list[str] = Field(default_factory=lambda: [
        "Figures describe current, evidence-based skill status of the supplied cohort, not individuals.",
        "'Unassessed' means no assessment exists yet; it is not poor performance.",
        "Placement shares use only students with a known outcome and are associations, not predictions or guarantees.",
        "Small groups are suppressed or pooled to protect individuals."])
