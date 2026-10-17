"""Analysis of LinkedIn profile text pasted/exported by the student.

No LinkedIn API or scraping is used or assumed; only the text supplied. Approach: deterministic rules.
Headline is taken positionally (second line of the header block) unless an explicit "Headline:" line
exists, and this assumption is reported as an ambiguity rather than hidden.
"""
from __future__ import annotations

import re

from pydantic import BaseModel, Field

from yogyata_ai.common.taxonomy import get_taxonomy

from .extractors import (
    extract_certifications_and_achievements, extract_education, extract_experience,
)
from .parser import split_sections
from .schemas import EducationEntry, ExperienceEntry, InfoIssue, Suggestion

LINKEDIN_SECTIONS = {
    "about": ["about", "summary"],
    "experience": ["experience"],
    "education": ["education"],
    "skills": ["skills", "top skills"],
    "achievements": ["licenses & certifications", "licenses and certifications", "certifications",
                     "honors & awards", "honors and awards", "awards"],
    "projects": ["projects"],
    "recommendations": ["recommendations"],
}


class ChecklistItem(BaseModel):
    item: str
    present: bool
    weight: int


class LinkedInAnalysis(BaseModel):
    sections_found: list[str]
    headline: str | None
    about_word_count: int
    skills: list[str]
    listed_skills_not_in_taxonomy: list[str] = Field(default_factory=list)
    experience: list[ExperienceEntry]
    education: list[EducationEntry]
    certifications: list[str]
    completeness_score: float = Field(..., ge=0, le=100)
    checklist: list[ChecklistItem]
    suggestions: list[Suggestion]
    information_gaps: list[InfoIssue]
    method: str = "rule-based (no trained model, no LinkedIn access)"


def analyze_linkedin_text(text: str) -> LinkedInAnalysis:
    text = (text or "").replace("\r\n", "\n")
    tax = get_taxonomy()
    sections = split_sections(text, LINKEDIN_SECTIONS)
    header = [ln.strip() for ln in sections.get("header", "").splitlines() if ln.strip()]
    gaps: list[InfoIssue] = []

    headline = None
    explicit = next((re.sub(r"(?i)^headline\s*:\s*", "", ln) for ln in header if re.match(r"(?i)^headline\s*:", ln)), None)
    if explicit:
        headline = explicit.strip() or None
    elif len(header) >= 2 and len(header[1]) <= 150 and "@" not in header[1]:
        headline = header[1]
        gaps.append(InfoIssue(kind="ambiguous", field="headline",
                              message="Headline assumed to be the second line of the pasted text; add 'Headline:' to be explicit."))

    about = sections.get("about", "")
    about_words = len(re.findall(r"\b\w+\b", about))

    raw_skill_lines = [re.sub(r"^\s*[-•*]\s*", "", ln).strip()
                       for ln in re.split(r"[\n,]", sections.get("skills", "")) if ln.strip()]
    listed, unknown = tax.normalize_many(raw_skill_lines)
    detected = sorted(set(listed) | set(tax.find_in_text(text)))

    certs, _ = extract_certifications_and_achievements(sections, "")
    certs = certs or [ln.strip(" -•*") for ln in sections.get("achievements", "").splitlines() if ln.strip()]
    experience = extract_experience(sections.get("experience", ""))
    education = extract_education(sections.get("education", ""))

    checklist = [
        ChecklistItem(item="headline", present=bool(headline), weight=15),
        ChecklistItem(item="about (>= 40 words)", present=about_words >= 40, weight=20),
        ChecklistItem(item="experience entries", present=bool(experience), weight=20),
        ChecklistItem(item="education entries", present=bool(education), weight=15),
        ChecklistItem(item="at least 5 skills", present=len(detected) >= 5, weight=20),
        ChecklistItem(item="certifications or projects", present=bool(certs) or "projects" in sections, weight=10),
    ]
    score = float(sum(c.weight for c in checklist if c.present))

    tips = {
        "headline": "Add a headline stating your target role and key skills.",
        "about (>= 40 words)": "Write an About section (40+ words) covering your focus and strengths.",
        "experience entries": "Add internships, projects or volunteering under Experience.",
        "education entries": "Add your degree, institution and graduation year.",
        "at least 5 skills": "List at least 5 relevant skills.",
        "certifications or projects": "Add certifications or featured projects.",
    }
    suggestions = [Suggestion(severity="medium", message=tips[c.item]) for c in checklist if not c.present]
    for e in experience:
        if e.title and e.date_range is None:
            gaps.append(InfoIssue(kind="ambiguous", field="experience.dates", message=f"'{e.title}' has no dates."))
    if not text.strip():
        gaps.append(InfoIssue(kind="missing", field="profile_text", message="Empty profile text."))

    return LinkedInAnalysis(
        sections_found=sorted(k for k in sections if k != "header"), headline=headline,
        about_word_count=about_words, skills=detected, listed_skills_not_in_taxonomy=unknown,
        experience=experience, education=education, certifications=certs,
        completeness_score=score, checklist=checklist, suggestions=suggestions, information_gaps=gaps)


class ConsistencyReport(BaseModel):
    shared_skills: list[str]
    only_in_resume: list[str]
    only_in_linkedin: list[str]
    graduation_year_resume: int | None
    graduation_year_linkedin: int | None
    notes: list[str]


def compare_linkedin_to_resume(linkedin_text: str, resume_text: str) -> ConsistencyReport:
    """Neutral comparison; differences are prompts to review, never accusations."""
    from .parser import parse_resume

    li = analyze_linkedin_text(linkedin_text)
    rs = parse_resume(resume_text or "")
    li_sk, rs_sk = set(li.skills), {s.name for s in rs.skills}
    li_year = max((e.year for e in li.education if e.year), default=None)
    rs_year = max((e.year for e in rs.education if e.year), default=None)
    notes: list[str] = []
    if li_year and rs_year and li_year != rs_year:
        notes.append(f"Graduation year differs (resume {rs_year}, LinkedIn {li_year}); please confirm which is correct.")
    if rs_sk - li_sk:
        notes.append("Skills on the resume but not on LinkedIn may be worth adding there.")
    return ConsistencyReport(shared_skills=sorted(li_sk & rs_sk), only_in_resume=sorted(rs_sk - li_sk),
                             only_in_linkedin=sorted(li_sk - rs_sk), graduation_year_resume=rs_year,
                             graduation_year_linkedin=li_year, notes=notes)
