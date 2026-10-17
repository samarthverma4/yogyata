"""Transparent, rule-based resume quality scoring.

The weights and thresholds below are hand-set heuristics. They have NOT been validated
against recruiter judgements or hiring outcomes; treat the score as a structured checklist,
not a predictor of selection.
"""
from __future__ import annotations

from .extractors import find_information_gaps
from .parser import parse_resume
from .schemas import ParsedResume, ResumeAnalysis, ScoreComponent, Suggestion

WEIGHTS = {"completeness": 0.25, "skills": 0.30, "impact": 0.30, "structure": 0.15}
MIN_WORDS_FOR_ANALYSIS = 15


def _clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


def _completeness(p: ParsedResume) -> tuple[float, str]:
    pts = 0.0
    pts += 20 if p.contact.email else 0
    pts += 10 if p.contact.phone else 0
    pts += 10 if p.contact.links else 0
    pts += 20 if "education" in p.sections else 0
    pts += 20 if ("experience" in p.sections or "projects" in p.sections) else 0
    pts += 20 if "skills" in p.sections else 0
    return _clamp(pts), "email, phone, links, and education/experience-or-projects/skills sections"


def _looks_stuffed(p: ParsedResume) -> bool:
    """Many skills but (almost) none shown in use. A heuristic flag, not proof of dishonesty."""
    n = len(p.skills)
    if n < 6:
        return False
    applied = sum(s.in_experience_or_projects for s in p.skills)
    return applied / n < 0.25


def _skills(p: ParsedResume) -> tuple[float, str]:
    n = len(p.skills)
    if n == 0:
        return 0.0, "no taxonomy skills detected"
    breadth = min(n, 8) / 8 * 60
    applied = sum(s.in_experience_or_projects for s in p.skills)
    evidence = applied / n * 40
    score = breadth + evidence
    detail = f"{n} skills detected, {applied} with applied evidence"
    if _looks_stuffed(p):
        score = min(score, 40.0)
        detail += "; capped at 40 because most listed skills have no supporting project/experience"
    return _clamp(score), detail


def _impact(p: ParsedResume) -> tuple[float, str]:
    if p.bullet_count == 0:
        return 0.0, "no bullet points found"
    q = p.quantified_bullet_count / p.bullet_count
    a = p.action_verb_bullet_count / p.bullet_count
    return _clamp(q * 50 + a * 50), (
        f"{p.quantified_bullet_count}/{p.bullet_count} bullets quantified, "
        f"{p.action_verb_bullet_count}/{p.bullet_count} start with an action verb"
    )


def _structure(p: ParsedResume) -> tuple[float, str]:
    w = p.word_count
    if w < 150:
        length = w / 150 * 60
    elif w <= 700:
        length = 60
    else:
        length = max(0.0, 60 - (w - 700) / 10)
    bullets = min(p.bullet_count, 8) / 8 * 40
    return _clamp(length + bullets), f"{w} words, {p.bullet_count} bullets (target ~150-700 words, 8+ bullets)"


def _suggestions(p: ParsedResume) -> list[Suggestion]:
    s: list[Suggestion] = []
    if not p.contact.email:
        s.append(Suggestion(severity="high", message="Add a professional email address."))
    if not p.contact.phone:
        s.append(Suggestion(severity="medium", message="Add a phone number."))
    if not p.contact.links:
        s.append(Suggestion(severity="low", message="Add GitHub/LinkedIn/portfolio links."))
    for sec in ("education", "skills"):
        if sec not in p.sections:
            s.append(Suggestion(severity="high", message=f"Add a clearly labelled '{sec.title()}' section."))
    if "experience" not in p.sections and "projects" not in p.sections:
        s.append(Suggestion(severity="high", message="Add Projects or Experience with concrete bullets."))
    if p.bullet_count and p.quantified_bullet_count / p.bullet_count < 0.3:
        s.append(Suggestion(severity="medium", message="Quantify more bullets (numbers, %, users, time saved)."))
    if p.bullet_count and p.action_verb_bullet_count / p.bullet_count < 0.5:
        s.append(Suggestion(severity="medium", message="Start bullets with strong action verbs (Built, Reduced, Led...)."))
    unproven = [x.name for x in p.skills if x.in_skills_section and not x.in_experience_or_projects]
    if len(unproven) >= 3:
        s.append(Suggestion(severity="medium", message=f"Show applied use of listed skills in projects: {', '.join(unproven[:5])}."))
    if p.word_count > 700:
        s.append(Suggestion(severity="low", message="Resume is long; aim for one page for early-career roles."))
    return s


def analyze_parsed(p: ParsedResume) -> ResumeAnalysis:
    parts = {
        "completeness": _completeness(p),
        "skills": _skills(p),
        "impact": _impact(p),
        "structure": _structure(p),
    }
    comps = [
        ScoreComponent(name=k, score=round(v[0], 1), weight=WEIGHTS[k], detail=v[1])
        for k, v in parts.items()
    ]
    overall = round(sum(c.score * c.weight for c in comps), 1)
    warnings = []
    if not p.sections or set(p.sections) == {"header"}:
        warnings.append("No standard section headings detected; parsing confidence is low.")
    if _looks_stuffed(p):
        warnings.append("Long skills list with little supporting evidence; skill score capped (possible keyword stuffing).")
    return ResumeAnalysis(parsed=p, overall_score=overall, components=comps,
                          suggestions=_suggestions(p), warnings=warnings,
                          information_gaps=find_information_gaps(p))


def analyze_resume(resume_text: str) -> ResumeAnalysis:
    p = parse_resume(resume_text or "")
    if p.word_count < MIN_WORDS_FOR_ANALYSIS:
        return ResumeAnalysis(
            parsed=p,
            overall_score=0.0,
            components=[ScoreComponent(name=k, score=0.0, weight=w, detail="insufficient text")
                        for k, w in WEIGHTS.items()],
            suggestions=[Suggestion(severity="high", message="Resume text is empty or too short to analyse.")],
            warnings=["Input too short for reliable analysis."],
        )
    return analyze_parsed(p)
