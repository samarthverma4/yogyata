"""Supabase rows -> yogyata_ai StudentProfile.

The app stores one row per (seeker, skill) carrying a three-valued `level`; the package wants
a list of evidence records carrying a continuous `strength`. That conversion is lossy in one
direction only — the app never recorded a strength — so the numbers below are the single place
where that gap is bridged, and the only place to change if strengths start being stored.
"""
from __future__ import annotations

from typing import Any

from .vocab import canonical_skill, canonical_skills

# passport_skills.level -> (evidence source, strength)
#
# The package treats >= 0.60 as "met" and caps automated evidence at 0.5, so `declared`
# deliberately lands below the bar and both human-reviewed levels clear it. `assessed` is a
# mentor's review of submitted evidence and `verified` is a founder accepting real shipped
# work, which is why verified scores higher.
LEVEL_MAP: dict[str, tuple[str, float]] = {
    "declared": ("declared", 0.5),
    "assessed": ("portfolio_review", 0.7),
    "verified": ("task_review", 0.9),
}

# professional.experience (onboarding ProfileStep) -> years, using the low end of each band
EXPERIENCE_YEARS: dict[str, float] = {
    "fresher": 0.0,
    "less-than-1": 0.5,
    "1-2": 1.0,
    "3-5": 3.0,
    "6-10": 6.0,
    "more-than-10": 10.0,
}

WORK_MODES = {"remote": "remote", "hybrid": "hybrid", "on-site": "onsite", "onsite": "onsite"}

OPPORTUNITY_TYPES = {
    "full-time": "job",
    "part-time": "job",
    "contract": "job",
    "internship": "internship",
}

# Roadmap planning inputs the app never collects. The package defaults to 6h/week x 8 weeks
# and flags the guess; we pass these explicitly so the flag means "the student did not say"
# rather than "nobody asked".
DEFAULT_WEEKLY_HOURS = 6.0
DEFAULT_TIMELINE_WEEKS = 8


def _rating_strength(rating: Any) -> float | None:
    """An accepted submission's 1-5 rating -> 0.75..0.95, so a strong endorsement outranks a bare one."""
    try:
        r = float(rating)
    except (TypeError, ValueError):
        return None
    if not 1.0 <= r <= 5.0:
        return None
    return round(0.75 + (r / 5.0) * 0.2, 3)


def evidence_from_passport(
    rows: list[dict[str, Any]],
    submissions: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    """passport_skills rows -> EvidenceRecord dicts, plus the skill names we could not map."""
    submissions = submissions or {}
    records: list[dict[str, Any]] = []
    unmapped: list[str] = []

    for row in rows:
        raw_name = (row.get("skill_name") or "").strip()
        name = canonical_skill(raw_name)
        if name is None:
            if raw_name and raw_name not in unmapped:
                unmapped.append(raw_name)
            continue

        level = (row.get("level") or "declared").lower()
        source, strength = LEVEL_MAP.get(level, LEVEL_MAP["declared"])

        # a future `strength` column wins over the level-derived default
        if row.get("strength") is not None:
            try:
                strength = max(0.0, min(1.0, float(row["strength"])))
            except (TypeError, ValueError):
                pass
        elif level == "verified":
            sub = submissions.get(row.get("source_submission_id") or "")
            if sub and (scored := _rating_strength(sub.get("rating"))) is not None:
                strength = scored

        records.append(
            {
                "skill": name,
                "source": source,
                "strength": strength,
                "ref_id": row.get("source_submission_id") or row.get("id"),
                "note": (row.get("evidence") or "")[:200],
                "assessed_at": row.get("updated_at") or row.get("created_at"),
            }
        )
    return records, unmapped


def _education(answers: dict[str, Any]) -> dict[str, Any]:
    edu = answers.get("education") or {}
    year = edu.get("graduationYear")
    try:
        year = int(year) if year not in (None, "") else None
    except (TypeError, ValueError):
        year = None
    if year is not None and not 1990 <= year <= 2060:
        year = None
    # cgpa is not collected anywhere in onboarding; left unset so eligibility reports
    # "unknown" instead of inventing a number
    return {"degree": edu.get("degree") or None, "graduation_year": year, "cgpa": None}


def build_student_profile(
    *,
    profile_row: dict[str, Any],
    seeker_details: dict[str, Any] | None,
    passport_rows: list[dict[str, Any]],
    submissions: dict[str, dict[str, Any]] | None = None,
    target_role: str | None = None,
    weekly_hours: float | None = None,
    timeline_weeks: int | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Assemble the package's StudentProfile. Returns (profile, notes).

    `notes` carries what could not be translated, so the API can tell the student which of
    their skills the model cannot see rather than silently scoring without them.
    """
    details = seeker_details or {}
    answers: dict[str, Any] = details.get("answers") or {}
    professional = answers.get("professional") or {}
    goals = answers.get("careerGoals") or {}
    prefs = answers.get("jobPrefs") or {}

    declared_raw = list((answers.get("resumeSkills") or {}).get("skills") or [])
    declared, unmapped_declared = canonical_skills(declared_raw)

    evidence, unmapped_passport = evidence_from_passport(passport_rows, submissions)
    # a skill with evidence is declared too, so the role catalog sees it either way
    for rec in evidence:
        if rec["skill"] not in declared:
            declared.append(rec["skill"])

    location = " ".join(p for p in [professional.get("city"), professional.get("country")] if p) or None

    modes = [WORK_MODES[m] for m in (prefs.get("workModes") or []) if m in WORK_MODES]
    types = [OPPORTUNITY_TYPES[t] for t in (prefs.get("opportunityTypes") or []) if t in OPPORTUNITY_TYPES]

    profile = {
        # opaque id only; never a name or email (cohort analytics rejects identifying fields)
        "student_id": profile_row.get("id"),
        "target_role": target_role or goals.get("primaryRole") or goals.get("customPrimaryRole") or None,
        "goals": (goals.get("primaryRole") or "") and f"Targeting {goals.get('primaryRole')}",
        "declared_skills": declared,
        "education": _education(answers),
        "experience_years": EXPERIENCE_YEARS.get(professional.get("experience") or ""),
        "location": location,
        "preferred_work_modes": sorted(set(modes)),
        "preferred_opportunity_types": sorted(set(types)),
        "weekly_hours": weekly_hours or DEFAULT_WEEKLY_HOURS,
        "timeline_weeks": timeline_weeks or DEFAULT_TIMELINE_WEEKS,
        "evidence": evidence,
        "profile_text": details.get("headline") or "",
    }

    notes = {
        "unmapped_skills": sorted(set(unmapped_declared + unmapped_passport)),
        "weekly_hours_supplied": weekly_hours is not None,
        "timeline_weeks_supplied": timeline_weeks is not None,
        "cgpa_known": False,
    }
    return profile, notes


def opportunities_from_postings(
    rows: list[dict[str, Any]], organisations: dict[str, str] | None = None
) -> list[dict[str, Any]]:
    """job_postings rows -> Opportunity dicts."""
    organisations = organisations or {}
    out = []
    for row in rows:
        skills, _ = canonical_skills(list(row.get("required_skills") or []))
        title = row.get("title") or ""
        out.append(
            {
                "id": row["id"],
                "type": "internship" if "intern" in title.lower() else "job",
                "title": title,
                "organisation": organisations.get(row.get("recruiter_id") or "", ""),
                "description": row.get("description") or "",
                "required_skills": skills,
                "location": row.get("location") or None,
                "work_mode": WORK_MODES.get((row.get("work_arrangement") or "").lower()),
            }
        )
    return out


# mentor_profiles stores skill names with no depth, so depth comes from where the skill was
# listed: a declared area of expertise outranks one in the longer technical-skills list.
EXPERTISE_DEPTH = 4
TECHNICAL_DEPTH = 3


def _float_or_none(value: Any) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def mentors_from_profiles(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    """mentor_profiles rows -> Mentor dicts, plus the ids skipped for having no mappable skill.

    `Mentor.expertise` must be a non-empty {canonical skill: depth} map, so a mentor whose
    listed skills are all outside the taxonomy cannot be represented and is reported instead.
    """
    out: list[dict[str, Any]] = []
    skipped: list[str] = []
    for row in rows:
        expertise: dict[str, int] = {}
        for raw in list(row.get("technical_skills") or []):
            if name := canonical_skill(raw):
                expertise[name] = TECHNICAL_DEPTH
        # areas are set second so they overwrite the shallower technical depth
        for raw in list(row.get("expertise_areas") or []):
            if name := canonical_skill(raw):
                expertise[name] = EXPERTISE_DEPTH

        if not expertise:
            skipped.append(row["id"])
            continue

        out.append(
            {
                "id": row["id"],
                "headline": row.get("headline") or row.get("role_title") or "",
                "bio": row.get("bio") or "",
                "expertise": expertise,
                "languages": list(row.get("languages") or []) or None,
                "years_experience": _float_or_none(row.get("years_experience")),
                "accepting_students": bool(row.get("accepting", True)),
                # unknown price and availability stay None: the package flags them rather
                # than treating unknown as free or unavailable
                "price_per_session_inr": _float_or_none(row.get("hourly_rate")),
            }
        )
    return out, skipped
