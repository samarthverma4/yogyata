"""Evidence-aware comparison of one resume with one supplied job description.

Approach: hybrid (deterministic skill rules + TF-IDF/embedding similarity). Unlike `match_job`
(kept unchanged for compatibility), this separates required from preferred skills and gives only
partial credit to skills that are merely listed without project/experience support.

The score is an alignment indicator for the student's own guidance. It is NOT a hiring probability.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from pydantic import BaseModel, Field

from yogyata_ai.common.requirements import extract_requirements
from yogyata_ai.common.similarity import SimilarityBackend, get_backend

from .parser import parse_resume


@dataclass(frozen=True)
class ComparisonWeights:
    required: float = 0.60
    preferred: float = 0.15
    text: float = 0.25
    # credit for a matched skill by how well the resume supports it
    support_credit: dict = field(default_factory=lambda: {"evidenced": 1.0, "declared_only": 0.5, "mentioned": 0.5})


class MatchedSkill(BaseModel):
    skill: str
    support: str


class JobComparison(BaseModel):
    required_skills: list[str]
    preferred_skills: list[str]
    matched_required: list[MatchedSkill]
    matched_preferred: list[MatchedSkill]
    missing_required: list[str]
    missing_preferred: list[str]
    required_coverage: float = Field(..., ge=0, le=1, description="Plain coverage, ignores evidence")
    evidence_weighted_required_coverage: float = Field(..., ge=0, le=1)
    text_similarity: float = Field(..., ge=0, le=1)
    alignment_score: float = Field(..., ge=0, le=100)
    notes: list[str] = Field(default_factory=list)
    score_meaning: str = "Alignment indicator for self-guidance; not a prediction of selection."


def compare_resume_to_job(resume_text: str, job_description: str,
                          backend: SimilarityBackend | None = None,
                          weights: ComparisonWeights | None = None) -> JobComparison:
    w = weights or ComparisonWeights()
    backend = backend or get_backend()
    parsed = parse_resume(resume_text or "")
    by_name = {s.name: s for s in parsed.skills}
    required, preferred = extract_requirements(job_description)

    def match(names: list[str]):
        got = [MatchedSkill(skill=n, support=by_name[n].support) for n in names if n in by_name]
        credit = sum(w.support_credit.get(m.support, 0.5) for m in got)
        return got, (credit / len(names) if names else 0.0)

    mr, req_weighted = match(required)
    mp, pref_weighted = match(preferred)
    req_plain = len(mr) / len(required) if required else 0.0
    sim = backend.similarity(resume_text or "", job_description or "")

    notes: list[str] = []
    parts, total_w = [], 0.0
    if required:
        parts.append(w.required * req_weighted); total_w += w.required
    else:
        notes.append("No recognised required skills in the job description; required-skill coverage not scored.")
    if preferred:
        parts.append(w.preferred * pref_weighted); total_w += w.preferred
    parts.append(w.text * sim); total_w += w.text
    score = 100 * sum(parts) / total_w if total_w else 0.0

    unevidenced = [m.skill for m in mr if m.support != "evidenced"]
    if unevidenced:
        notes.append("Matched but not backed by a project/experience: " + ", ".join(unevidenced) + ".")
    if not (resume_text or "").strip() or not (job_description or "").strip():
        notes.append("Empty input.")
        score = 0.0
    return JobComparison(
        required_skills=required, preferred_skills=preferred,
        matched_required=mr, matched_preferred=mp,
        missing_required=[n for n in required if n not in by_name],
        missing_preferred=[n for n in preferred if n not in by_name],
        required_coverage=round(req_plain, 4),
        evidence_weighted_required_coverage=round(req_weighted, 4),
        text_similarity=round(sim, 4), alignment_score=round(max(0.0, min(100.0, score)), 1), notes=notes)
