"""Rule-based extraction of education, experience, projects, certifications and achievements.

Approach: deterministic rules over already-split sections. Nothing is inferred: a field that is not
present in the text stays None (see `find_information_gaps`). Known limits: relies on common
formatting ("Degree, Institution, Year"; "Title, Organisation (Mon YYYY - Mon YYYY)").
"""
from __future__ import annotations

import re

from yogyata_ai.common.taxonomy import get_taxonomy

from .schemas import EducationEntry, ExperienceEntry, InfoIssue, ParsedResume, ProjectEntry

_BULLET = re.compile(r"^\s*[-•*–·▪●]\s+(.*)")
_YEAR = re.compile(r"(?<!\d)(19[89]\d|20[0-5]\d)(?!\d)")
_DEGREE = re.compile(
    r"(?<![A-Za-z])(?:b\.?\s?tech|b\.\s?e|b\.?\s?sc|bca|b\.?\s?com|m\.?\s?tech|m\.?\s?sc|mca|mba|"
    r"ph\.?\s?d|diploma|bachelor|master)(?![A-Za-z])", re.I)
_CGPA = re.compile(r"(?:cgpa|gpa)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)(?:\s*/\s*(\d{1,2}))?", re.I)
_MONTH = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
_DATE_RANGE = re.compile(
    rf"\(?\s*((?:{_MONTH}\s+)?(?:19|20)\d{{2}})\s*(?:-|–|—|to)\s*((?:{_MONTH}\s+)?(?:19|20)\d{{2}}|present|current)\s*\)?",
    re.I)
_CERT_LINE = re.compile(r"certif|licen[sc]e|nanodegree|specialization|specialisation|course completion", re.I)


def _lines(text: str) -> list[str]:
    return [ln.rstrip() for ln in (text or "").splitlines() if ln.strip()]


def _strip_bullet(line: str) -> tuple[str, bool]:
    m = _BULLET.match(line)
    return (m.group(1).strip(), True) if m else (line.strip(), False)


def extract_education(section: str) -> list[EducationEntry]:
    entries: list[EducationEntry] = []
    for line in _lines(section):
        text, _ = _strip_bullet(line)
        cg = _CGPA.search(text)
        cgpa = None
        if cg:
            val, scale = float(cg.group(1)), cg.group(2)
            if val <= 10 and (scale in (None, "10")):
                cgpa = val
        if _DEGREE.search(text):
            years = [int(y) for y in _YEAR.findall(text)]
            parts = [p.strip() for p in text.split(",")]
            inst = None
            if len(parts) > 1:
                cand = _YEAR.sub("", _CGPA.sub("", parts[1])).strip(" -()")
                inst = cand or None
            entries.append(EducationEntry(
                degree=_YEAR.sub("", _CGPA.sub("", parts[0])).strip(" -()") or None,
                institution=inst, year=max(years) if years else None, cgpa=cgpa, raw=text))
        elif cgpa is not None and entries and entries[-1].cgpa is None:
            entries[-1].cgpa = cgpa
    return entries


def _skills_in(text: str) -> list[str]:
    return sorted(get_taxonomy().find_in_text(text))


def extract_experience(section: str) -> list[ExperienceEntry]:
    entries: list[ExperienceEntry] = []
    current: ExperienceEntry | None = None
    for line in _lines(section):
        text, is_bullet = _strip_bullet(line)
        if is_bullet:
            if current is None:
                current = ExperienceEntry()
                entries.append(current)
            current.bullets.append(text)
            continue
        m = _DATE_RANGE.search(text)
        head = _DATE_RANGE.sub("", text).strip(" ,-()")
        parts = [p.strip() for p in head.split(",") if p.strip()]
        current = ExperienceEntry(
            title=parts[0] if parts else None,
            organization=parts[1] if len(parts) > 1 else None,
            date_range=f"{m.group(1)} - {m.group(2)}" if m else None)
        entries.append(current)
    for e in entries:
        e.skills = _skills_in(" ".join([e.title or "", e.organization or ""] + e.bullets))
    return entries


def extract_projects(section: str) -> list[ProjectEntry]:
    lines = _lines(section)
    has_bullets = any(_BULLET.match(ln) for ln in lines)
    entries: list[ProjectEntry] = []
    current: ProjectEntry | None = None
    for line in lines:
        text, is_bullet = _strip_bullet(line)
        if not has_bullets:
            entries.append(ProjectEntry(descriptions=[text]))
        elif is_bullet:
            if current is None:  # bullet with no heading: each bullet is its own project
                entries.append(ProjectEntry(descriptions=[text]))
            else:
                current.descriptions.append(text)
        else:
            current = ProjectEntry(name=text.rstrip(":"))
            entries.append(current)
    for e in entries:
        e.skills = _skills_in(" ".join([e.name or ""] + e.descriptions))
    return entries


def extract_certifications_and_achievements(sections: dict[str, str], full_text: str) -> tuple[list[str], list[str]]:
    certs: list[str] = []
    achievements: list[str] = []
    for line in _lines(sections.get("achievements", "")):
        text, _ = _strip_bullet(line)
        (certs if _CERT_LINE.search(text) else achievements).append(text)
    for line in _lines(full_text):
        text, _ = _strip_bullet(line)
        if re.search(r"\bcertified\b|\bcertification\b|\bcertificate\b", text, re.I) and text not in certs \
                and text not in achievements:
            certs.append(text)
    return certs, achievements


def find_information_gaps(p: ParsedResume) -> list[InfoIssue]:
    """Report missing/ambiguous information. Never invents or infers qualifications."""
    gaps: list[InfoIssue] = []
    if not p.education:
        gaps.append(InfoIssue(kind="missing", field="education",
                              message="No recognisable degree entry found (expected e.g. 'B.Tech CSE, Institute, 2026')."))
    for e in p.education:
        if e.year is None:
            gaps.append(InfoIssue(kind="missing", field="education.year",
                                  message=f"No graduation year for '{e.degree}'."))
        if e.institution is None:
            gaps.append(InfoIssue(kind="missing", field="education.institution",
                                  message=f"No institution for '{e.degree}'."))
        if e.cgpa is None:
            gaps.append(InfoIssue(kind="missing", field="education.cgpa",
                                  message=f"No CGPA stated for '{e.degree}' (optional, but some opportunities filter on it)."))
    for e in p.experience:
        label = e.title or "experience entry"
        if e.date_range is None and e.title is not None:
            gaps.append(InfoIssue(kind="ambiguous", field="experience.dates",
                                  message=f"'{label}' has no start/end dates, so duration is unknown."))
        if e.title is None:
            gaps.append(InfoIssue(kind="ambiguous", field="experience.title",
                                  message="Experience bullets without a role/organisation heading; the nature of the role is unclear."))
    if not p.experience and not p.projects:
        gaps.append(InfoIssue(kind="missing", field="experience_or_projects",
                              message="No experience or projects found, so no applied evidence for any skill."))
    declared_only = [s.name for s in p.skills if s.support == "declared_only"]
    if declared_only:
        gaps.append(InfoIssue(kind="ambiguous", field="skills.evidence",
                              message="Skills listed without any project/experience context: " + ", ".join(declared_only[:8]) + "."))
    for pr in p.projects:
        if not pr.skills:
            gaps.append(InfoIssue(kind="ambiguous", field="projects.skills",
                                  message="A project does not mention any recognisable technology: "
                                          + (pr.name or pr.descriptions[0][:60]) + "."))
            break
    if not p.contact.email:
        gaps.append(InfoIssue(kind="missing", field="contact.email", message="No email address found."))
    return gaps
