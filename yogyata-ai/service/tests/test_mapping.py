"""Tests for the Supabase -> yogyata_ai translation layer. No network, no FastAPI."""
from __future__ import annotations

import pytest

from yogyata_ai.common.schemas import StudentProfile
from yogyata_ai.mentor_recommendation.schemas import Mentor
from yogyata_ai.opportunity_matching.schemas import Opportunity

from service.mapping import (
    build_student_profile,
    evidence_from_passport,
    mentors_from_profiles,
    opportunities_from_postings,
)
from service.vocab import canonical_skills, resolve_role, supported_roles


# ── vocabulary (#3) ─────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "label,expected",
    [
        ("Data Analyst / Data Scientist", "data_analyst"),
        ("AI / Machine Learning Engineer", "ml_engineer"),
        ("Full-Stack Developer", "full_stack_developer"),
        ("Frontend Developer", "full_stack_developer"),
        ("data_analyst", "data_analyst"),
        ("  ML Engineer  ", "ml_engineer"),
    ],
)
def test_app_role_labels_resolve(label, expected):
    assert resolve_role(label) == expected


@pytest.mark.parametrize("label", ["Cybersecurity Analyst", "Digital Marketing Specialist", "Other", "", None])
def test_unsupported_roles_return_none_rather_than_guessing(label):
    assert resolve_role(label) is None


def test_supported_roles_matches_package_catalog():
    assert set(supported_roles()) == {"ml_engineer", "data_analyst", "full_stack_developer"}


def test_skill_canonicalisation_reports_unknowns():
    known, unknown = canonical_skills(["reactjs", "Python", "Underwater Basketweaving", "sklearn", "python"])
    assert "React" in known and "scikit-learn" in known
    assert known.count("Python") == 1, "duplicates collapse"
    assert unknown == ["Underwater Basketweaving"]


# ── evidence strength (#2) ──────────────────────────────────────────────────────────────
def test_levels_map_around_the_met_threshold():
    rows = [
        {"id": "1", "skill_name": "Python", "level": "declared"},
        {"id": "2", "skill_name": "SQL", "level": "assessed"},
        {"id": "3", "skill_name": "React", "level": "verified"},
    ]
    by_skill = {r["skill"]: r for r in evidence_from_passport(rows)[0]}
    # 0.60 is the package's "met" bar: declared must sit below it, reviewed levels above
    assert by_skill["Python"]["strength"] < 0.6
    assert by_skill["SQL"]["strength"] >= 0.6
    assert by_skill["React"]["strength"] > by_skill["SQL"]["strength"]
    assert by_skill["Python"]["source"] == "declared"
    assert by_skill["React"]["source"] == "task_review"


def test_verified_strength_scales_with_submission_rating():
    rows = [{"id": "1", "skill_name": "Python", "level": "verified", "source_submission_id": "s1"}]
    weak = evidence_from_passport(rows, {"s1": {"rating": 1}})[0][0]["strength"]
    strong = evidence_from_passport(rows, {"s1": {"rating": 5}})[0][0]["strength"]
    assert weak < strong <= 1.0


def test_explicit_strength_column_wins_over_level_default():
    rows = [{"id": "1", "skill_name": "Python", "level": "declared", "strength": 0.83}]
    assert evidence_from_passport(rows)[0][0]["strength"] == 0.83


def test_unmappable_skill_is_reported_not_dropped_silently():
    records, unmapped = evidence_from_passport([{"id": "1", "skill_name": "Dowsing", "level": "verified"}])
    assert records == []
    assert unmapped == ["Dowsing"]


# ── profile assembly (#4) ───────────────────────────────────────────────────────────────
ANSWERS = {
    "professional": {"experience": "3-5", "city": "Mandi", "country": "India", "headline": "Dev"},
    "education": {"degree": "B.Tech", "graduationYear": "2026"},
    "resumeSkills": {"skills": ["Python", "reactjs", "Quidditch"]},
    "careerGoals": {"primaryRole": "Data Analyst / Data Scientist"},
    "jobPrefs": {"workModes": ["remote", "on-site"], "opportunityTypes": ["internship", "full-time"]},
}


def _build(**kw):
    return build_student_profile(
        profile_row={"id": "u1"},
        seeker_details={"headline": "Aspiring analyst", "answers": ANSWERS},
        passport_rows=[{"id": "p1", "skill_name": "SQL", "level": "assessed"}],
        **kw,
    )


def test_profile_is_valid_for_the_package():
    profile, notes = _build()
    model = StudentProfile(**profile)  # extra="forbid": a stray key would raise here
    assert model.student_id == "u1"
    assert model.experience_years == 3.0
    assert model.education.graduation_year == 2026
    assert model.location == "Mandi India"
    assert set(model.preferred_work_modes) == {"remote", "onsite"}
    assert set(model.preferred_opportunity_types) == {"internship", "job"}
    assert "SQL" in model.declared_skills, "evidenced skills count as declared"
    assert notes["unmapped_skills"] == ["Quidditch"]


def test_cgpa_stays_unknown_rather_than_invented():
    profile, notes = _build()
    assert profile["education"]["cgpa"] is None
    assert notes["cgpa_known"] is False


def test_planning_inputs_default_and_are_flagged_as_defaults():
    profile, notes = _build()
    assert (profile["weekly_hours"], profile["timeline_weeks"]) == (6.0, 8)
    assert notes["weekly_hours_supplied"] is False

    profile, notes = _build(weekly_hours=12.0, timeline_weeks=4)
    assert (profile["weekly_hours"], profile["timeline_weeks"]) == (12.0, 4)
    assert notes["weekly_hours_supplied"] is True


def test_no_identifying_fields_reach_the_profile():
    profile, _ = _build()
    blob = str(profile).lower()
    for leak in ("full_name", "email", "@"):
        assert leak not in blob


# ── supplied catalogs ───────────────────────────────────────────────────────────────────
def test_postings_map_to_valid_opportunities():
    rows = [
        {
            "id": "j1",
            "title": "Data Analyst Intern",
            "description": "Dashboards",
            "required_skills": ["SQL", "powerbi"],
            "location": "Remote",
            "work_arrangement": "remote",
            "recruiter_id": "r1",
        }
    ]
    opp = opportunities_from_postings(rows, {"r1": "Acme"})[0]
    model = Opportunity(**opp)
    assert model.type == "internship", "title drives the type"
    assert model.organisation == "Acme"
    assert "Power BI" in model.required_skills


def test_mentors_map_to_valid_mentors_with_depth():
    rows = [{
        "id": "m1", "headline": "Backend", "bio": "", "expertise_areas": ["Python"],
        "technical_skills": ["SQL", "Python"], "languages": ["English"],
        "years_experience": 8, "hourly_rate": "", "accepting": True,
    }]
    mentors, skipped = mentors_from_profiles(rows)
    model = Mentor(**mentors[0])
    assert skipped == []
    assert model.expertise["Python"] > model.expertise["SQL"], "declared area outranks technical list"
    assert model.price_per_session_inr is None, "unknown price stays unknown"


def test_mentor_with_no_mappable_skill_is_skipped_and_reported():
    rows = [{"id": "m2", "expertise_areas": ["Astrology"], "technical_skills": []}]
    mentors, skipped = mentors_from_profiles(rows)
    assert mentors == [] and skipped == ["m2"]
