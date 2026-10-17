"""Evaluate opportunity matching on DEMONSTRATION data (hand-labelled by the author).

Usage: python scripts/evaluate_matching.py [--out reports/matching_eval.json]
Compares the full system (eligibility + evidence-weighted coverage + similarity) with two naive
baselines (TF-IDF only; plain listed-skill coverage), both without eligibility filtering.
Metrics: Precision@3 (relevance >= 1), NDCG@3 / NDCG@5, eligibility exact-match, and stuffing resistance.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import ndcg_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from yogyata_ai.common.schemas import EducationInfo  # noqa: E402
from yogyata_ai.common.similarity import TfidfSimilarity  # noqa: E402
from yogyata_ai.opportunity_matching.ranker import (  # noqa: E402
    normalise_opportunity_skills, opportunity_document, rank_opportunities, student_document,
)
from yogyata_ai.opportunity_matching.schemas import Opportunity  # noqa: E402
from yogyata_ai.resume_intelligence.profile import profile_from_analysis  # noqa: E402
from yogyata_ai.resume_intelligence.scoring import analyze_resume  # noqa: E402

DEMO = ROOT / "data" / "demo"


def build_profiles(labels):
    resumes = json.loads((DEMO / "labels.json").read_text(encoding="utf-8"))["resumes"]
    profiles = {}
    for pid, meta in labels["profiles"].items():
        text = (DEMO / resumes[pid]["file"]).read_text(encoding="utf-8")
        analysis = analyze_resume(text)
        p = analysis.parsed
        edu_year = max((e.year for e in p.education if e.year), default=None)
        ov = meta["overrides"]
        edu = EducationInfo(degree=p.education[0].degree if p.education else None,
                            graduation_year=ov.get("graduation_year", edu_year), cgpa=ov.get("cgpa"))
        prof = profile_from_analysis(analysis, education=edu)
        prof.profile_text = text
        profiles[pid] = prof
    return profiles


def metrics(rank_scores: dict, relevance: dict, ids: list[str]):
    true = np.array([[relevance.get(i, 0) for i in ids]], dtype=float)
    pred = np.array([[rank_scores[i] for i in ids]], dtype=float)
    order = [ids[j] for j in np.argsort(-pred[0], kind="stable")]
    p3 = np.mean([relevance.get(i, 0) >= 1 for i in order[:3]])
    return {"p@3": float(p3), "ndcg@3": float(ndcg_score(true, pred, k=3)), "ndcg@5": float(ndcg_score(true, pred, k=5))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    args = ap.parse_args()
    labels = json.loads((DEMO / "opportunity_labels.json").read_text(encoding="utf-8"))
    opps = [Opportunity(**o) for o in json.loads((DEMO / "opportunities.json").read_text(encoding="utf-8"))["opportunities"]]
    ids = [o.id for o in opps]
    profiles = build_profiles(labels)
    sim = TfidfSimilarity()

    systems = {"full_system": {}, "baseline_tfidf_only": {}, "baseline_plain_skill_coverage": {}}
    elig_hits, elig_detail, full_scores = 0, {}, {}
    for pid, prof in profiles.items():
        res = rank_opportunities(prof, opps)
        got_excl = sorted(e.opportunity_id for e in res.excluded)
        exp_excl = sorted(labels["profiles"][pid]["expected_excluded"])
        elig_hits += got_excl == exp_excl
        if got_excl != exp_excl:
            elig_detail[pid] = {"expected": exp_excl, "got": got_excl}
        scores = {r.opportunity_id: r.score for r in res.ranked}
        full_scores[pid] = scores
        systems["full_system"][pid] = {i: scores.get(i, -1.0) for i in ids}
        docs = [opportunity_document(o, *normalise_opportunity_skills(o)[:2]) for o in opps]
        systems["baseline_tfidf_only"][pid] = dict(zip(ids, sim.similarities(student_document(prof), docs)))
        declared = set(prof.declared_skills)
        plain = {}
        for o in opps:
            req = normalise_opportunity_skills(o)[0]
            plain[o.id] = sum(s in declared for s in req) / len(req) if req else 0.0
        systems["baseline_plain_skill_coverage"][pid] = plain

    rank_pids = [p for p, m in labels["profiles"].items() if m["relevance"]]
    summary = {}
    for name, per in systems.items():
        rows = [metrics(per[p], labels["profiles"][p]["relevance"], ids) for p in rank_pids]
        summary[name] = {k: round(float(np.mean([r[k] for r in rows])), 3) for k in rows[0]}

    pairs = {}
    for name, per in systems.items():
        wins = 0
        for pr in labels["stuffing_pairs"]:
            o = pr["opportunity"]
            wins += per[pr["honest"]][o] > per[pr["stuffer"]][o]
        pairs[name] = f"{wins}/{len(labels['stuffing_pairs'])}"

    report = {
        "disclaimer": labels["_disclaimer"],
        "n_profiles_ranked": len(rank_pids), "n_opportunities": len(opps),
        "ranking_metrics_mean_over_profiles": summary,
        "eligibility_exact_match": f"{elig_hits}/{len(profiles)}", "eligibility_mismatches": elig_detail,
        "stuffing_resistance_pairs_honest_ranked_above_stuffer": pairs,
        "note": "Embedding backend not evaluated (sentence-transformers not installed here).",
    }
    out = json.dumps(report, indent=2)
    print(out)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(out, encoding="utf-8")


if __name__ == "__main__":
    main()
