"""Convert a ResumeAnalysis into the shared StudentProfile (privacy-minimal, no invention).

Evidence strengths are fixed, documented conventions, not measurements:
  declared (listed only)                 -> 0.20
  resume_evidence (used in a project)    -> 0.50, or 0.65 if in a bullet with a measurable result
Resume-derived evidence is self-reported and therefore never verified.
Name, email, phone and links are deliberately NOT copied into the profile.
"""
from __future__ import annotations

from yogyata_ai.common.schemas import EducationInfo, EvidenceRecord, StudentProfile

from .schemas import ResumeAnalysis

DECLARED_STRENGTH = 0.20
EVIDENCED_STRENGTH = 0.50
EVIDENCED_QUANTIFIED_STRENGTH = 0.65


def profile_from_analysis(analysis: ResumeAnalysis, *, target_role: str | None = None,
                          **fields) -> StudentProfile:
    p = analysis.parsed
    evidence: list[EvidenceRecord] = []
    for s in p.skills:
        evidence.append(EvidenceRecord(skill=s.name, source="declared", strength=DECLARED_STRENGTH,
                                       note="listed on resume"))
        if s.in_experience_or_projects:
            evidence.append(EvidenceRecord(
                skill=s.name, source="resume_evidence",
                strength=EVIDENCED_QUANTIFIED_STRENGTH if s.in_quantified_bullet else EVIDENCED_STRENGTH,
                note="used in a described project/experience (self-reported)"))
    latest = max((e for e in p.education if e.year), key=lambda e: e.year, default=None)
    edu = EducationInfo(degree=latest.degree if latest else None,
                        graduation_year=latest.year if latest else p.graduation_year,
                        cgpa=latest.cgpa if latest else None)
    base = dict(target_role=target_role, declared_skills=[s.name for s in p.skills],
                education=edu, evidence=evidence)
    base.update(fields)
    return StudentProfile(**base)
