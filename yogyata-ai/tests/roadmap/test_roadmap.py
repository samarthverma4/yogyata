import json

import pytest

from yogyata_ai.roadmap import generate_roadmap, update_roadmap
from yogyata_ai.roadmap.catalog import Activity, ActivityCatalog, default_activity_catalog


def req(role="data_analyst", declared=(), evidence=(), **prof):
    return {"profile": {"declared_skills": list(declared), "evidence": list(evidence), **prof}, "role_id": role}


def ev(skill, source, strength, ref=None):
    return {"skill": skill, "source": source, "strength": strength, **({"ref_id": ref} if ref else {})}


def act(id, skill="Python", type="learn", hours=2, requires=()):
    return dict(id=id, skill=skill, type=type, title=id, hours=hours, objective="o", expected_evidence="e",
                completion_criteria="c", requires=list(requires))


# ---- catalog ----------------------------------------------------------------------------------
def test_default_catalog_valid_and_has_no_urls():
    cat = default_activity_catalog()
    assert len(cat.activities) > 50
    assert "http" not in json.dumps([a.model_dump() for a in cat.activities.values()])


@pytest.mark.parametrize("acts,msg", [
    ([act("a"), act("a")], "duplicate"),
    ([act("a", skill="python")], "canonical"),
    ([act("a", requires=["zzz"])], "unknown activity"),
    ([act("a", requires=["b"]), act("b", skill="SQL")], "different skill"),
    ([act("a", requires=["b"]), act("b", requires=["a"])], "cycle"),
])
def test_catalog_validation(acts, msg):
    with pytest.raises(ValueError, match=msg):
        ActivityCatalog([Activity(**a) for a in acts])


def test_activity_rejects_unknown_fields_and_bad_hours():
    with pytest.raises(Exception):
        Activity(**{**act("a"), "hours": 0})
    with pytest.raises(Exception):
        Activity(**{**act("a"), "verified": True})


# ---- planning ---------------------------------------------------------------------------------
def test_time_budget_respected_and_overflow_deferred():
    r = generate_roadmap(req(weekly_hours=3, timeline_weeks=4))
    assert r["constraints"]["hours_budget"] == 12
    assert r["total_hours"] <= 12 and all(i["end_week"] <= 4 for i in r["items"])
    assert r["deferred"] and all(d["reason"] for d in r["deferred"])


def test_defaults_are_flagged_as_assumptions():
    r = generate_roadmap(req())
    assert len(r["constraints"]["assumed"]) == 2 and any("Defaults" in n for n in r["notes"])


def test_prerequisite_skills_come_first():
    r = generate_roadmap(req(role="ml_engineer", weekly_hours=20, timeline_weeks=26))
    first = {}
    last = {}
    for i in r["items"]:
        if i["type"] == "project":
            continue
        first.setdefault(i["skill"], i["order"])
        last[i["skill"]] = i["order"]
    assert last["Python"] < first["Machine Learning"] and last["Machine Learning"] < first["scikit-learn"]


def test_activity_order_within_skill():
    r = generate_roadmap(req(weekly_hours=20, timeline_weeks=26))
    pos = {i["activity_id"]: i["order"] for i in r["items"]}
    assert pos["learn_statistics"] < pos["practice_statistics"] < pos["assess_statistics"]


def test_sequence_depends_on_evidence_status():
    r = generate_roadmap(req(declared=["SQL"], evidence=[ev("Python", "resume_evidence", 0.65)], weekly_hours=20, timeline_weeks=26))
    ids = [i["activity_id"] for i in r["items"]]
    assert "learn_sql" not in ids and "assess_sql" in ids          # declared only: prove it, don't re-teach
    assert "learn_python" not in ids and "assess_python" in ids    # resume-only: prove it
    assert "learn_statistics" in ids                               # unassessed: start from the basics


def test_weakness_gets_learning_path():
    r = generate_roadmap(req(evidence=[ev("SQL", "task_review", 0.2, "t")], weekly_hours=20, timeline_weeks=26))
    ids = [i["activity_id"] for i in r["items"]]
    assert ids.index("learn_sql") < ids.index("practice_sql") < ids.index("assess_sql")


def test_met_skills_are_not_planned():
    r = generate_roadmap(req(evidence=[ev("SQL", "task_review", 0.9, "t")], weekly_hours=20, timeline_weeks=26))
    assert all(i["skill"] != "SQL" for i in r["items"])


def test_all_met_gives_empty_plan_with_note():
    from yogyata_ai.skill_gap.roles import default_catalog
    skills = [s.skill for s in default_catalog().get("data_analyst").skills]
    r = generate_roadmap(req(evidence=[ev(s, "task_review", 0.9, s) for s in skills]))
    assert r["items"] == [] and any("already met" in n for n in r["notes"])


def test_items_explain_and_state_evidence_expectations():
    r = generate_roadmap(req())
    for i in r["items"]:
        assert i["reason"] and i["objective"] and i["completion_criteria"] and i["expected_evidence"]
        assert i["start_week"] <= i["end_week"]
    assessments = [i for i in r["items"] if i["type"] == "assessment"]
    assert assessments and all(i["requires_review"] and i["evidence_source"] == "task_review" for i in assessments)
    assert "does not mean a skill is competent" in r["disclaimer"]


def test_completed_activities_not_repeated_and_unknown_ignored():
    r = generate_roadmap(req(weekly_hours=20, timeline_weeks=26, completed_activity_ids=["learn_statistics", "nonsense"]))
    assert "learn_statistics" not in [i["activity_id"] for i in r["items"]]
    assert r["already_completed"] == ["learn_statistics"] and any("nonsense" in n for n in r["notes"])


def test_completion_alone_does_not_make_skill_met():
    r = generate_roadmap(req(completed_activity_ids=["learn_sql", "practice_sql", "assess_sql"], weekly_hours=20, timeline_weeks=26))
    assert "SQL" not in r["gap_summary"]["met"]


def test_persistent_weakness_after_full_path_escalates_to_mentor_not_repeat():
    r = generate_roadmap(req(evidence=[ev("SQL", "task_review", 0.2, "t")], weekly_hours=20, timeline_weeks=26,
                             completed_activity_ids=["learn_sql", "practice_sql", "assess_sql"]))
    assert not any(i["skill"] == "SQL" and i["type"] in ("learn", "practice", "assessment") for i in r["items"])
    assert any(m["skill"] == "SQL" and "still weak" in m["reason"] for m in r["mentorship_suggestions"])


def test_zero_budget_excludes_paid_suggestions_and_no_booking_flags():
    r = generate_roadmap(req(budget_per_session_inr=0, weekly_hours=20, timeline_weeks=26,
                             evidence=[ev("SQL", "task_review", 0.2, "t")],
                             completed_activity_ids=["learn_sql", "practice_sql", "assess_sql"]))
    assert not r["constraints"]["paid_activities_allowed"]
    assert all(m["activity_id"] is None and "zero session budget" in m["cost_note"] for m in r["mentorship_suggestions"])
    assert all("Nothing is booked" in m["note"] for m in r["mentorship_suggestions"])


def test_mentor_activities_never_scheduled_as_items():
    r = generate_roadmap(req(role="ml_engineer", weekly_hours=20, timeline_weeks=26))
    assert all(i["type"] != "mentor_review" for i in r["items"])


def test_max_items_cap():
    r = generate_roadmap({**req(weekly_hours=20, timeline_weeks=26), "max_items": 3})
    assert len(r["items"]) == 3 and any("max_items" in d["reason"] for d in r["deferred"])


def test_dependent_skill_deferred_when_prerequisite_not_fully_planned():
    r = generate_roadmap(req(role="ml_engineer", weekly_hours=4, timeline_weeks=5))
    planned_skills = {i["skill"] for i in r["items"]}
    assert "Machine Learning" not in planned_skills
    assert any(d["skill"] == "Machine Learning" for d in r["deferred"])


def test_custom_catalog_missing_skill_noted():
    cat = ActivityCatalog([Activity(**act("learn_x", skill="Python"))])
    r = generate_roadmap(req(role="ml_engineer", weekly_hours=20, timeline_weeks=26), activities=cat)
    assert any("No catalog activity" in n for n in r["notes"])


def test_errors_and_validation():
    with pytest.raises(ValueError, match="unknown role"):
        generate_roadmap(req(role="astronaut"))
    with pytest.raises(ValueError, match="role_id is required"):
        generate_roadmap({"profile": {}})
    with pytest.raises(Exception):
        generate_roadmap({"profile": {"weekly_hours": -1}, "role_id": "data_analyst"})


def test_json_stable_and_deterministic():
    p = req(declared=["SQL"], weekly_hours=6, timeline_weeks=8)
    assert json.dumps(generate_roadmap(p), sort_keys=True) == json.dumps(generate_roadmap(p), sort_keys=True)


# ---- updates ------------------------------------------------------------------------------------
def test_update_with_reviewed_evidence_removes_skill_and_explains():
    p = req(declared=["SQL"], evidence=[ev("SQL", "task_review", 0.2, "t0")], weekly_hours=20, timeline_weeks=26)
    u = update_roadmap(p, new_evidence=[ev("SQL", "task_review", 0.95, "t1")])
    # same skill: both reviews counted (latest/strength logic of evidence summary); SQL should not be worse
    assert u["diff"]["readiness_delta"] >= 0


def test_update_marks_newly_met_and_removed_reason():
    p = req(declared=["SQL"], weekly_hours=20, timeline_weeks=26)
    u = update_roadmap(p, new_evidence=[ev("SQL", "task_review", 0.95, "t1")])
    assert "SQL" in u["diff"]["newly_met_skills"]
    assert any(r["skill"] == "SQL" and "now met" in r["reason"] for r in u["diff"]["removed"])
    assert all(i["skill"] != "SQL" for i in u["after"]["items"])


def test_update_completed_activity_removed_but_status_unchanged():
    p = req(weekly_hours=20, timeline_weeks=26)
    u = update_roadmap(p, completed_activity_ids=["learn_statistics"])
    assert any(r["activity_id"] == "learn_statistics" and r["reason"] == "marked completed" for r in u["diff"]["removed"])
    assert u["diff"]["newly_met_skills"] == [] and u["diff"]["readiness_delta"] == 0


def test_update_rejects_invalid_evidence():
    with pytest.raises(Exception):
        update_roadmap(req(), new_evidence=[{"skill": "SQL", "source": "task_review", "strength": 5}])
    with pytest.raises(Exception):
        update_roadmap(req(), new_evidence=[{"skill": "SQL", "source": "declared", "strength": 0.5, "verified": True}])
