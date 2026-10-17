"""Evaluate preliminary task feedback against author-rated demo submissions.

Usage: python scripts/evaluate_tasks.py [--out reports/tasks_eval.json]
Metrics: Spearman between indicative_completeness and the author's 0-3 element-presence rating; adversarial behaviour
(keyword stuffing flagged and scored low, injection flagged); integrity (always human_review_required, suggested
automated evidence never reaches the 'met' threshold). Tiny, author-labelled data: sanity check only.
Also checks recommendation behaviour on the skill-gap scenarios.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from yogyata_ai.practical_tasks import evaluate, recommend  # noqa: E402
from yogyata_ai.skill_gap.roles import default_catalog  # noqa: E402


def ranks(xs):
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    r = [0.0] * len(xs)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        for k in range(i, j + 1):
            r[order[k]] = (i + j) / 2 + 1
        i = j + 1
    return r


def spearman(a, b):
    ra, rb = ranks(a), ranks(b)
    ma, mb = sum(ra) / len(ra), sum(rb) / len(rb)
    num = sum((x - ma) * (y - mb) for x, y in zip(ra, rb))
    den = (sum((x - ma) ** 2 for x in ra) * sum((y - mb) ** 2 for y in rb)) ** 0.5
    return num / den if den else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args()
    data = json.loads((ROOT / "data" / "demo" / "task_submissions.json").read_text(encoding="utf-8"))
    normal, rows = [], []
    stuffed_ok = inj_ok = n_stuffed = n_inj = 0
    integrity_ok = True
    for s in data["submissions"]:
        r = evaluate(s["task_id"], s["text"], emit_evidence=True)
        integrity_ok &= r["human_review_required"] is True and r["status"] == "preliminary_unverified"
        integrity_ok &= all(e["strength"] < 0.6 and e["source"] == "task_auto" for e in r["suggested_evidence"])
        rows.append({"id": s["id"], "kind": s["kind"], "rating": s["rating"], "completeness": r["indicative_completeness"], "flags": r["flags"]})
        if s["kind"] == "normal":
            normal.append((s["rating"], r["indicative_completeness"] or 0.0, s["task_id"]))
        elif s["kind"] == "stuffed":
            n_stuffed += 1
            stuffed_ok += any("keyword_list" in f for f in r["flags"]) and (r["indicative_completeness"] or 0) <= 0.3 and not r["suggested_evidence"]
        elif s["kind"] == "injection":
            n_inj += 1
            inj_ok += any("prompt_injection" in f for f in r["flags"]) and not r["suggested_evidence"]
    rho = spearman([n[0] for n in normal], [n[1] for n in normal])
    per_task = {}
    for t in sorted({n[2] for n in normal}):
        xs = [(n[0], n[1]) for n in normal if n[2] == t]
        per_task[t] = round(spearman([x[0] for x in xs], [x[1] for x in xs]), 3)
    top = [c for rt, c, _ in normal if rt == 3]
    bottom = [c for rt, c, _ in normal if rt == 0]
    # recommendation checks over skill-gap scenarios
    scen = json.loads((ROOT / "data" / "demo" / "skill_gap_scenarios.json").read_text(encoding="utf-8"))["scenarios"]
    rec_checks = {"no_task_for_all_met_skills": 0, "no_unrelated_tasks": 0, "n": 0}
    for sc in scen:
        out = recommend({"profile": sc["profile"], "role_id": sc["role_id"], "limit": 10})
        rec_checks["n"] += 1
        rec_checks["no_task_for_all_met_skills"] += all(any(sk not in r["already_met_skills"] for sk in r["skills"]) for r in out["recommendations"])
        role_sk = {x.skill for x in default_catalog().get(sc["role_id"]).skills}
        rec_checks["no_unrelated_tasks"] += all(set(r["skills"]) & role_sk for r in out["recommendations"])
    report = {"disclaimer": data["_disclaimer"], "n_normal": len(normal), "spearman_completeness_vs_author_rating": round(rho, 3),
              "spearman_per_task": per_task, "mean_completeness_rating3": round(sum(top) / len(top), 3), "mean_completeness_rating0": round(sum(bottom) / len(bottom), 3),
              "stuffing_handled": f"{stuffed_ok}/{n_stuffed}", "injection_flagged_no_evidence": f"{inj_ok}/{n_inj}",
              "integrity_always_human_review_and_capped_evidence": integrity_ok,
              "recommendation_checks": rec_checks, "rows": rows}
    out = json.dumps(report, indent=2)
    print(out)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(out, encoding="utf-8")


if __name__ == "__main__":
    main()
