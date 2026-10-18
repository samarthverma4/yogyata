import json
from pathlib import Path

import pytest

from yogyata_ai.mentor_recommendation import recommend_mentors
from yogyata_ai.mentor_recommendation.ranker import slots_overlap
from yogyata_ai.mentor_recommendation.schemas import Mentor, Slot

MENTORS = json.loads((Path(__file__).resolve().parents[2] / "data" / "demo" / "mentors.json").read_text(encoding="utf-8"))["mentors"]


def rec(profile=None, role="ml_engineer", mentors=None, **kw):
    return recommend_mentors({"profile": profile or {"declared_skills": ["Python"], "goals": "machine learning engineer"},
                              "role_id": role, "mentors": MENTORS if mentors is None else mentors, "limit": 20, **kw})


def ids(r):
    return [x["mentor_id"] for x in r["ranked"]]


def mentor(id, price=500, av="default", **kw):
    d = dict(id=id, expertise={"Machine Learning": 4}, roles=["ml_engineer"], price_per_session_inr=price,
             availability=[{"day": "Sat", "start": "10:00", "end": "12:00"}] if av == "default" else av)
    d.update(kw)
    return d


def test_relevant_mentor_ranked_first_and_explained():
    r = rec()
    assert ids(r)[0] == "dm1"
    top = r["ranked"][0]
    assert top["matched_skills"] and any("Machine Learning" in x or "scikit-learn" in x for x in top["reasons"])
    assert r["booking_performed"] is False and "has not booked" in top["next_step"]
    assert any("demo" in w.lower() for w in r["warnings"])


def test_budget_is_a_hard_filter_but_unknown_price_is_flagged_not_excluded():
    r = rec({"declared_skills": ["Python"], "goals": "ml", "budget_per_session_inr": 600})
    byid = {x["mentor_id"]: x for x in r["ranked"]}
    assert "dm1" not in byid and "dm5" not in byid          # priced above budget
    assert "dm7" in byid and any("price not provided" in u for u in byid["dm7"]["unknowns"])
    assert any(e["mentor_id"] == "dm1" and "exceeds budget" in e["reason"] for e in r["excluded"])


def test_zero_budget_excludes_every_known_paid_mentor():
    r = rec({"goals": "ml", "budget_per_session_inr": 0})
    assert all(x["price_per_session_inr"] in (None, 0) for x in r["ranked"])


def test_availability_overlap_hard_filter_and_unknown_flagged():
    r = rec(availability=[{"day": "Sun", "start": "10:00", "end": "11:30"}])
    assert "dm5" in ids(r) and "dm1" not in ids(r)
    assert any("availability not provided" in u for x in r["ranked"] if x["mentor_id"] == "dm7" for u in x["unknowns"])


def test_session_length_matters_for_overlap():
    a = [Slot(day="Sat", start="10:00", end="10:30")]
    b = [Slot(day="Sat", start="10:00", end="12:00")]
    assert not slots_overlap(a, b, 60) and slots_overlap(a, b, 30)
    assert not slots_overlap([Slot(day="Sun", start="10:00", end="12:00")], b, 15)


def test_not_accepting_excluded():
    r = rec({"goals": "dashboards", "evidence": [{"skill": "Tableau", "source": "task_review", "strength": 0.2, "ref_id": "t"}]}, role="data_analyst")
    assert "dm10" not in ids(r) and any(e["mentor_id"] == "dm10" and "not accepting" in e["reason"] for e in r["excluded"])


def test_irrelevant_mentor_excluded_not_ranked():
    r = rec({"goals": "x"}, role="ml_engineer", mentors=[mentor("a"), mentor("b", expertise={"HTML": 5}, roles=["full_stack_developer"])])
    assert ids(r) == ["a"] and any(e["mentor_id"] == "b" and "no expertise" in e["reason"] for e in r["excluded"])


def test_ratings_are_shrunk_so_few_reviews_cannot_dominate():
    few = mentor("few", rating=5.0, n_reviews=1)
    many = mentor("many", rating=4.6, n_reviews=200)
    r = rec(mentors=[few, many])
    assert ids(r)[0] == "many"


def test_missing_rating_does_not_penalise():
    a, b = mentor("a"), mentor("b", rating=3.5, n_reviews=100)
    ra = {x["mentor_id"]: x["score"] for x in rec(mentors=[a, b])["ranked"]}
    assert ra["a"] > 0 and abs(ra["a"] - ra["b"]) < 25


def test_invalid_mentor_records_skipped_with_warning():
    bad = {"id": "bad", "expertise": {"Python": 9}}
    r = rec(mentors=[mentor("ok"), bad, {"id": "bad2", "expertise": {"Python": 3}, "availability": [{"day": "Mon", "start": "10:00", "end": "09:00"}]}])
    assert ids(r) == ["ok"] and sum("skipped invalid mentor" in w for w in r["warnings"]) == 2


def test_mentor_schema_rejects_unknown_fields():
    with pytest.raises(Exception):
        Mentor(id="x", expertise={"Python": 3}, verified=True)
    with pytest.raises(Exception):
        Mentor(id="x", expertise={}, )


def test_no_mentors_and_errors():
    assert "No mentors were supplied." in rec(mentors=[])["warnings"]
    with pytest.raises(ValueError, match="role_id"):
        recommend_mentors({"profile": {}, "mentors": []})
    with pytest.raises(ValueError, match="unknown role"):
        recommend_mentors({"profile": {}, "role_id": "x", "mentors": []})


def test_languages_soft_preference():
    r = rec(languages=["Tamil"], mentors=[mentor("en", languages=["English"]), mentor("ta", languages=["English", "Tamil"])])
    assert ids(r)[0] == "ta"


def test_deterministic_and_limit():
    a = recommend_mentors({"profile": {"goals": "ml"}, "role_id": "ml_engineer", "mentors": MENTORS, "limit": 2})
    b = recommend_mentors({"profile": {"goals": "ml"}, "role_id": "ml_engineer", "mentors": MENTORS, "limit": 2})
    assert a == b and len(a["ranked"]) == 2


def test_no_protected_attributes_in_schema():
    fields = set(Mentor.model_fields)
    assert not fields & {"gender", "age", "religion", "caste", "photo", "name", "email", "phone"}
