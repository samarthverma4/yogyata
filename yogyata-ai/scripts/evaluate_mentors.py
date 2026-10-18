"""Evaluate mentor recommendation on synthetic mentors and author-labelled relevance.

Usage: python scripts/evaluate_mentors.py [--out reports/mentors_eval.json]
Metrics: nDCG@3 and P@3 (relevance>=1) for the full system vs a text-only TF-IDF baseline (same hard filters);
hard-constraint adherence (budget, availability, accepting_students never violated). Sanity check on tiny data.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from yogyata_ai.common.similarity import TfidfSimilarity  # noqa: E402
from yogyata_ai.mentor_recommendation import recommend_mentors  # noqa: E402
from yogyata_ai.mentor_recommendation.schemas import Mentor, Slot  # noqa: E402
from yogyata_ai.mentor_recommendation.ranker import slots_overlap  # noqa: E402


def ndcg(ids, rel, k):
    dcg = sum((2 ** rel.get(m, 0) - 1) / math.log2(i + 2) for i, m in enumerate(ids[:k]))
    ideal = sorted(rel.values(), reverse=True)[:k]
    idcg = sum((2 ** r - 1) / math.log2(i + 2) for i, r in enumerate(ideal))
    return dcg / idcg if idcg else 0.0


def baseline(payload, mentors):
    """Text-only: rank eligible mentors by TF-IDF similarity of goals+role to mentor text."""
    prof = payload["profile"]
    q = f"{payload.get('role_id', '')} {prof.get('goals', '')} {' '.join(prof.get('declared_skills', []))}"
    bud = prof.get("budget_per_session_inr")
    av = [Slot(**s) for s in payload.get("availability") or []] or None
    keep = []
    for m in mentors:
        if not m.accepting_students:
            continue
        if bud is not None and m.price_per_session_inr is not None and m.price_per_session_inr > bud:
            continue
        if av is not None and m.availability is not None and not slots_overlap(av, m.availability, 60):
            continue
        keep.append(m)
    sims = TfidfSimilarity().similarities(q, [f"{m.headline} {m.bio}" for m in keep])
    return [m.id for _, m in sorted(zip(sims, keep), key=lambda x: (-x[0], x[1].id))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args()
    mentors_raw = json.loads((ROOT / "data" / "demo" / "mentors.json").read_text(encoding="utf-8"))["mentors"]
    mentors = {m["id"]: Mentor(**m) for m in mentors_raw}
    data = json.loads((ROOT / "data" / "demo" / "mentor_labels.json").read_text(encoding="utf-8"))
    rows, viol, checks = [], 0, 0
    sums = {"sys_ndcg": 0.0, "base_ndcg": 0.0, "sys_p": 0.0, "base_p": 0.0}
    for c in data["cases"]:
        p = {**c["payload"], "mentors": mentors_raw, "limit": 10}
        out = recommend_mentors(p)
        ids = [r["mentor_id"] for r in out["ranked"]]
        base = baseline(c["payload"], list(mentors.values()))
        rel = c["relevance"]
        s_nd, b_nd = ndcg(ids, rel, 3), ndcg(base, rel, 3)
        s_p = sum(rel.get(i, 0) >= 1 for i in ids[:3]) / 3
        b_p = sum(rel.get(i, 0) >= 1 for i in base[:3]) / 3
        for k, v in (("sys_ndcg", s_nd), ("base_ndcg", b_nd), ("sys_p", s_p), ("base_p", b_p)):
            sums[k] += v
        bud = c["payload"]["profile"].get("budget_per_session_inr")
        av = [Slot(**s) for s in c["payload"].get("availability") or []] or None
        for i in ids:
            m = mentors[i]
            checks += 1
            viol += (not m.accepting_students) or (bud is not None and m.price_per_session_inr is not None and m.price_per_session_inr > bud) \
                or (av is not None and m.availability is not None and not slots_overlap(av, m.availability, 60))
        rows.append({"case": c["id"], "system_top3": ids[:3], "baseline_top3": base[:3], "ndcg3_system": round(s_nd, 3), "ndcg3_baseline": round(b_nd, 3)})
    n = len(data["cases"])
    rep = {"disclaimer": data["_disclaimer"], "n_cases": n,
           "system": {"ndcg@3": round(sums["sys_ndcg"] / n, 3), "p@3": round(sums["sys_p"] / n, 3)},
           "text_only_baseline": {"ndcg@3": round(sums["base_ndcg"] / n, 3), "p@3": round(sums["base_p"] / n, 3)},
           "hard_constraint_violations": f"{viol}/{checks} recommended mentors", "cases": rows}
    out = json.dumps(rep, indent=2)
    print(out)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(out, encoding="utf-8")


if __name__ == "__main__":
    main()
