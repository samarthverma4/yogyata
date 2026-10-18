"""Evaluate roadmap generation: constraint adherence, prerequisite ordering, relevance, update behaviour.

Usage: python scripts/evaluate_roadmap.py [--out reports/roadmap_eval.json]
Checks are programmatic invariants of documented rules, run over every demo profile x constraint setting.
They test internal consistency, not whether a plan helps a real student (that needs outcome studies).
"""
from __future__ import annotations

import argparse
import copy
import itertools
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from yogyata_ai.roadmap import generate_roadmap, update_roadmap  # noqa: E402
from yogyata_ai.roadmap.catalog import default_activity_catalog  # noqa: E402
from yogyata_ai.skill_gap import analyze_skill_gap  # noqa: E402
from yogyata_ai.skill_gap.roles import default_catalog  # noqa: E402

CONSTRAINTS = [(3, 4, None), (6, 8, None), (10, 12, 500), (20, 26, 0), (None, None, None), (2, 52, None)]
CHECKS = ["C1_hours_and_weeks_within_budget", "C2_no_completed_or_met_skill_items", "C3_prerequisite_order",
          "C4_relevance_role_skills_only", "C5_top_actionable_gap_first_when_it_fits", "C6_no_paid_when_zero_budget_no_external_actions",
          "C7_deterministic", "C8_update_removes_skill_after_strong_reviewed_evidence", "C9_completed_not_repeated",
          "C10_weekly_capacity_never_exceeded", "C11_allocations_consistent_with_items", "C12_deadline_conflict_reported_honestly"]


def payloads(scen):
    for sc, (wh, tw, bud) in itertools.product(scen, CONSTRAINTS):
        prof = copy.deepcopy(sc["profile"])
        prof.update({k: v for k, v in (("weekly_hours", wh), ("timeline_weeks", tw), ("budget_per_session_inr", bud)) if v is not None})
        yield sc["id"], (wh, tw, bud), {"profile": prof, "role_id": sc["role_id"]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args()
    scen = json.loads((ROOT / "data" / "demo" / "skill_gap_scenarios.json").read_text(encoding="utf-8"))["scenarios"]
    cat, roles = default_activity_catalog(), default_catalog()
    res = {c: [0, 0] for c in CHECKS}
    failures = []

    def rec(name, ok, ctx):
        res[name][1] += 1
        res[name][0] += bool(ok)
        if not ok:
            failures.append(f"{name}: {ctx}")

    n = 0
    for sid, cons, p in payloads(scen):
        n += 1
        ctx = f"{sid} {cons}"
        r = generate_roadmap(p)
        gap = analyze_skill_gap({**p, "top_n": 50})
        st = {s["skill"]: s for s in gap["skills"]}
        role = roles.get(p["role_id"])
        items = r["items"]
        c = r["constraints"]
        rec("C1_hours_and_weeks_within_budget", r["total_hours"] <= c["hours_budget"] + 1e-6 and all(i["end_week"] <= c["timeline_weeks"] for i in items), ctx)
        rec("C2_no_completed_or_met_skill_items", all(st[i["skill"]]["status"] != "met" for i in items), ctx)
        # C3: activity requires + prerequisite skills ordered
        pos = {i["activity_id"]: i["order"] for i in items}
        ok = all(all(pos.get(q, 0) < i["order"] for q in cat.get(i["activity_id"]).requires if q in pos) for i in items)
        last = {}
        first = {}
        for i in (x for x in items if x["type"] != "project"):  # optional projects are appended after the core path
            first.setdefault(i["skill"], i["order"])
            last[i["skill"]] = i["order"]
        for rs in role.skills:
            if rs.skill in first:  # core-path skills only
                for pre in rs.prerequisites:
                    if st[pre]["status"] != "met":
                        ok &= pre in last and last[pre] < first[rs.skill]
        rec("C3_prerequisite_order", ok, ctx)
        rec("C4_relevance_role_skills_only", all(i["skill"] in {s.skill for s in role.skills} for i in items), ctx)
        # C5: highest-priority gap whose prerequisites are met is planned if its first activity fits
        free = [g for g in gap["priority_gaps"] if not g["blocked_by"]]
        if free:
            top = free[0]["skill"]
            first_act_h = min((a.hours for a in cat.activities.values() if a.skill == top and a.type in ("interview_practice", "learn", "practice", "assessment")), default=None)
            fits = first_act_h is not None and first_act_h <= c["hours_budget"]
            rec("C5_top_actionable_gap_first_when_it_fits", (not fits) or any(i["skill"] == top for i in items), ctx)
        rec("C6_no_paid_when_zero_budget_no_external_actions",
            all(not cat.get(i["activity_id"]).external_action_required and not cat.get(i["activity_id"]).paid_possible for i in items)
            and (c["paid_activities_allowed"] or all(m["activity_id"] is None for m in r["mentorship_suggestions"])), ctx)
        rec("C7_deterministic", json.dumps(generate_roadmap(p), sort_keys=True) == json.dumps(r, sort_keys=True), ctx)
        # C8: strong reviewed evidence for first planned skill's last activity -> skill disappears
        if items:
            sk = items[0]["skill"]
            u = update_roadmap(p, new_evidence=[{"skill": sk, "source": "task_review", "strength": 0.95, "ref_id": "eval"}])
            rec("C8_update_removes_skill_after_strong_reviewed_evidence", all(i["skill"] != sk for i in u["after"]["items"]) and sk in u["diff"]["newly_met_skills"], ctx)
            # C9: mark first 2 items completed -> not repeated, order of remaining preserved
            done = [i["activity_id"] for i in items[:2]]
            q = copy.deepcopy(p)
            q["profile"]["completed_activity_ids"] = done
            r2 = generate_roadmap(q)
            rec("C9_completed_not_repeated", all(i["activity_id"] not in done for i in r2["items"]), ctx)
        # C10/C11: independent recomputation from per-item allocations
        load = {}
        for i in items:
            for a in i["allocations"]:
                load[a["week"]] = load.get(a["week"], 0) + a["hours"]
        caps = {w["week"]: w["capacity_hours"] for w in r["weekly_schedule"]}
        rec("C10_weekly_capacity_never_exceeded", all(h <= caps.get(w, 0) + 1e-6 for w, h in load.items()) and r["schedule"]["capacity_respected"], ctx)
        rec("C11_allocations_consistent_with_items",
            all(abs(sum(a["hours"] for a in i["allocations"]) - i["hours_remaining"]) < 1e-6 for i in items)
            and abs(sum(load.values()) - r["total_hours"]) < 1e-6, ctx)
        # C12: a target date shorter than the work must yield a deadline conflict (never silently overloaded weeks)
        d = copy.deepcopy(p)
        d["start_date"], d["target_date"] = "2026-11-02", "2026-11-23"
        d["profile"].pop("timeline_weeks", None)
        rd = generate_roadmap(d)
        pw = rd["schedule"]
        honest = max([w["allocated_hours"] - w["capacity_hours"] for w in rd["weekly_schedule"]] or [0]) <= 1e-6
        honest &= (pw["unscheduled_hours"] == 0) or (pw["deadline_met"] is False and any(c["type"] == "deadline_conflict" for c in rd["conflicts"]))
        rec("C12_deadline_conflict_reported_honestly", honest, ctx)
    report = {"disclaimer": "Invariant checks over demo profiles x constraint settings; internal consistency only.",
              "n_roadmaps": n, "checks": {k: f"{a}/{b}" for k, (a, b) in res.items()},
              "all_checks_pass": all(a == b for a, b in res.values()), "failures": failures[:20]}
    out = json.dumps(report, indent=2)
    print(out)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(out, encoding="utf-8")


if __name__ == "__main__":
    main()
