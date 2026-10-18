"""Rule-based resume parser: sections, contact info, bullets, taxonomy-based skills.

No trained model is used here. Behaviour is deterministic and fully inspectable.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from importlib import resources

from yogyata_ai.common.taxonomy import get_taxonomy

from .extractors import (
    extract_certifications_and_achievements, extract_education, extract_experience, extract_projects,
)
from .schemas import Contact, ExtractedSkill, ParsedResume

_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)")
_LINK = re.compile(r"(?:https?://|www\.)\S+|(?:linkedin\.com|github\.com)/\S+", re.I)
_BULLET = re.compile(r"^\s*[-•*–·▪●]\s+(.*)")
_YEAR = re.compile(r"\b(19|20)\d{2}\b")
_GRAD_YEAR = re.compile(r"\b(20[0-4]\d)\b")


@lru_cache(maxsize=1)
def load_rules() -> dict:
    """Resume-parsing rules (section aliases, action verbs). Skills live in common.taxonomy."""
    with resources.files("yogyata_ai.resume_intelligence").joinpath(
        "data/resume_rules.json"
    ).open("r", encoding="utf-8") as f:
        return json.load(f)


load_taxonomy = load_rules  # backward-compatible name (previously also held the skill list)


def _skill_patterns() -> list[tuple[str, str, re.Pattern]]:
    return get_taxonomy().patterns()


def _normalise_header(line: str) -> str:
    return re.sub(r"[^a-z&\s]", "", line.strip().lower()).strip()


def split_sections(text: str, aliases: dict[str, list[str]] | None = None) -> dict[str, str]:
    """Split on known section headings (exact match, short lines only)."""
    aliases = aliases or load_taxonomy()["section_aliases"]
    lookup = {a: sec for sec, als in aliases.items() for a in als}
    sections: dict[str, list[str]] = {"header": []}
    current = "header"
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and len(stripped) <= 40 and _BULLET.match(line) is None:
            key = lookup.get(_normalise_header(stripped))
            if key:
                current = key
                sections.setdefault(current, [])
                continue
        sections.setdefault(current, []).append(line)
    return {k: "\n".join(v).strip() for k, v in sections.items() if "\n".join(v).strip()}


def extract_contact(text: str) -> Contact:
    email = _EMAIL.search(text)
    phone = _PHONE.search(text)
    links = []
    for m in _LINK.finditer(text):
        link = m.group(0).rstrip(".,;)")
        if email and link in email.group(0):
            continue
        if link not in links:
            links.append(link)
    return Contact(
        email=email.group(0) if email else None,
        phone=re.sub(r"\s+", " ", phone.group(0)).strip() if phone else None,
        links=links,
    )


def extract_bullets(text: str) -> list[str]:
    return [m.group(1).strip() for line in text.splitlines() if (m := _BULLET.match(line)) and m.group(1).strip()]


def is_quantified(bullet: str) -> bool:
    return bool(re.search(r"\d", _YEAR.sub("", bullet)))


def starts_with_action_verb(bullet: str) -> bool:
    words = re.findall(r"[A-Za-z]+", bullet)
    return bool(words) and words[0].lower() in set(load_taxonomy()["action_verbs"])


def _strip_contact_noise(text: str) -> str:
    """Remove emails and URLs so e.g. 'github.com/x' is not read as the Git skill."""
    return _LINK.sub(" ", _EMAIL.sub(" ", text))


def extract_skills(sections: dict[str, str], full_text: str) -> list[ExtractedSkill]:
    full_text = _strip_contact_noise(full_text)
    sections = {k: _strip_contact_noise(v) for k, v in sections.items()}
    skills_text = sections.get("skills", "")
    applied_text = "\n".join(sections.get(k, "") for k in ("experience", "projects"))
    applied_lines = [ln.strip(" -•*–·▪●\t") for ln in applied_text.splitlines() if ln.strip()]
    quantified_lines = "\n".join(ln for ln in applied_lines if is_quantified(ln))
    found = []
    for name, category, pat in _skill_patterns():
        mentions = len(pat.findall(full_text))
        if not mentions:
            continue
        in_skills = bool(skills_text and pat.search(skills_text))
        applied = bool(applied_text and pat.search(applied_text))
        found.append(
            ExtractedSkill(
                name=name,
                category=category,
                mentions=mentions,
                in_skills_section=in_skills,
                in_experience_or_projects=applied,
                in_quantified_bullet=bool(quantified_lines and pat.search(quantified_lines)),
                support="evidenced" if applied else ("declared_only" if in_skills else "mentioned"),
            )
        )
    return sorted(found, key=lambda s: (-s.mentions, s.name))


def parse_resume(text: str) -> ParsedResume:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    sections = split_sections(text)
    bullets = extract_bullets(text)
    edu = sections.get("education", "")
    years = [int(y) for y in _GRAD_YEAR.findall(edu)]
    certs, achievements = extract_certifications_and_achievements(sections, text)
    return ParsedResume(
        contact=extract_contact(text),
        sections=sections,
        skills=extract_skills(sections, text),
        education_mentioned="education" in sections,
        graduation_year=max(years) if years else None,
        word_count=len(re.findall(r"\b\w+\b", text)),
        bullet_count=len(bullets),
        quantified_bullet_count=sum(is_quantified(b) for b in bullets),
        action_verb_bullet_count=sum(starts_with_action_verb(b) for b in bullets),
        education=extract_education(edu),
        experience=extract_experience(sections.get("experience", "")),
        projects=extract_projects(sections.get("projects", "")),
        certifications=certs,
        achievements=achievements,
    )
