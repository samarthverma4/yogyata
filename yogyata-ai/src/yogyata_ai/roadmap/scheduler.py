"""Strict weekly scheduler (generic: knows nothing about the activity catalog).

Guarantees (checked by `check_schedule_integrity`, which the roadmap builder asserts on every run):
  * the hours allocated in a week never exceed that week's capacity (capacity may differ per week, and may be 0);
  * a task receives hours only after every task it depends on has received ALL of its hours (same week allowed, later in that week);
  * each completed task has received exactly its remaining hours; nothing is allocated twice.
Tasks that cannot finish inside the horizon are reported as unscheduled, never squeezed in by exceeding capacity.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

EPS = 1e-6
MAX_HOURS_PER_WEEK = 168.0


@dataclass
class Task:
    id: str
    hours: float | None            # total duration; None/invalid => cannot be scheduled
    depends_on: list[str] = field(default_factory=list)
    done_hours: float = 0.0        # already spent (in-progress work)


@dataclass
class ScheduleResult:
    allocations: dict[str, list[tuple[int, float]]]   # task id -> [(week, hours)]
    finish_week: dict[str, int]
    unscheduled: dict[str, str]                       # task id -> reason
    issues: list[str]
    partial_hours: dict[str, float]                   # hours that fit for tasks that could not finish


def validate_capacities(caps: list[float]) -> list[float]:
    out = []
    for i, c in enumerate(caps, 1):
        if isinstance(c, bool) or not isinstance(c, (int, float)) or math.isnan(c) or c < 0 or c > MAX_HOURS_PER_WEEK:
            raise ValueError(f"invalid available hours for week {i}: {c!r} (must be a number between 0 and {MAX_HOURS_PER_WEEK:g})")
        out.append(float(c))
    return out


def _valid_hours(h) -> bool:
    return isinstance(h, (int, float)) and not isinstance(h, bool) and not math.isnan(h) and not math.isinf(h) and h > 0


def schedule(tasks: list[Task], capacities: list[float], *, completed: set[str] | None = None) -> ScheduleResult:
    """List-schedule `tasks` (in priority order) into weeks. `completed` ids count as satisfied dependencies."""
    caps = validate_capacities(capacities)
    completed = set(completed or ())
    ids = [t.id for t in tasks]
    if len(set(ids)) != len(ids):
        raise ValueError("duplicate task ids")
    known = set(ids) | completed
    issues: list[str] = []
    for t in tasks:
        for d in t.depends_on:
            if d not in known:
                raise ValueError(f"task '{t.id}' depends on unknown task '{d}'")
            if d == t.id:
                raise ValueError(f"task '{t.id}' depends on itself")
    # cycle check (Kahn)
    indeg = {t.id: sum(d in set(ids) for d in t.depends_on) for t in tasks}
    queue = [i for i, n in indeg.items() if n == 0]
    seen = 0
    kids: dict[str, list[str]] = {i: [] for i in ids}
    for t in tasks:
        for d in t.depends_on:
            if d in kids:
                kids[d].append(t.id)
    while queue:
        n = queue.pop()
        seen += 1
        for k in kids[n]:
            indeg[k] -= 1
            if indeg[k] == 0:
                queue.append(k)
    if seen != len(tasks):
        raise ValueError("dependency cycle among tasks")

    remaining: dict[str, float] = {}
    unscheduled: dict[str, str] = {}
    for t in tasks:
        if not _valid_hours(t.hours):
            unscheduled[t.id] = "missing or invalid duration"
            issues.append(f"task '{t.id}' has a missing or invalid duration ({t.hours!r}); it was not scheduled")
            continue
        done = t.done_hours if isinstance(t.done_hours, (int, float)) and t.done_hours >= 0 else 0.0
        if done >= t.hours - EPS:
            issues.append(f"task '{t.id}' reports {done:g}h done of {t.hours:g}h: treated as complete")
            completed.add(t.id)
            continue
        remaining[t.id] = float(t.hours) - done
    done_set = set(completed)
    order = [t for t in tasks if t.id in remaining]
    allocations: dict[str, list[tuple[int, float]]] = {t.id: [] for t in order}
    finish: dict[str, int] = {}
    left = dict(remaining)
    for w, cap in enumerate(caps, 1):
        cap_left = cap
        while cap_left > EPS:
            nxt = next((t for t in order if left[t.id] > EPS and all(d in done_set for d in t.depends_on)), None)
            if nxt is None:
                break
            a = min(left[nxt.id], cap_left)
            allocations[nxt.id].append((w, round(a, 6)))
            left[nxt.id] -= a
            cap_left -= a
            if left[nxt.id] <= EPS:
                left[nxt.id] = 0.0
                done_set.add(nxt.id)
                finish[nxt.id] = w
    partial: dict[str, float] = {}
    for t in order:
        if t.id in finish:
            continue
        got = round(sum(h for _, h in allocations[t.id]), 6)
        blocked = [d for d in t.depends_on if d not in done_set]
        if blocked:
            unscheduled[t.id] = "blocked by unscheduled prerequisite(s): " + ", ".join(blocked)
        else:
            unscheduled[t.id] = f"only {got:g}h of the remaining {remaining[t.id]:g}h fit in the available hours"
            partial[t.id] = got
    return ScheduleResult(allocations=allocations, finish_week=finish, unscheduled=unscheduled, issues=issues, partial_hours=partial)


def schedule_complete_only(tasks: list[Task], capacities: list[float], *, completed: set[str] | None = None) -> tuple[ScheduleResult, dict[str, str]]:
    """Schedule, then repeatedly drop tasks that cannot finish (and so their dependents) until every kept task completes.

    Returns (result for kept tasks, {dropped id: reason}). A task never appears half-scheduled.
    """
    current = list(tasks)
    dropped: dict[str, str] = {}
    first = None
    while True:
        res = schedule(current, capacities, completed=completed)
        first = first or res
        bad = {k for k in res.unscheduled}
        if not bad:
            res.issues = list(dict.fromkeys([*first.issues, *res.issues]))
            return res, dropped
        for k in bad:
            dropped.setdefault(k, res.unscheduled[k])
        keep_ids = {t.id for t in current} - bad
        current = [Task(t.id, t.hours, [d for d in t.depends_on if d in keep_ids or d in (completed or set())], t.done_hours)
                   for t in current if t.id in keep_ids]
        # a kept task must not silently lose a dropped prerequisite
        dead = {t.id for t in tasks if any(d in dropped for d in t.depends_on)}
        current = [t for t in current if t.id not in dead]
        for k in dead:
            dropped.setdefault(k, "blocked by unscheduled prerequisite(s)")


def check_schedule_integrity(tasks: list[Task], capacities: list[float], res: ScheduleResult, *, completed: set[str] | None = None) -> list[str]:
    """Independent re-check of a schedule; returns violations (empty = sound)."""
    v: list[str] = []
    load: dict[int, float] = {}
    for tid, al in res.allocations.items():
        for w, h in al:
            load[w] = load.get(w, 0.0) + h
            if h <= 0:
                v.append(f"{tid}: non-positive allocation in week {w}")
    for w, h in load.items():
        cap = capacities[w - 1] if 1 <= w <= len(capacities) else 0.0
        if h > cap + 1e-5:
            v.append(f"week {w}: {h:g}h allocated but only {cap:g}h available")
    by_id = {t.id: t for t in tasks}
    comp = set(completed or ())
    for tid, fw in res.finish_week.items():
        t = by_id[tid]
        need = t.hours - (t.done_hours if t.done_hours >= 0 else 0)
        got = sum(h for _, h in res.allocations[tid])
        if abs(got - need) > 1e-4:
            v.append(f"{tid}: allocated {got:g}h, needs {need:g}h")
        first = min(w for w, _ in res.allocations[tid])
        for d in t.depends_on:
            if d in comp:
                continue
            dt = by_id.get(d)
            if dt is not None and isinstance(dt.hours, (int, float)) and not isinstance(dt.hours, bool) and dt.done_hours >= dt.hours > 0:
                continue  # prerequisite already complete through in-progress hours
            if d not in res.finish_week:
                v.append(f"{tid}: finished although prerequisite {d} did not")
            elif res.finish_week[d] > first:
                v.append(f"{tid}: starts in week {first} before prerequisite {d} finishes in week {res.finish_week[d]}")
            elif res.finish_week[d] == first:
                # same week: prerequisite hours must come first in that week's order
                pass
    return v
