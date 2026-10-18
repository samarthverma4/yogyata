"""Evaluate Resume Intelligence on the DEMONSTRATION dataset in data/demo.

Usage:  python scripts/evaluate_resume_intelligence.py [--out reports/resume_eval.json]

The dataset is tiny, synthetic and hand-labelled by the author, so these numbers are sanity
checks only. They are computed fresh on every run; none are hard-coded.
"""
from __future__ import annotations

import argparse
import itertools
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import ndcg_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from yogyata_ai.resume_intelligence.comparison import compare_resume_to_job  # noqa: E402
from yogyata_ai.resume_intelligence.matching import match_job  # noqa: E402
from yogyata_ai.resume_intelligence.scoring import analyze_resume  # noqa: E402

DEMO = ROOT / "data" / "demo"


def load():
    labels = json.loads((DEMO / "labels.json").read_text(encoding="utf-8"))
    texts = {k: (DEMO / v["file"]).read_text(encoding="utf-8") for k, v in labels["resumes"].items()}
    return labels, texts


def eval_skills(labels, texts):
    tp = fp = fn = 0
    per = {}
    for rid, meta in labels["resumes"].items():
        exp = set(meta["expected_skills"])
        got = {s.name for s in analyze_resume(texts[rid]).parsed.skills}
        tp += len(exp & got)
        fp += len(got - exp)
        fn += len(exp - got)
        if exp != got:
            per[rid] = {"missed": sorted(exp - got), "spurious": sorted(got - exp)}
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return {"micro_precision": round(p, 3), "micro_recall": round(r, 3), "micro_f1": round(f1, 3),
            "tp": tp, "fp": fp, "fn": fn, "mismatches": per}


def eval_quality(labels, texts):
    scores = {rid: analyze_resume(texts[rid]).overall_score for rid in labels["resumes"]}
    bands = {rid: m["quality_band"] for rid, m in labels["resumes"].items()}
    ids = list(scores)
    # Spearman with average ranks via pandas (handles ties properly)
    import pandas as pd
    rho = float(pd.Series([scores[i] for i in ids]).corr(pd.Series([bands[i] for i in ids]), method="spearman"))
    pairs = [(a, b) for a, b in itertools.combinations(ids, 2) if bands[a] != bands[b]]
    correct = sum((scores[a] > scores[b]) == (bands[a] > bands[b]) and scores[a] != scores[b] for a, b in pairs)
    wrong = [f"{a}({scores[a]}) vs {b}({scores[b]})" for a, b in pairs
             if not ((scores[a] > scores[b]) == (bands[a] > bands[b]) and scores[a] != scores[b])]
    return {"scores": scores, "spearman_vs_band": round(rho, 3),
            "pairwise_order_accuracy": round(correct / len(pairs), 3), "pairs": len(pairs),
            "misordered_pairs": wrong}


def eval_matching(labels, texts):
    ids = list(labels["resumes"])
    per, top1 = {}, []
    for jid, jd in labels["job_descriptions"].items():
        pred = [match_job(texts[r], jd["text"]).match_score for r in ids]
        true = [jd["relevance"].get(r, 0) for r in ids]
        per[jid] = {"ndcg": round(float(ndcg_score([true], [pred])), 3),
                    "top_ranked": ids[int(np.argmax(pred))]}
        top1.append(true[int(np.argmax(pred))] == max(true))
    return {"per_jd": per, "mean_ndcg": round(float(np.mean([v["ndcg"] for v in per.values()])), 3),
            "top1_hit_rate": round(float(np.mean(top1)), 3)}


def eval_structure(labels, texts):
    fields = {"n_education": lambda p: len(p.education), "graduation_year": lambda p: max((e.year for e in p.education if e.year), default=None),
              "n_experience": lambda p: len(p.experience), "n_projects": lambda p: len(p.projects),
              "n_certifications": lambda p: len(p.certifications)}
    hits = {k: 0 for k in fields}
    misses = []
    for rid, meta in labels["resumes"].items():
        parsed = analyze_resume(texts[rid]).parsed
        for k, fn in fields.items():
            ok = fn(parsed) == meta["expected_structure"][k]
            hits[k] += ok
            if not ok:
                misses.append(f"{rid}.{k}: expected {meta['expected_structure'][k]}, got {fn(parsed)}")
    n = len(labels["resumes"])
    return {"exact_match_accuracy": {k: round(v / n, 3) for k, v in hits.items()}, "misses": misses}


def eval_comparison(labels, texts):
    """Original match_job vs evidence-aware compare_resume_to_job on the same relevance labels."""
    ids = list(labels["resumes"])
    out = {}
    for name, fn in (("match_job_baseline", lambda r, j: match_job(texts[r], j).match_score),
                     ("compare_resume_to_job", lambda r, j: compare_resume_to_job(texts[r], j).alignment_score)):
        nd, top1 = [], []
        for jd in labels["job_descriptions"].values():
            pred = [fn(r, jd["text"]) for r in ids]
            true = [jd["relevance"].get(r, 0) for r in ids]
            nd.append(float(ndcg_score([true], [pred])))
            top1.append(true[int(np.argmax(pred))] == max(true))
        out[name] = {"mean_ndcg": round(float(np.mean(nd)), 3), "top1_hit_rate": round(float(np.mean(top1)), 3)}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    labels, texts = load()
    report = {
        "disclaimer": labels["_disclaimer"],
        "n_resumes": len(texts),
        "n_job_descriptions": len(labels["job_descriptions"]),
        "skill_extraction": eval_skills(labels, texts),
        "quality_scoring": eval_quality(labels, texts),
        "job_matching": eval_matching(labels, texts),
        "structure_extraction": eval_structure(labels, texts),
        "comparison_vs_baseline": eval_comparison(labels, texts),
    }
    out = json.dumps(report, indent=2)
    print(out)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(out, encoding="utf-8")


if __name__ == "__main__":
    main()
