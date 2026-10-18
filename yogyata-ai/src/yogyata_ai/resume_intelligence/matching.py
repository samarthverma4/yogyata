"""Resume <-> job description matching: taxonomy skill coverage blended with text similarity."""
from __future__ import annotations

from yogyata_ai.common.similarity import SimilarityBackend, get_backend

from .parser import parse_resume
from .schemas import JobMatchResult

SKILL_WEIGHT = 0.7
TEXT_WEIGHT = 0.3


def match_job(resume_text: str, job_description: str,
              backend: SimilarityBackend | None = None) -> JobMatchResult:
    backend = backend or get_backend()
    resume = parse_resume(resume_text or "")
    jd = parse_resume(job_description or "")  # reuse the skill extractor on the JD text
    resume_skills = {s.name for s in resume.skills}
    required = sorted({s.name for s in jd.skills})
    matched = sorted(set(required) & resume_skills)
    missing = sorted(set(required) - resume_skills)
    sim = backend.similarity(resume_text or "", job_description or "")
    notes: list[str] = []
    if required:
        coverage = len(matched) / len(required)
        score = 100 * (SKILL_WEIGHT * coverage + TEXT_WEIGHT * sim)
    else:
        score = 100 * sim
        notes.append("No taxonomy skills found in the job description; score uses text similarity only.")
    if not (resume_text or "").strip() or not (job_description or "").strip():
        notes.append("Empty input.")
    return JobMatchResult(
        match_score=round(max(0.0, min(100.0, score)), 1),
        required_skills_found=required,
        matched_skills=matched,
        missing_skills=missing,
        text_similarity=round(sim, 4),
        notes=notes,
    )
