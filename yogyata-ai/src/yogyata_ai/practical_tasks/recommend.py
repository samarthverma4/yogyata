"""Recommend practical tasks that address a student's evidence-based skill gaps."""
from __future__ import annotations

from yogyata_ai.common.schemas import StudentProfile
from yogyata_ai.skill_gap.analysis import analyze_gap
from yogyata_ai.skill_gap.roles import RoleConfig

from .catalog import TaskCatalog
from .schemas import NotRecommended, TaskRecommendation, TaskRecommendations

_RANK = {"beginner": 0, "intermediate": 1, "advanced": 2}
_TARGET = {"demonstrated_weakness": "beginner", "unassessed": "beginner", "missing_evidence": "intermediate",
           "self_reported_use": "intermediate", "developing": "intermediate"}


def recommend_tasks(profile: StudentProfile, role: RoleConfig, catalog: TaskCatalog, *, limit: int = 5,
                    completed_task_ids: list[str] | None = None) -> TaskRecommendations:
    report = analyze_gap(profile, role, top_n=50)
    st = {s.skill: s for s in report.skills}
    done = set(completed_task_ids or [])
    hours_budget = (profile.weekly_hours * profile.timeline_weeks) if profile.weekly_hours and profile.timeline_weeks else None
    recs: list[TaskRecommendation] = []
    out: list[NotRecommended] = []
    for t in catalog.tasks.values():
        in_role = [s for s in t.skills if s in st]
        if not in_role:
            out.append(NotRecommended(task_id=t.id, reason="trains no skill required for this role"))
            continue
        if t.id in done:
            out.append(NotRecommended(task_id=t.id, reason="already submitted; resubmitting does not add competence without a reviewed result"))
            continue
        open_skills = [s for s in in_role if st[s].status != "met"]
        met = [s for s in in_role if st[s].status == "met"]
        if not open_skills:
            out.append(NotRecommended(task_id=t.id, reason="all its role-relevant skills are already met on current evidence"))
            continue
        weak_pre = [p for p in t.prerequisite_skills if p in st and st[p].status == "demonstrated_weakness"]
        if weak_pre:
            out.append(NotRecommended(task_id=t.id, reason="build these prerequisites first (assessed as weak): " + ", ".join(weak_pre)))
            continue
        if hours_budget is not None and t.estimated_hours > hours_budget:
            out.append(NotRecommended(task_id=t.id, reason=f"needs {t.estimated_hours:g}h, more than your {hours_budget:g}h budget"))
            continue
        pr = sum(st[s].priority for s in open_skills) / len(open_skills)
        want = min(_RANK[_TARGET[st[s].status]] for s in open_skills)
        diff_pen = 12 * abs(_RANK[t.difficulty] - want)
        score = round(max(0.0, min(100.0, pr + 5 * (len(open_skills) - 1) - diff_pen)), 1)
        reasons = [f"{s}: {st[s].status.replace('_', ' ')} (priority {st[s].priority:g})" for s in open_skills]
        if diff_pen:
            reasons.append(f"difficulty '{t.difficulty}' is {'above' if _RANK[t.difficulty] > want else 'below'} the suggested level '{_TARGET[st[open_skills[0]].status]}'")
        recs.append(TaskRecommendation(task_id=t.id, title=t.title, skills=t.skills, difficulty=t.difficulty,
                                       estimated_hours=t.estimated_hours, score=score, reasons=reasons, already_met_skills=met))
    recs.sort(key=lambda r: (-r.score, r.estimated_hours, r.task_id))
    notes = []
    if report.evidence_sufficiency == "low":
        notes.append("Evidence about this student is thin; recommendations favour tasks that will produce reviewable evidence.")
    return TaskRecommendations(recommendations=recs[:limit], not_recommended=out, notes=notes)
