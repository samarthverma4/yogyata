"""Run every evaluation script and write reports/*.json. Prints a one-screen summary of the real numbers produced.

Usage: python scripts/run_all_evaluations.py
All evaluations use small synthetic/author-labelled demo data; see each report's `disclaimer`. Numbers are sanity checks,
not evidence of real-world performance.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JOBS = [("resume_intelligence", "evaluate_resume_intelligence.py", "resume_eval.json"),
        ("interview", "evaluate_interview.py", "interview_eval.json"),
        ("opportunity_matching", "evaluate_matching.py", "matching_eval.json"),
        ("skill_gap", "evaluate_skill_gap.py", "skill_gap_eval.json"),
        ("roadmap", "evaluate_roadmap.py", "roadmap_eval.json"),
        ("evidence_review", "evaluate_evidence_review.py", "evidence_review_eval.json"),
        ("practical_tasks", "evaluate_tasks.py", "tasks_eval.json"),
        ("mentors", "evaluate_mentors.py", "mentors_eval.json"),
        ("university_analytics", "evaluate_analytics.py", "analytics_eval.json"),
        ("agent", "evaluate_agent.py", "agent_eval.json")]


def pick(d, *path):
    for p in path:
        d = d.get(p, {}) if isinstance(d, dict) else {}
    return d or None


def main() -> int:
    failed = []
    for name, script, out in JOBS:
        proc = subprocess.run([sys.executable, str(ROOT / "scripts" / script), "--out", str(ROOT / "reports" / out)],
                              capture_output=True, text=True, cwd=ROOT)
        status = "ok" if proc.returncode == 0 else f"FAILED (exit {proc.returncode})"
        print(f"{name:22s} {status}  -> reports/{out}")
        if proc.returncode:
            failed.append(name)
            print(proc.stderr[-600:])
    print("\nHeadline numbers (see each report for detail and caveats):")
    rd = lambda f: json.loads((ROOT / "reports" / f).read_text(encoding="utf-8")) if (ROOT / "reports" / f).exists() else {}  # noqa: E731
    for label, f, keys in [
        ("skill_gap assertions", "skill_gap_eval.json", ["assertions_passed"]),
        ("skill_gap consistency", "skill_gap_eval.json", ["all_consistency_properties_hold"]),
        ("roadmap checks all pass", "roadmap_eval.json", ["all_checks_pass"]),
        ("evidence/review checks pass", "evidence_review_eval.json", ["all_checks_pass"]),
        ("tasks spearman", "tasks_eval.json", ["spearman_completeness_vs_author_rating"]),
        ("mentors system", "mentors_eval.json", ["system"]),
        ("mentors baseline", "mentors_eval.json", ["text_only_baseline"]),
        ("analytics privacy invariants", "analytics_eval.json", ["all_privacy_invariants_hold"]),
        ("agent tool success", "agent_eval.json", ["end_to_end", "tool_success_rate"]),
        ("agent recovery", "agent_eval.json", ["failure_recovery", "recovered_cleanly"]),
        ("agent injection", "agent_eval.json", ["adversarial_injection", "untrusted_field_cases"]),
    ]:
        print(f"  {label:30s} {pick(rd(f), *keys)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
