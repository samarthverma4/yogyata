"""Evaluate the deterministic interview evaluator against the author's ratings (DEMONSTRATION data).

Usage: python scripts/evaluate_interview.py [--out reports/interview_eval.json]
Metrics: MAE, Spearman correlation, share within +/-15 points, and a keyword-stuffing check
(a bare list of key terms must score below a genuine answer to the same question).
Numbers are computed on every run; with one rater and ~24 answers they are sanity checks only.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from yogyata_ai.interview.bank import default_bank  # noqa: E402
from yogyata_ai.interview.evaluator import evaluate_answer  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args()
    data = json.loads((ROOT / "data" / "demo" / "interview_answers.json").read_text(encoding="utf-8"))
    bank = default_bank()
    rows = []
    for a in data["answers"]:
        ev = evaluate_answer(bank.get(a["question_id"]), a["text"])
        rows.append({"id": a["id"], "question_id": a["question_id"], "category": a["category"],
                     "type": ev.interview_type, "human": a["human_overall"], "model": ev.overall,
                     "confidence": ev.confidence})
    df = pd.DataFrame(rows)
    err = (df.model - df.human).abs()

    def block(d):
        e = (d.model - d.human).abs()
        return {"n": int(len(d)), "mae": round(float(e.mean()), 1),
                "spearman": round(float(d.model.corr(d.human, method="spearman")), 3) if len(d) > 2 else None,
                "within_15": round(float((e <= 15).mean()), 3)}

    stuff = []
    for _, r in df[df.category == "stuffed"].iterrows():
        strong = df[(df.question_id == r.question_id) & (df.category == "strong")]
        if len(strong):
            stuff.append({"question_id": r.question_id, "stuffed": r.model, "strong": float(strong.model.iloc[0]),
                          "stuffed_below_strong_by": round(float(strong.model.iloc[0] - r.model), 1)})
    report = {
        "disclaimer": data["_disclaimer"],
        "overall": block(df),
        "technical": block(df[df.type == "technical"]),
        "hr": block(df[df.type == "hr"]),
        "mean_score_by_category": {k: round(float(v), 1) for k, v in df.groupby("category").model.mean().items()},
        "largest_errors": df.assign(abs_err=err.round(1)).sort_values("abs_err", ascending=False).head(5)[
            ["id", "category", "human", "model", "abs_err"]].to_dict("records"),
        "keyword_stuffing_check": {"cases": stuff, "all_below_strong_by_20_plus": all(c["stuffed_below_strong_by"] >= 20 for c in stuff)},
        "confidence_counts": df.confidence.value_counts().to_dict(),
    }
    out = json.dumps(report, indent=2, default=lambda o: o.item() if hasattr(o, "item") else str(o))
    print(out)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(out, encoding="utf-8")


if __name__ == "__main__":
    main()
