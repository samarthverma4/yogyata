"""Prerequisite-aware, time-budget-aware roadmap planner.

Algorithm (all deterministic):
1. Take every non-'met' skill from the gap report.
2. Order skills by priority but never before their unmet prerequisite skills (topological, priority-greedy).
3. For each skill pick an activity sequence by evidence status (e.g. a skill only claimed on the resume gets a
   reviewed task, not a learning course; an unassessed skill gets a diagnostic interview and learning first).
4. Drop activities already completed (never repeated); lay the rest out sequentially against weekly_hours and the
   total hours budget. Anything that does not fit, or depends on something deferred, is listed under 'deferred'.
"""
from __future__ import annotations

import datetime as dt
import math

from yogyata_ai.common.schemas import StudentProfile
from yogyata_ai.skill_gap.analysis import analyze_gap
from yogyata_ai.skill_gap.roles import RoleConfig
from yogyata_ai.skill_gap.schemas import GapReport, SkillAssessment

from .catalog import Activity, ActivityCatalog
from .scheduler import Task, check_schedule_integrity, schedule, schedule_complete_only, validate_capacities
from .schemas import (
    Conflict, Constraints, DeferredItem, MentorshipSuggestion, Milestone, Roadmap, RoadmapItem, ScheduleSummary,
    WeekAllocation, WeekPlan, WeekTask,
)

DEFAULT_WEEKLY_HOURS = 6.0
DEFAULT_WEEKS = 8
MAX_PROJECTION_WEEKS = 520

SEQUENCES = {
    "demonstrated_weakness": ["learn", "practice", "assessment"],
    "developing": ["practice", "assessment"],
    "unassessed": ["interview_practice", "learn", "practice", "assessment"],
    "missing_evidence": ["interview_practice", "practice", "assessment"],
    "self_reported_use": ["interview_practice", "assessment"],
}
STATUS_PHRASE = {
    "demonstrated_weakness": "assessment shows weak performance",
    "developing": "evidence is mixed",
    "unassessed": "nothing is known yet (not a weakness)",
    "missing_evidence": "the skill is declared but unsupported by evidence",
    "self_reported_use": "the skill appears only in your own resume/claims",
}
STEP_WHY = {
    "learn": "builds the concepts first",
    "practice": "turns concepts into working skill",
    "assessment": "produces reviewed evidence; a submission alone proves nothing",
    "interview_practice": "gives a quick, automated (unverified) read on your current level",
    "project": "adds a portfolio artefact once the basics are in place",
}


def _order_skills(gaps: list[SkillAssessment]) -> list[SkillAssessment]:
    remaining = {g.skill: g for g in gaps}
    ordered: list[SkillAssessment] = []
    done: set[str] = set()
    while remaining:
        ready = [g for g in remaining.values() if all(b in done or b not in remaining for b in g.blocked_by)]
        pick = sorted(ready or remaining.values(), key=lambda g: (-g.priority, g.skill))[0]
        ordered.append(pick)
        done.add(pick.skill)
        del remaining[pick.skill]
    return ordered


def _horizon(profile: StudentProfile, start_date, target_date, assumed: list[str]) -> tuple[int, str]:
    tw = profile.timeline_weeks
    if target_date is not None:
        if start_date is None:
            raise ValueError("start_date is required when target_date is given")
        days = (target_date - start_date).days
        if days < 1:
            raise ValueError("target_date must be after start_date")
        wt = math.ceil(days / 7)
        if tw is not None:
            return min(tw, wt), "target_date_and_timeline_weeks"
        return wt, "target_date"
    if tw is not None:
        return tw, "timeline_weeks"
    assumed.append(f"timeline_weeks not given: assumed {DEFAULT_WEEKS}")
    return DEFAULT_WEEKS, "default"


def _clean_availability(raw: dict | None, horizon: int, notes: list[str]) -> dict[int, float]:
    out: dict[int, float] = {}
    for k, v in (raw or {}).items():
        try:
            w = int(k)
        except (TypeError, ValueError):
            raise ValueError(f"availability_by_week key {k!r} is not a week number") from None
        if w < 1:
            raise ValueError("availability_by_week weeks are 1-based")
        validate_capacities([v])
        if w > horizon:
            notes.append(f"availability for week {w} ignored: it is beyond the {horizon}-week horizon")
            continue
        out[w] = float(v)
    return out


def build_roadmap(profile: StudentProfile, role: RoleConfig, catalog: ActivityCatalog, *,
                  include_projects: bool = True, max_items: int | None = None,
                  start_date: dt.date | None = None, target_date: dt.date | None = None,
                  availability_by_week: dict | None = None, in_progress: dict[str, float] | None = None,
                  as_of=None, evidence_config=None) -> Roadmap:
    report: GapReport = analyze_gap(profile, role, top_n=50, config=evidence_config, as_of=as_of)
    assumed: list[str] = []
    notes: list[str] = []
    weekly = profile.weekly_hours
    if weekly is None:
        weekly = DEFAULT_WEEKLY_HOURS
        assumed.append(f"weekly_hours not given: assumed {DEFAULT_WEEKLY_HOURS:g}")
    horizon, horizon_source = _horizon(profile, start_date, target_date, assumed)
    avail = _clean_availability(availability_by_week, horizon, notes)
    caps = validate_capacities([avail.get(w, weekly) for w in range(1, horizon + 1)])
    budget_h = sum(caps)
    paid_ok = profile.budget_per_session_inr is None or profile.budget_per_session_inr > 0
    known = set(catalog.activities)
    completed = [c for c in profile.completed_activity_ids if c in known]
    unknown_done = [c for c in profile.completed_activity_ids if c not in known]
    if unknown_done:
        notes.append(f"Ignored unknown completed_activity_ids: {', '.join(unknown_done)}")
    done_set = set(completed)
    progress: dict[str, float] = {}
    for k, v in (in_progress or {}).items():
        if k not in known:
            notes.append(f"Ignored in_progress for unknown activity '{k}'")
        elif not isinstance(v, (int, float)) or isinstance(v, bool) or v < 0 or math.isnan(v):
            raise ValueError(f"in_progress hours for '{k}' must be a non-negative number")
        elif k in done_set:
            notes.append(f"in_progress for '{k}' ignored: it is already completed")
        else:
            progress[k] = float(v)
    if assumed:
        notes.append("Defaults used for missing constraints; supply them for a tailored plan.")

    gaps = [s for s in report.skills if s.status != "met"]
    skill_status = {s.skill: s for s in report.skills}
    cands: list[dict] = []                       # ordered candidate activities (before scheduling)
    skill_cands: dict[str, list[str]] = {}
    skill_blocked: dict[str, str] = {}
    deferred_pre: list[DeferredItem] = []
    mentor: list[MentorshipSuggestion] = []
    no_activity: list[str] = []
    processed: set[str] = set()

    for sa in _order_skills(gaps):
        seq_types = SEQUENCES.get(sa.status, ["practice", "assessment"])
        seq = [a for t in seq_types if (a := catalog.find(sa.skill, t)) is not None]
        processed.add(sa.skill)
        skill_cands[sa.skill] = []
        if not seq:
            no_activity.append(sa.skill)
            skill_blocked[sa.skill] = "no catalog activity"
            continue
        head = f"{sa.skill} (priority {sa.priority:g}, importance {sa.importance}/5): {STATUS_PHRASE.get(sa.status, sa.status)}"
        if sa.unlocks:
            head += f"; unlocks {sa.unlocks} other skill(s)"
        unmet = [b for b in sa.blocked_by]
        blocked_prereq = [b for b in unmet if b in skill_blocked]
        prereq_deps = [skill_cands[b][-1] for b in unmet if skill_cands.get(b)]
        seq_ids = {a.id for a in seq}
        for act in seq:
            if act.id in done_set:
                continue
            if blocked_prereq:
                deferred_pre.append(DeferredItem(activity_id=act.id, skill=sa.skill, title=act.title, hours=act.hours,
                                                 reason="prerequisite skill(s) not fully planned: " + ", ".join(blocked_prereq)))
                skill_blocked.setdefault(sa.skill, "prerequisite blocked")
                continue
            if sa.skill in skill_blocked:
                deferred_pre.append(DeferredItem(activity_id=act.id, skill=sa.skill, title=act.title, hours=act.hours,
                                                 reason="depends on a deferred earlier step"))
                continue
            deps = [r for r in act.requires if r in seq_ids and r not in done_set]
            cands.append({"act": act, "sa": sa, "why": f"{head}. This step {STEP_WHY.get(act.type, 'moves you forward')}.",
                          "deps": deps + prereq_deps, "shown_deps": deps + [f"skill:{b}" for b in unmet if not deps][:3]})
            skill_cands[sa.skill].append(act.id)
        if sa.status == "demonstrated_weakness" and all(a.id in done_set for a in seq):
            m = catalog.find(sa.skill, "mentor_review")
            mentor.append(MentorshipSuggestion(
                skill=sa.skill, activity_id=m.id if m else None,
                reason="You completed the standard learn/practice/assess path but evidence for this skill is still weak; "
                       "repeating the same steps is unlikely to help, so targeted expert feedback is suggested.",
                cost_note=("Paid sessions are excluded by your zero session budget." if not paid_ok
                           else "Cost and availability are not known here; see mentor recommendations.")))

    if include_projects:
        for c in list(cands):
            sk = c["act"].skill
            proj = catalog.find(sk, "project")
            if proj and proj.id not in done_set and all(i["act"].id != proj.id for i in cands):
                reqs = [r for r in proj.requires if r not in done_set]
                if all(r in skill_cands.get(sk, []) for r in reqs):
                    cands.append({"act": proj, "sa": skill_status[sk], "why": f"{sk}: {STEP_WHY['project']}.",
                                  "deps": list(dict.fromkeys(reqs + skill_cands[sk])), "shown_deps": reqs})
                    skill_cands[sk].append(proj.id)
            break

    cut: list[DeferredItem] = []
    if max_items is not None and len(cands) > max_items:
        for c in cands[max_items:]:
            a = c["act"]
            cut.append(DeferredItem(activity_id=a.id, skill=a.skill, title=a.title, hours=a.hours, reason=f"max_items={max_items} reached"))
        cands = cands[:max_items]

    tasks = [Task(c["act"].id, c["act"].hours, [d for d in c["deps"] if d in {x["act"].id for x in cands}], progress.get(c["act"].id, 0.0)) for c in cands]
    res, dropped = schedule_complete_only(tasks, caps, completed=set(done_set))
    # tasks reported complete because in-progress hours >= duration are removed from the plan
    problems = check_schedule_integrity(tasks, caps, res, completed=set(done_set))
    if problems:  # defensive: must never happen
        raise RuntimeError("internal scheduling error: " + "; ".join(problems[:3]))
    notes += res.issues

    def week_dates(w: int):
        if start_date is None:
            return None, None
        s0 = start_date + dt.timedelta(days=7 * (w - 1))
        return s0, s0 + dt.timedelta(days=6)

    items: list[RoadmapItem] = []
    by_cand = {c["act"].id: c for c in cands}
    for c in cands:
        a, sa = c["act"], c["sa"]
        if a.id not in res.allocations or not res.allocations[a.id]:
            continue
        al = res.allocations[a.id]
        done_h = progress.get(a.id, 0.0)
        items.append(RoadmapItem(
            order=len(items) + 1, activity_id=a.id, skill=a.skill, type=a.type, title=a.title, hours=a.hours,
            start_week=al[0][0], end_week=al[-1][0], objective=a.objective, reason=c["why"] + (f" ({done_h:g}h already done.)" if done_h else ""),
            expected_evidence=a.expected_evidence, evidence_source=a.evidence_source, completion_criteria=a.completion_criteria,
            depends_on=c["shown_deps"], requires_review=a.requires_review, hours_done=done_h,
            hours_remaining=round(a.hours - done_h, 6), allocations=[WeekAllocation(week=w, hours=h) for w, h in al]))

    deferred = list(deferred_pre) + cut
    for aid, why in dropped.items():
        a = by_cand[aid]["act"]
        suffix = "" if why.startswith(("missing", "blocked")) else f" within {horizon} week(s) ({budget_h:g}h total)"
        deferred.append(DeferredItem(activity_id=aid, skill=a.skill, title=a.title, hours=a.hours, reason=why + suffix))

    # weekly schedule
    weekly_plan: list[WeekPlan] = []
    for w in range(1, horizon + 1):
        tl = []
        for i in items:
            for al in i.allocations:
                if al.week == w:
                    tl.append(WeekTask(activity_id=i.activity_id, title=i.title, skill=i.skill, hours=al.hours,
                                       starts_here=i.allocations[0].week == w, finishes_here=i.allocations[-1].week == w))
        alloc = round(sum(t.hours for t in tl), 6)
        s0, e0 = week_dates(w)
        weekly_plan.append(WeekPlan(week=w, start_date=s0, end_date=e0, capacity_hours=caps[w - 1], allocated_hours=alloc,
                                    free_hours=round(caps[w - 1] - alloc, 6), tasks=tl))

    # projection: how long would EVERYTHING take at the same availability (extended past the horizon)?
    unsched_hours = round(sum(by_cand[d.activity_id]["act"].hours - progress.get(d.activity_id, 0.0) for d in deferred
                              if d.activity_id in by_cand and not d.reason.startswith("missing")), 6)
    proj_week = None
    if cands:
        ext = caps + [weekly] * (MAX_PROJECTION_WEEKS - horizon)
        full = schedule(tasks, ext, completed=set(done_set))
        if not full.unscheduled and full.finish_week:
            proj_week = max(full.finish_week.values())
    proj_date = None
    if proj_week and start_date:
        proj_date = start_date + dt.timedelta(days=7 * proj_week - 1)
    scheduled_hours = round(sum(sum(h for _, h in al) for al in res.allocations.values()), 6)
    completed_h = round(sum(catalog.get(c).hours for c in completed) + sum(progress.values()), 6) if completed or progress else 0.0
    deadline_exists = target_date is not None or horizon_source in ("timeline_weeks", "target_date_and_timeline_weeks")
    conflicts: list[Conflict] = []
    if deferred:
        ids = [d.activity_id for d in deferred]
        opts = []
        if unsched_hours > 0:
            extra = math.ceil(unsched_hours / horizon * 10) / 10
            opts.append(f"increase availability by about {extra:g}h per week to fit everything")
        if proj_week:
            when = f" (about {proj_date.isoformat()})" if proj_date else ""
            opts.append(f"extend the timeline to {proj_week} week(s){when}")
        opts.append("or accept the lower-priority steps being deferred")
        kind = "deadline_conflict" if (target_date is not None) else "time_budget_conflict"
        conflicts.append(Conflict(
            type=kind, unscheduled_hours=unsched_hours, activity_ids=ids, options=opts,
            message=(f"{len(ids)} step(s) ({unsched_hours:g}h) cannot be completed "
                     + (f"before the target date {target_date.isoformat()}" if target_date else f"within {horizon} week(s)")
                     + f" at the available hours; nothing was squeezed past the weekly limit.")))
        notes.append(f"{len(deferred)} activity(ies) did not fit; see conflicts for options.")
    deadline_met = (not deferred) if target_date is not None else None
    peak = max((w.allocated_hours for w in weekly_plan), default=0.0)
    summary = ScheduleSummary(
        capacity_respected=all(w.allocated_hours <= w.capacity_hours + 1e-6 for w in weekly_plan), peak_week_hours=peak,
        horizon_weeks=horizon, horizon_source=horizon_source, scheduled_hours=scheduled_hours, unscheduled_hours=unsched_hours,
        completed_hours=completed_h, projected_completion_week=proj_week, projected_completion_date=proj_date,
        target_date=target_date, deadline_met=deadline_met)

    # mentorship, milestones, notes
    if items and not any(m.skill == items[0].skill for m in mentor):
        top = items[0].skill
        m = catalog.find(top, "mentor_review")
        if m:
            mentor.append(MentorshipSuggestion(
                skill=top, activity_id=m.id,
                reason=f"{top} is your highest-priority gap; a reviewer or mentor can turn practice into verified evidence.",
                cost_note=("Paid sessions are excluded by your zero session budget." if not paid_ok
                           else "Cost and availability are not known here; see mentor recommendations.")))
    if not paid_ok:
        mentor = [m.model_copy(update={"activity_id": None}) for m in mentor]
    milestones: list[Milestone] = []
    for sk in dict.fromkeys(i.skill for i in items):
        its = [i for i in items if i.skill == sk]
        milestones.append(Milestone(
            skill=sk, status_now=skill_status[sk].status,
            evidence_state=skill_status[sk].evidence_state, by_week=max(i.end_week for i in its),
            activity_ids=[i.activity_id for i in its],
            target="Assessed or reviewed evidence with strength >= 0.6 (status 'met' needs evidence, not just completion)."))
    if no_activity:
        notes.append("No catalog activity for: " + ", ".join(sorted(no_activity)) + " (add activities to cover them).")
    if not gaps:
        notes.append("All role skills are already met on current evidence; no learning activities are needed.")
    if report.evidence_sufficiency == "low":
        notes.append("Evidence is thin, so this plan starts with diagnostics and reviewed tasks rather than assuming gaps.")
    gap_summary = {"readiness_score": report.readiness_score, "evidence_sufficiency": report.evidence_sufficiency,
                   "met": report.met, "demonstrated_weaknesses": report.demonstrated_weaknesses,
                   "unassessed": report.unassessed, "missing_evidence": report.missing_evidence,
                   "self_reported_use": report.self_reported_use}
    total = round(sum(i.hours_remaining for i in items), 2)
    return Roadmap(
        role_id=role.id, role_title=role.title,
        constraints=Constraints(weekly_hours=weekly, timeline_weeks=horizon, hours_budget=round(budget_h, 2), assumed=assumed,
                                paid_activities_allowed=paid_ok, start_date=start_date, target_date=target_date,
                                availability_by_week=avail, horizon_weeks=horizon),
        items=items, total_hours=total, weeks_used=max((i.end_week for i in items), default=0), deferred=deferred,
        milestones=milestones, weekly_schedule=weekly_plan, schedule=summary, conflicts=conflicts, issues=list(res.issues),
        mentorship_suggestions=mentor, already_completed=completed, gap_summary=gap_summary, notes=list(dict.fromkeys(notes)))
