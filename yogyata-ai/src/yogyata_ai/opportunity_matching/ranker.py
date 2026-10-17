"""Ranking of opportunities for one student.

Classification: hybrid. Eligibility = deterministic rules (eligibility.py). Skill coverage = deterministic,
evidence-weighted via the shared taxonomy. Text similarity = TF-IDF (default, fitted on the supplied
opportunities and the student document) or pretrained Sentence Transformers when configured and
available. No supervised ranking model is trained.
"""
from __future__ import annotations

from yogyata_ai.common.evidence import level_of, summarize_evidence
from yogyata_ai.common.requirements import extract_requirements
from yogyata_ai.common.schemas import StudentProfile
from yogyata_ai.common.similarity import SimilarityBackend, get_backend_with_status
from yogyata_ai.common.taxonomy import get_taxonomy

from .eligibility import check_eligibility, eligibility_status
from .schemas import (
    ExcludedOpportunity, MatchResult, MatchWeights, Opportunity, RankedOpportunity, SkillMatch,
)


def skill_credit(level: str, strength: float | None) -> float:
    """How strongly the evidence supports a skill (0..1). A documented convention, not a measurement."""
    s = strength if strength is not None else 0.5
    if level == "none":
        return 0.0
    if level == "declared":
        return 0.5
    if level == "demonstrated":
        return s if s < 0.5 else min(1.0, 0.6 + 0.4 * s)
    return s if s < 0.5 else min(1.0, 0.75 + 0.25 * s)  # verified


def normalise_opportunity_skills(opp: Opportunity) -> tuple[list[str], list[str], list[str]]:
    """Return (required, preferred, unknown_names) using the shared taxonomy; falls back to the description."""
    tax = get_taxonomy()
    req, unk1 = tax.normalize_many(opp.required_skills)
    pref, unk2 = tax.normalize_many(opp.preferred_skills)
    if not req and not pref and opp.description:
        req, pref = extract_requirements(opp.description)
    pref = [p for p in pref if p not in req]
    return req, pref, unk1 + [u for u in unk2 if u not in unk1]


def student_document(profile: StudentProfile) -> str:
    return " ".join([profile.target_role or "", profile.goals, " ".join(profile.declared_skills), profile.profile_text])


def opportunity_document(opp: Opportunity, req: list[str], pref: list[str]) -> str:
    return " ".join([opp.title, opp.description, " ".join(req), " ".join(pref)])


def _preference_fit(profile: StudentProfile, opp: Opportunity) -> tuple[float, list[str]]:
    parts, notes = [], []
    if profile.preferred_opportunity_types:
        ok = opp.type in profile.preferred_opportunity_types
        parts.append(1.0 if ok else 0.2)
        notes.append("matches your preferred opportunity type" if ok else "not one of your preferred opportunity types")
    if profile.preferred_work_modes and opp.work_mode:
        ok = opp.work_mode in profile.preferred_work_modes
        parts.append(1.0 if ok else 0.2)
        notes.append(f"{opp.work_mode} work mode matches your preference" if ok else f"{opp.work_mode} work mode differs from your preference")
    if profile.location and opp.location and opp.work_mode in ("onsite", "hybrid"):
        ok = profile.location.strip().lower() == opp.location.strip().lower()
        parts.append(1.0 if ok else 0.3)
        notes.append(f"located in your city ({opp.location})" if ok else f"located in {opp.location}, not {profile.location}")
    return (sum(parts) / len(parts) if parts else 0.5), notes


def rank_opportunities(profile: StudentProfile, opportunities: list[Opportunity], *,
                       weights: MatchWeights | None = None, backend: SimilarityBackend | None = None,
                       top_k: int | None = None, include_ineligible: bool = False) -> MatchResult:
    weights = weights or MatchWeights()
    warnings: list[str] = []
    if backend is None:
        backend, status = get_backend_with_status()
    else:
        status = type(backend).__name__

    seen, opps = set(), []
    for o in opportunities:
        if o.id in seen:
            warnings.append(f"Duplicate opportunity id '{o.id}' ignored.")
            continue
        seen.add(o.id)
        opps.append(o)

    summaries = summarize_evidence(profile)
    normalised = {o.id: normalise_opportunity_skills(o) for o in opps}
    sims = backend.similarities(student_document(profile),
                                [opportunity_document(o, *normalised[o.id][:2]) for o in opps])
    if not profile.declared_skills and not profile.evidence:
        warnings.append("Profile has no skills or evidence; ranking relies on text similarity and preferences only.")

    ranked: list[RankedOpportunity] = []
    excluded: list[ExcludedOpportunity] = []
    for o, sim in zip(opps, sims):
        checks = check_eligibility(profile, o)
        status_e = eligibility_status(checks)
        if status_e == "ineligible":
            excluded.append(ExcludedOpportunity(opportunity_id=o.id, title=o.title,
                                                failed_rules=[c for c in checks if c.status == "fail"]))
            if not include_ineligible:
                continue
        req, pref, unknown_names = normalised[o.id]

        def cover(names):
            matches = []
            for n in names:
                s = level_of(summaries, n)
                matches.append(SkillMatch(skill=n, level=s.level, credit=round(skill_credit(s.level, s.strength), 3)))
            return matches, (sum(m.credit for m in matches) / len(matches) if matches else None)

        req_m, req_cov = cover(req)
        pref_m, pref_cov = cover(pref)
        pref_fit, pref_notes = _preference_fit(profile, o)

        parts = {"text_similarity": (weights.text_similarity, sim), "preference_fit": (weights.preference_fit, pref_fit)}
        if req_cov is not None:
            parts["required_coverage"] = (weights.required_coverage, req_cov)
        if pref_cov is not None:
            parts["preferred_coverage"] = (weights.preferred_coverage, pref_cov)
        total_w = sum(w for w, _ in parts.values()) or 1.0
        score = 100 * sum(w * v for w, v in parts.values()) / total_w

        missing = [m.skill for m in req_m if m.level == "none"]
        weak = [m.skill for m in req_m if m.level == "declared" or m.credit < 0.5 and m.level != "none"]
        expl = []
        if req:
            have = [m.skill for m in req_m if m.level != "none"]
            expl.append(f"Covers {len(have)}/{len(req)} required skills" + (f": {', '.join(have)}." if have else "."))
        else:
            expl.append("No required skills could be identified for this opportunity.")
        if missing:
            expl.append("Missing required skills: " + ", ".join(missing) + ".")
        if weak:
            expl.append("Listed but not backed by evidence (or evidence shows weakness): " + ", ".join(weak) + ".")
        if pref_m:
            hv = [m.skill for m in pref_m if m.level != "none"]
            if hv:
                expl.append("Preferred skills you have: " + ", ".join(hv) + ".")
        expl += [n[0].upper() + n[1:] + "." for n in pref_notes]
        unknown = [c for c in checks if c.status == "unknown"]
        expl += ["Eligibility unknown: " + c.detail for c in unknown]
        if unknown_names:
            expl.append("Skill names not in the taxonomy (ignored): " + ", ".join(unknown_names) + ".")

        ranked.append(RankedOpportunity(
            opportunity_id=o.id, type=o.type, title=o.title, rank=0, score=round(max(0.0, min(100.0, score)), 1),
            eligibility_status="eligibility_unknown" if status_e == "eligibility_unknown" else "eligible",
            components={k: round(v, 3) for k, (_, v) in parts.items()},
            matched_skills=[m for m in req_m + pref_m if m.level != "none"], missing_skills=missing,
            weakly_supported_skills=weak, unknown_eligibility=unknown, explanation=expl, is_demo=o.is_demo))

    ranked.sort(key=lambda r: (-r.score, r.opportunity_id))
    if top_k is not None:
        ranked = ranked[:max(0, top_k)]
    for i, r in enumerate(ranked, 1):
        r.rank = i
    return MatchResult(ranked=ranked, excluded=excluded, warnings=warnings, backend_status=status,
                       weights_used=weights.model_dump())
