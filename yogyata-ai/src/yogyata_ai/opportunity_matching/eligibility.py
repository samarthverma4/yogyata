"""Mandatory eligibility checks, kept in ordinary Python and strictly separate from similarity ranking.

Each rule yields pass / fail / unknown. A rule is "unknown" when the student's data needed to decide is
missing; unknown is never silently treated as pass or fail: the opportunity stays visible and is
flagged so the student (or an agent) can supply the missing information.
"""
from __future__ import annotations

from yogyata_ai.common.schemas import StudentProfile

from .schemas import EligibilityCheck, Opportunity


def check_eligibility(profile: StudentProfile, opp: Opportunity) -> list[EligibilityCheck]:
    r = opp.eligibility
    checks: list[EligibilityCheck] = []

    if r.allowed_graduation_years is not None:
        y = profile.education.graduation_year
        years = ", ".join(map(str, sorted(r.allowed_graduation_years)))
        if y is None:
            checks.append(EligibilityCheck(rule="graduation_year", status="unknown",
                                           detail=f"Requires graduation year in [{years}]; your graduation year is not provided."))
        else:
            ok = y in r.allowed_graduation_years
            checks.append(EligibilityCheck(rule="graduation_year", status="pass" if ok else "fail",
                                           detail=f"Requires graduation year in [{years}]; yours is {y}."))

    if r.min_cgpa is not None:
        c = profile.education.cgpa
        if c is None:
            checks.append(EligibilityCheck(rule="min_cgpa", status="unknown",
                                           detail=f"Requires CGPA >= {r.min_cgpa}; your CGPA is not provided."))
        else:
            checks.append(EligibilityCheck(rule="min_cgpa", status="pass" if c >= r.min_cgpa else "fail",
                                           detail=f"Requires CGPA >= {r.min_cgpa}; yours is {c}."))

    if r.min_experience_years is not None:
        e = profile.experience_years
        if e is None:
            checks.append(EligibilityCheck(rule="min_experience_years", status="unknown",
                                           detail=f"Requires {r.min_experience_years}+ years of experience; yours is not provided."))
        else:
            checks.append(EligibilityCheck(rule="min_experience_years", status="pass" if e >= r.min_experience_years else "fail",
                                           detail=f"Requires {r.min_experience_years}+ years; yours is {e}."))

    if r.allowed_degree_keywords:
        d = profile.education.degree
        kws = ", ".join(r.allowed_degree_keywords)
        if d is None:
            checks.append(EligibilityCheck(rule="degree", status="unknown",
                                           detail=f"Requires a degree matching [{kws}]; your degree is not provided."))
        else:
            ok = any(k.lower() in d.lower() for k in r.allowed_degree_keywords)
            checks.append(EligibilityCheck(rule="degree", status="pass" if ok else "fail",
                                           detail=f"Requires a degree matching [{kws}]; yours is '{d}'."))

    if r.location_required and opp.location:
        loc = profile.location
        if loc is None:
            checks.append(EligibilityCheck(rule="location", status="unknown",
                                           detail=f"Requires being located in {opp.location}; your location is not provided."))
        else:
            ok = loc.strip().lower() == opp.location.strip().lower()
            checks.append(EligibilityCheck(rule="location", status="pass" if ok else "fail",
                                           detail=f"Requires being located in {opp.location}; yours is {loc}."))
    return checks


def eligibility_status(checks: list[EligibilityCheck]) -> str:
    if any(c.status == "fail" for c in checks):
        return "ineligible"
    if any(c.status == "unknown" for c in checks):
        return "eligibility_unknown"
    return "eligible"
