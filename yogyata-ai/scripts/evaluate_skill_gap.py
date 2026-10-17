"""Evaluate skill-gap analysis against hand-specified scenarios and consistency properties.

Usage: python scripts/evaluate_skill_gap.py [--out reports/skill_gap_eval.json]
(1) Scenario correctness: every hand-written expectation is an assertion; report pass rate and failures.
(2) Consistency properties checked programmatically over all scenarios:
    P1 evidence-order invariance; P2 adding strong verified evidence never lowers readiness nor raises that
    skill's priority; P3 skills with no information are never classed as weaknesses; P4 declared-only skills are
    never 'met'.
These test the internal consistency of documented rules, not real-world validity of the role model.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from yogyata_ai.skill_gap import analyze_skill_gap  # noqa: E402
from yogyata_ai.skill_gap.roles import default_catalog  # noqa: E402


def run(sc, extra=None):
    payload = {"profile": copy.deepcopy(sc["profile"]), "role_id": sc["role_id"]}
    if extra:
        payload["extra_evidence"] = extra
    return analyze_skill_gap(payload)


def check_scenario(sc):
    rep = run(sc)
    ex, fails, n = sc["expected"], [], 0
    skills = {s["skill"]: s for s in rep["skills"]}

    def ok(cond, msg):
        nonlocal n
        n += 1
        if not cond:
            fails.append(msg)

    for sk, st in ex.get("status", {}).items():
        ok(skills[sk]["status"] == st, f"{sk}: expected status {st}, got {skills[sk]['status']}")
    for sk, c in ex.get("confidence", {}).items():
        ok(skills[sk]["confidence"] == c, f"{sk}: expected confidence {c}, got {skills[sk]['confidence']}")
    if "all_status" in ex:
        ok(all(s["status"] == ex["all_status"] for s in rep["skills"]), f"not all skills are {ex['all_status']}")
    if "top_gap" in ex:
        ok(rep["priority_gaps"][0]["skill"] == ex["top_gap"], f"top gap {rep['priority_gaps'][0]['skill']} != {ex['top_gap']}")
    if "sufficiency" in ex:
        ok(rep["evidence_sufficiency"] == ex["sufficiency"], f"sufficiency {rep['evidence_sufficiency']} != {ex['sufficiency']}")
    if "weaknesses" in ex:
        ok(sorted(rep["demonstrated_weaknesses"]) == sorted(ex["weaknesses"]), f"weaknesses {rep['demonstrated_weaknesses']}")
    if "readiness_range" in ex:
        lo, hi = ex["readiness_range"]
        ok(lo <= rep["readiness_score"] <= hi, f"readiness {rep['readiness_score']} outside [{lo},{hi}]")
    for sk, need in ex.get("blocked_by_includes", {}).items():
        ok(set(need) <= set(skills[sk]["blocked_by"]), f"{sk}: blocked_by {skills[sk]['blocked_by']} lacks {need}")
    for frag in ex.get("notes_contain", []):
        ok(any(frag in x for x in rep["notes"]), f"no note containing '{frag}'")
    return n, fails


def consistency(scenarios):
    cat = default_catalog()
    results = {"P1_order_invariance": [0, 0], "P2_monotonic_verified_evidence": [0, 0],
               "P3_unknown_not_weakness": [0, 0], "P4_declared_never_met": [0, 0]}
    for sc in scenarios:
        rep = run(sc)
        ev = sc["profile"].get("evidence", [])
        # P1
        rev = copy.deepcopy(sc)
        rev["profile"]["evidence"] = list(reversed(ev))
        results["P1_order_invariance"][1] += 1
        results["P1_order_invariance"][0] += json.dumps(run(rev), sort_keys=True) == json.dumps(rep, sort_keys=True)
        # P3 / P4
        for s in rep["skills"]:
            if s["level"] == "none":
                results["P3_unknown_not_weakness"][1] += 1
                results["P3_unknown_not_weakness"][0] += s["status"] == "unassessed"
            if s["level"] == "declared":
                results["P4_declared_never_met"][1] += 1
                results["P4_declared_never_met"][0] += s["status"] != "met"
        # P2: for every role skill, add strong verified evidence
        before = {s["skill"]: s for s in rep["skills"]}
        for rs in cat.get(sc["role_id"]).skills:
            new = run(sc, [{"skill": rs.skill, "source": "task_review", "strength": 1.0, "ref_id": "p2"}])
            after = {s["skill"]: s for s in new["skills"]}
            results["P2_monotonic_verified_evidence"][1] += 1
            results["P2_monotonic_verified_evidence"][0] += (
                new["readiness_score"] >= rep["readiness_score"] and after[rs.skill]["priority"] <= before[rs.skill]["priority"])
    return {k: f"{a}/{b}" for k, (a, b) in results.items()}, all(a == b for a, b in results.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args()
    data = json.loads((ROOT / "data" / "demo" / "skill_gap_scenarios.json").read_text(encoding="utf-8"))
    total = passed = 0
    per = {}
    for sc in data["scenarios"]:
        n, fails = check_scenario(sc)
        total += n
        passed += n - len(fails)
        per[sc["id"]] = {"assertions": n, "failed": fails}
    cons, cons_ok = consistency(data["scenarios"])
    report = {"disclaimer": data["_disclaimer"], "n_scenarios": len(data["scenarios"]),
              "assertions_passed": f"{passed}/{total}", "per_scenario": per,
              "consistency_properties": cons, "all_consistency_properties_hold": cons_ok}
    out = json.dumps(report, indent=2)
    print(out)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(out, encoding="utf-8")


if __name__ == "__main__":
    main()
