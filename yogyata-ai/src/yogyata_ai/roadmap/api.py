"""Public integration surface for roadmap generation and updates."""
from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import Field

from yogyata_ai.common.evidence import EvidenceConfig
from yogyata_ai.common.schemas import EvidenceRecord
from yogyata_ai.skill_gap.api import _GapInput, merge_evidence
from yogyata_ai.skill_gap.roles import RoleCatalog, default_catalog

from .catalog import ActivityCatalog, default_activity_catalog
from .planner import build_roadmap
from .schemas import Roadmap


class _RoadmapInput(_GapInput):
    include_projects: bool = True
    max_items: int | None = Field(None, ge=1, le=100)
    start_date: date | None = None
    target_date: date | None = None
    availability_by_week: dict[int, float] = Field(default_factory=dict, description="1-based week -> available hours (overrides weekly_hours)")
    in_progress: dict[str, float] = Field(default_factory=dict, description="activity id -> hours already spent")


def generate_roadmap(payload: dict[str, Any], *, roles: RoleCatalog | None = None,
                     activities: ActivityCatalog | None = None) -> dict[str, Any]:
    """payload: {"profile", "role_id"?, "interview_evaluations"?, "extra_evidence"?, "include_projects"?, "max_items"?}."""
    return _build(payload, roles, activities).model_dump(mode="json")


def _build(payload, roles, activities) -> Roadmap:
    d = _RoadmapInput(**payload)
    role_id = d.role_id or d.profile.target_role
    if not role_id:
        raise ValueError("role_id is required (or set profile.target_role)")
    role = (roles or default_catalog()).get(role_id)
    profile = merge_evidence(d.profile, d.interview_evaluations, d.extra_evidence, d.review_ledger)
    return build_roadmap(profile, role, activities or default_activity_catalog(),
                         include_projects=d.include_projects, max_items=d.max_items, start_date=d.start_date,
                         target_date=d.target_date, availability_by_week=d.availability_by_week, in_progress=d.in_progress,
                         as_of=d.as_of, evidence_config=EvidenceConfig(**{k: v for k, v in (
                             ("stale_after_days", d.stale_after_days), ("conflict_spread", d.conflict_spread)) if v is not None}))


def update_roadmap(payload: dict[str, Any], *, new_evidence: list[dict[str, Any]] | None = None,
                   completed_activity_ids: list[str] | None = None, in_progress: dict[str, float] | None = None,
                   weekly_hours: float | None = None, availability_by_week: dict[int, float] | None = None,
                   start_date: str | date | None = None, target_date: str | date | None = None,
                   roles: RoleCatalog | None = None, activities: ActivityCatalog | None = None) -> dict[str, Any]:
    """Regenerate after new evidence, completed/in-progress activities, or changed availability/dates, and explain the diff.

    The remaining schedule is recomputed from `start_date` (pass today's date to re-plan from now): completed work is not
    rescheduled, in-progress work keeps only its remaining hours, and changed availability applies to the new weeks.
    """
    before = _build(payload, roles, activities)
    for e in new_evidence or []:
        EvidenceRecord(**e)  # validate early
    merged = dict(payload)
    merged["extra_evidence"] = [*payload.get("extra_evidence", []), *(new_evidence or [])]
    prof = dict(merged["profile"]) if isinstance(merged["profile"], dict) else merged["profile"].model_dump()
    prof["completed_activity_ids"] = list(dict.fromkeys([*prof.get("completed_activity_ids", []), *(completed_activity_ids or [])]))
    if weekly_hours is not None:
        prof["weekly_hours"] = weekly_hours
    merged["profile"] = prof
    if in_progress:
        merged["in_progress"] = {**payload.get("in_progress", {}), **in_progress}
    if availability_by_week is not None:
        merged["availability_by_week"] = availability_by_week
    if start_date is not None:
        merged["start_date"] = start_date
    if target_date is not None:
        merged["target_date"] = target_date
    after = _build(merged, roles, activities)

    b_ids, a_ids = {i.activity_id: i for i in before.items}, {i.activity_id: i for i in after.items}
    done_new = set(completed_activity_ids or [])
    now_met = set(after.gap_summary["met"]) - set(before.gap_summary["met"])
    removed = []
    for aid, it in b_ids.items():
        if aid in a_ids:
            continue
        reason = ("marked completed" if aid in done_new else
                  f"{it.skill} is now met on current evidence" if it.skill in now_met else
                  "deferred: no longer fits the time available" if aid in {d.activity_id for d in after.deferred} else
                  "no longer needed or re-prioritised after the update")
        removed.append({"activity_id": aid, "skill": it.skill, "reason": reason})
    added = [{"activity_id": aid, "skill": it.skill, "reason": "newly planned (re-prioritised or freed time)"}
             for aid, it in a_ids.items() if aid not in b_ids]
    moved = [{"activity_id": aid, "weeks_before": [b_ids[aid].start_week, b_ids[aid].end_week], "weeks_after": [it.start_week, it.end_week]}
             for aid, it in a_ids.items() if aid in b_ids and (b_ids[aid].start_week, b_ids[aid].end_week) != (it.start_week, it.end_week)]
    bs, as_ = before.schedule, after.schedule
    diff = {"removed": removed, "added": added, "kept": [a for a in a_ids if a in b_ids], "moved": moved,
            "newly_met_skills": sorted(now_met),
            "readiness_delta": round(after.gap_summary["readiness_score"] - before.gap_summary["readiness_score"], 1),
            "schedule": {"remaining_hours": [before.total_hours, after.total_hours],
                         "unscheduled_hours": [bs.unscheduled_hours, as_.unscheduled_hours],
                         "projected_completion_week": [bs.projected_completion_week, as_.projected_completion_week],
                         "deadline_met": [bs.deadline_met, as_.deadline_met],
                         "conflicts": [len(before.conflicts), len(after.conflicts)]},
            "note": "Completing an activity removes it from the plan but does not change skill status; only evidence does."}
    return {"before": before.model_dump(mode="json"), "after": after.model_dump(mode="json"), "diff": diff}
