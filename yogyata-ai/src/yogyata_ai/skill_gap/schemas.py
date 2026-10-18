"""Output schemas for skill-gap analysis."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Status = Literal["met", "developing", "demonstrated_weakness", "self_reported_use", "missing_evidence", "unassessed"]
Confidence = Literal["none", "low", "medium", "high"]


class SkillAssessment(BaseModel):
    skill: str
    importance: int
    level: Literal["none", "declared", "demonstrated", "verified"]
    strength: float | None
    credit: float = Field(..., ge=0, le=1, description="Attainment credit used in the readiness score")
    status: Status
    confidence: Confidence
    evidence_sources: list[str]
    prerequisites: list[str]
    blocked_by: list[str] = Field(default_factory=list, description="Unmet prerequisites (status not 'met')")
    unlocks: int = 0
    priority: float = Field(..., ge=0, le=100)
    explanation: str
    evidence_state: Literal["demonstrated", "partially_demonstrated", "mentioned_unverified", "not_assessed", "missing_evidence"] = "not_assessed"
    evidence_state_reason: str = ""
    last_assessed_at: str | None = None
    evidence_stale: bool = False
    evidence_conflict: bool = False
    evidence_notes: list[str] = Field(default_factory=list)


class GapReport(BaseModel):
    role_id: str
    role_title: str
    readiness_score: float = Field(..., ge=0, le=100)
    readiness_min: float = Field(..., ge=0, le=100, description="Counting only demonstrated/verified credit")
    readiness_max: float = Field(..., ge=0, le=100, description="If every unknown/declared skill turned out competent")
    assessed_coverage: float = Field(..., ge=0, le=1, description="Importance-weighted share with automated or reviewed evidence")
    verified_coverage: float = Field(..., ge=0, le=1, description="Importance-weighted share with human-reviewed evidence")
    evidence_sufficiency: Literal["low", "medium", "high"]
    skills: list[SkillAssessment]
    priority_gaps: list[SkillAssessment]
    demonstrated_weaknesses: list[str]
    missing_evidence: list[str]
    unassessed: list[str]
    self_reported_use: list[str]
    met: list[str]
    evidence_states: dict[str, list[str]] = Field(default_factory=dict, description="evidence state -> skills (every state present)")
    as_of: str | None = Field(None, description="Reference date used for freshness checks (None = freshness not evaluated)")
    notes: list[str] = Field(default_factory=list)
    method: str = "deterministic rules (transparent scoring; no trained model)"
    score_meaning: str = "Evidence-based progress indicator for guidance; not a measure of employability or a hiring probability."
