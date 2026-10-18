"""Role and skill translation between the app's free text and the package's fixed catalogs."""
from __future__ import annotations

import pytest

from server.vocab import canonical_skills, resolve_role, supported_roles


@pytest.mark.parametrize(
    "label,expected",
    [
        ("Data Analyst / Data Scientist", "data_analyst"),
        ("Business Analyst", "data_analyst"),
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
    """These used to fall through to full_stack_developer, scoring against the wrong catalog."""
    assert resolve_role(label) is None


def test_supported_roles_matches_package_catalog():
    assert set(supported_roles()) == {"ml_engineer", "data_analyst", "full_stack_developer"}


def test_skill_canonicalisation_reports_unknowns():
    known, unknown = canonical_skills(["reactjs", "Python", "Underwater Basketweaving", "sklearn", "python"])
    assert "React" in known and "scikit-learn" in known
    assert known.count("Python") == 1, "duplicates collapse"
    assert unknown == ["Underwater Basketweaving"]
