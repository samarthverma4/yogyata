"""Invariant checks for evidence states, review caps, duplicate protection and the audit trail (Priority 2).

Runs over the demo skill-gap scenarios x several caps/scores. These are internal-consistency checks of deterministic
rules on synthetic data, not measurements of real-world accuracy.

Usage: python scripts/evaluate_evidence_review.py [--out reports/evidence_review_eval.json]
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from yogyata_ai.common.audit import AuditLog, verify_log  # noqa: E402
from yogyata_ai.common.evidence import EVIDENCE_STATES  # noqa: E402
from yogyata_ai.skill_gap import analyze_skill_gap, submit_review  # noqa: E402
from yogyata_ai.skill_gap.roles import default_catalog  # noqa: E402

CAPS = [0, 5, 10, 25, 100]
SCORES = [0.0, 0.3, 0.6, 0.85, 1.0]
ALLOWED = {"met": {"demonstrated"}, "developing": {"partially_demonstrated"}, "demonstrated_weakness": {"partially_demonstrated"},
           "self_reported_use": {"mentioned_unverified"}, "missing_evidence": {"mentioned_unverified", "missing_evidence"},
           "unassessed": {"not_assessed"}}
CHECKS = ["E1_state_status_mapping_consistent", "E2_every_skill_in_exactly_one_state", "E3_unassessed_never_weakness",
          "E4_cap_never_exceeded_any_role", "E5_applied_never_above_original_and_in_range", "E6_duplicate_is_noop",
          "E7_audit_chain_intact_and_append_only", "E8_capped_review_never_labelled_weakness", "E9_cap_monotone_in_score"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args()
    scen = json.loads((ROOT / "data" / "demo" / "skill_gap_scenarios.json").read_text(encoding="utf-8"))["scenarios"]
    roles = default_catalog().roles
    res = {c: [0, 0] for c in CHECKS}
    failures = []

    def rec(name, ok, ctx):
        res[name][1] += 1
        res[name][0] += bool(ok)
        if not ok:
            failures.append(f"{name}: {ctx}")

    for sc in scen:
        rep = analyze_skill_gap({"profile": sc["profile"], "role_id": sc["role_id"]})
        ctx = sc["id"]
        rec("E1_state_status_mapping_consistent", all(a["evidence_state"] in ALLOWED[a["status"]] for a in rep["skills"]), ctx)
        flat = sorted(x for v in rep["evidence_states"].values() for x in v)
        rec("E2_every_skill_in_exactly_one_state", set(rep["evidence_states"]) == set(EVIDENCE_STATES) and flat == sorted(a["skill"] for a in rep["skills"]), ctx)
        rec("E3_unassessed_never_weakness", all(a["status"] != "demonstrated_weakness" for a in rep["skills"] if a["evidence_state"] in ("not_assessed", "mentioned_unverified", "missing_evidence")), ctx)
        skills = [s.skill for s in roles[sc["role_id"]].skills][:4]
        for cap in CAPS:
            prev_applied = -1.0
            for score in SCORES:
                payload = {"profile": sc["profile"]}
                o = submit_review(payload, {"review_id": "ev-r1", "reviewer_id": "eval-reviewer", "kind": "task", "item_id": "eval-item",
                                            "skills": skills, "score": score, "reason": "evaluation sweep"},
                                  max_readiness_increase=cap, now="2026-10-18T10:00:00Z")
                c = f"{ctx} cap={cap} score={score}"
                r = o["review"]
                rec("E4_cap_never_exceeded_any_role", all(v["after"] - v["before"] <= cap + 1e-9 for v in o["readiness"].values())
                    and all(0 <= v["after"] <= 100 for v in o["readiness"].values()), c)
                rec("E5_applied_never_above_original_and_in_range", 0 <= r["applied_score"] <= r["original_score"] + 1e-12
                    and abs(r["applied_adjustment"] - (r["applied_score"] - r["original_score"])) < 1e-5, c)
                rec("E9_cap_monotone_in_score", r["applied_score"] >= prev_applied - 1e-12, c)
                prev_applied = r["applied_score"]
                again = submit_review(payload, {"review_id": "ev-r1", "reviewer_id": "eval-reviewer", "kind": "task", "item_id": "eval-item",
                                                "skills": skills, "score": score, "reason": "evaluation sweep"},
                                      ledger=copy.deepcopy(o["ledger"]), max_readiness_increase=cap, now="2026-10-18T10:00:00Z")
                rec("E6_duplicate_is_noop", again["status"] == "duplicate" and again["ledger"] == o["ledger"], c)
                nxt = submit_review(payload, {"review_id": "ev-r2", "reviewer_id": "eval-reviewer", "kind": "task", "item_id": "eval-item-2",
                                              "skills": skills[:1], "score": 0.5, "reason": "second review"}, ledger=o["ledger"],
                                    max_readiness_increase=cap, now="2026-10-18T11:00:00Z")
                old_ev, new_ev = o["ledger"]["audit"]["events"], nxt["ledger"]["audit"]["events"]
                rec("E7_audit_chain_intact_and_append_only", verify_log(AuditLog(**nxt["ledger"]["audit"])) == [] and new_ev[:len(old_ev)] == old_ev, c)
                gap = analyze_skill_gap({"profile": sc["profile"], "role_id": sc["role_id"], "review_ledger": o["ledger"]})
                if r["cap_applied"] and r["original_score"] >= 0.4:
                    rec("E8_capped_review_never_labelled_weakness", all(a["status"] != "demonstrated_weakness" for a in gap["skills"] if a["skill"] in skills and a["evidence_sources"] == ["task_review"]), c)
    report = {"disclaimer": "Invariant checks of deterministic rules over demo scenarios x caps x scores; internal consistency only.",
              "checks": {k: f"{a}/{b}" for k, (a, b) in res.items()},
              "all_checks_pass": all(a == b for a, b in res.values()) and all(b > 0 for _, b in res.values()), "failures": failures[:20]}
    out = json.dumps(report, indent=2)
    print(out)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(out, encoding="utf-8")
    return 0 if report["all_checks_pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
