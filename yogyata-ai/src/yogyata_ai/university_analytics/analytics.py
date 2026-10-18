from __future__ import annotations

from collections import Counter, defaultdict

from yogyata_ai.skill_gap.analysis import analyze_gap
from yogyata_ai.skill_gap.roles import RoleCatalog

from .schemas import AnalyticsReport, CohortRecord, GroupStats, SkillRow

POOLED_LABEL = "Other (small groups pooled)"


def _stats(label: str, rows: list[tuple[CohortRecord, object]], k: int, members: list[str] | None = None) -> GroupStats:
    n = len(rows)
    reps = [r for _, r in rows]
    suff = Counter(r.evidence_sufficiency for r in reps)
    per_skill: dict[str, dict] = defaultdict(lambda: {"app": 0, "assessed": 0, "weak": 0, "met": 0, "unassessed": 0})
    for rep in reps:
        for s in rep.skills:
            d = per_skill[s.skill]
            d["app"] += 1
            if s.level in ("demonstrated", "verified"):
                d["assessed"] += 1
                d["weak"] += s.status == "demonstrated_weakness"
                d["met"] += s.status == "met"
            if s.status == "unassessed":
                d["unassessed"] += 1
    skill_rows = []
    for sk, d in sorted(per_skill.items()):
        if d["assessed"] >= k:  # a rate over fewer than k assessed students is not reported
            skill_rows.append(SkillRow(skill=sk, applicable_n=d["app"], assessed_n=d["assessed"],
                                       weakness_share_of_assessed=round(d["weak"] / d["assessed"], 2),
                                       met_share_of_assessed=round(d["met"] / d["assessed"], 2),
                                       unassessed_share_of_applicable=round(d["unassessed"] / d["app"], 2)))
    top = [r.skill for r in sorted(skill_rows, key=lambda r: (-r.weakness_share_of_assessed, r.skill)) if r.weakness_share_of_assessed > 0][:5]
    known = [rec.placed for rec, _ in rows if rec.placed is not None]
    if len(known) >= k:
        placement = {"known_outcome_n": len(known), "known_outcome_share": round(len(known) / n, 2),
                     "placed_share_of_known": round(sum(known) / len(known), 2),
                     "note": "association only; not a prediction or guarantee"}
    else:
        placement = {"suppressed": "fewer than k students with a known outcome"}
    return GroupStats(label=label, n=n, readiness_mean=round(sum(r.readiness_score for r in reps) / n, 1),
                      readiness_mean_range=[round(sum(r.readiness_min for r in reps) / n, 1), round(sum(r.readiness_max for r in reps) / n, 1)],
                      evidence_sufficiency_share={x: round(suff.get(x, 0) / n, 2) for x in ("low", "medium", "high")},
                      skill_rows=skill_rows, top_gaps=top, placement=placement, members=members or [])


def analyze_cohort(records: list[CohortRecord], roles: RoleCatalog, *, group_by: str = "department", k: int = 10,
                   default_role_id: str | None = None) -> AnalyticsReport:
    warnings: list[str] = []
    notes: list[str] = []
    rows: list[tuple[CohortRecord, object]] = []
    skipped = 0
    for rec in records:
        rid = rec.target_role or rec.profile.target_role or default_role_id
        try:
            role = roles.get(rid) if rid else None
        except ValueError:
            role = None
        if role is None:
            skipped += 1
            continue
        rows.append((rec, analyze_gap(rec.profile, role, top_n=50)))
    if skipped:
        warnings.append(f"{skipped} record(s) skipped: missing or unknown target role.")
    total = len(rows)
    overall = _stats("All students", rows, k) if total >= k else None
    if overall is None:
        notes.append(f"Cohort has fewer than k={k} usable records: no statistics are released.")
        return AnalyticsReport(group_by=group_by, k=k, overall=None, groups=[], pooled=None, suppression_notes=notes,
                               skipped_records=skipped, warnings=warnings)
    buckets: dict[str, list] = defaultdict(list)
    for rec, rep in rows:
        v = getattr(rec, group_by) if group_by != "target_role" else (rec.target_role or rec.profile.target_role or default_role_id)
        buckets[str(v) if v is not None else "Unknown"].append((rec, rep))
    big = {g: r for g, r in buckets.items() if len(r) >= k}
    small = {g: r for g, r in buckets.items() if len(r) < k}
    pooled_rows = [x for r in small.values() for x in r]
    pooled_members = sorted(small)
    # complementary suppression: pooled group must itself reach k, else absorb the smallest shown group
    while pooled_rows and len(pooled_rows) < k and big:
        g = min(big, key=lambda x: (len(big[x]), x))
        pooled_rows += big.pop(g)
        pooled_members.append(g)
        notes.append("A larger group was pooled with the small groups so that suppressed counts cannot be derived by subtraction.")
    if pooled_rows and len(pooled_rows) < k:
        pooled_rows_final = []
        notes.append("Groups are too small to report separately; only overall statistics are released.")
        big = {}
        pooled = None
    else:
        pooled_rows_final = pooled_rows
        pooled = _stats(POOLED_LABEL, pooled_rows_final, k, sorted(pooled_members)) if pooled_rows_final else None
    if small and pooled is not None:
        notes.append(f"{len(small)} group(s) with fewer than {k} students were pooled.")
    groups = [_stats(g, r, k) for g, r in sorted(big.items())]
    return AnalyticsReport(group_by=group_by, k=k, overall=overall, groups=groups, pooled=pooled, suppression_notes=notes,
                           skipped_records=skipped, warnings=warnings)
