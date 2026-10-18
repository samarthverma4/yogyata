"""Output schemas for the roadmap planner."""
from __future__ import annotations

import datetime as _dt
from typing import Any, Literal

from pydantic import BaseModel, Field


class WeekAllocation(BaseModel):
    week: int
    hours: float


class RoadmapItem(BaseModel):
    order: int
    activity_id: str
    skill: str
    type: str
    title: str
    hours: float
    start_week: int
    end_week: int
    objective: str
    reason: str
    expected_evidence: str
    evidence_source: str | None
    completion_criteria: str
    depends_on: list[str] = Field(default_factory=list)
    requires_review: bool = False
    hours_done: float = 0.0
    hours_remaining: float = 0.0
    allocations: list[WeekAllocation] = Field(default_factory=list, description="Exact hours scheduled per week for this item")


class WeekTask(BaseModel):
    activity_id: str
    title: str
    skill: str
    hours: float
    starts_here: bool
    finishes_here: bool


class WeekPlan(BaseModel):
    week: int
    start_date: _dt.date | None = None
    end_date: _dt.date | None = None
    capacity_hours: float
    allocated_hours: float
    free_hours: float
    tasks: list[WeekTask]


class Conflict(BaseModel):
    type: Literal["deadline_conflict", "time_budget_conflict"]
    message: str
    unscheduled_hours: float
    activity_ids: list[str]
    options: list[str]


class ScheduleSummary(BaseModel):
    capacity_respected: bool
    peak_week_hours: float
    horizon_weeks: int
    horizon_source: Literal["target_date", "timeline_weeks", "default", "target_date_and_timeline_weeks"]
    scheduled_hours: float
    unscheduled_hours: float
    completed_hours: float
    projected_completion_week: int | None = Field(None, description="Week in which ALL planned work would finish if the horizon were extended")
    projected_completion_date: _dt.date | None = None
    target_date: _dt.date | None = None
    deadline_met: bool | None = None


class DeferredItem(BaseModel):
    activity_id: str
    skill: str
    title: str
    hours: float
    reason: str


class MentorshipSuggestion(BaseModel):
    skill: str
    reason: str
    activity_id: str | None = None
    cost_note: str
    external_action_required: bool = True
    note: str = "Suggestion only. Nothing is booked or paid for by this system; booking is a separate, user-confirmed step."


class Milestone(BaseModel):
    skill: str
    status_now: str
    evidence_state: str = "not_assessed"
    target: str
    by_week: int
    activity_ids: list[str]


class Constraints(BaseModel):
    weekly_hours: float
    timeline_weeks: int
    hours_budget: float
    assumed: list[str] = Field(default_factory=list, description="Constraints that were not supplied and were defaulted")
    paid_activities_allowed: bool = True
    start_date: _dt.date | None = None
    target_date: _dt.date | None = None
    availability_by_week: dict[int, float] = Field(default_factory=dict, description="Per-week overrides of weekly_hours (1-based)")
    horizon_weeks: int = 0


class Roadmap(BaseModel):
    role_id: str
    role_title: str
    constraints: Constraints
    items: list[RoadmapItem]
    total_hours: float
    weeks_used: int
    deferred: list[DeferredItem]
    milestones: list[Milestone]
    weekly_schedule: list[WeekPlan] = Field(default_factory=list)
    schedule: ScheduleSummary | None = None
    conflicts: list[Conflict] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    mentorship_suggestions: list[MentorshipSuggestion]
    already_completed: list[str]
    gap_summary: dict[str, Any]
    notes: list[str] = Field(default_factory=list)
    method: str = "deterministic rule-based planner over a validated activity catalog (no trained model)"
    disclaimer: str = ("A plan is not an outcome. Completing or submitting an activity does not mean a skill is "
                       "competent; skill status changes only when assessed or human-reviewed evidence arrives.")
