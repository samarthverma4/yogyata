import json

import pytest
from pydantic import ValidationError

from yogyata_ai.common.evidence import summarize_evidence
from yogyata_ai.common.schemas import EvidenceRecord, StudentProfile
from yogyata_ai.interview.bank import default_bank
from yogyata_ai.interview.evaluator import evaluate_answer
from yogyata_ai.skill_gap import analyze_skill_gap, list_roles, reassess
from yogyata_ai.skill_gap.analysis import analyze_gap, credit_for, status_for
from yogyata_ai.skill_gap.api import merge_evidence
from yogyata_ai.skill_gap.roles import RoleCatalog, RoleConfig, default_catalog


def ev(skill, source, strength, ref=None):
    return {"skill": skill, "source": source, "strength": strength, **({"ref_id": ref} if ref else {})}


def gap(role, declared=(), evidence=(), **kw):
    return analyze_skill_gap({"profile": {"declared_skills": list(declared), "evidence": list(evidence)},
                              "role_id": role, **kw})


def by_skill(rep):
    return {s["skill"]: s for s in rep["skills"]}


# ---- role configuration -------------------------------------------------------------------------
def test_default_roles_valid_and_listed():
    assert default_catalog().ids == ["data_analyst", "full_stack_developer", "ml_engineer"]
    assert {r["id"] for r in list_roles()} == set(default_catalog().ids)


@pytest.mark.parametrize("skills,msg", [
    ([{"skill": "Python", "importance": 3, "prerequisites": ["Nope"]}], "not a skill of this role"),
    ([{"skill": "Python", "importance": 3}, {"skill": "Python", "importance": 2}], "duplicate"),
    ([{"skill": "python", "importance": 3}], "canonical"),
    ([{"skill": "Python", "importance": 3, "prerequisites": ["Python"]}], "own prerequisite"),
    ([{"skill": "Python", "importance": 3, "prerequisites": ["SQL"]}, {"skill": "SQL", "importance": 3, "prerequisites": ["Python"]}], "cycle"),
])
def test_role_config_validation(skills, msg):
    with pytest.raises(ValueError, match=msg):
        RoleConfig(id="x", title="t", skills=skills)


def test_importance_range_and_custom_catalog():
    with pytest.raises(ValidationError):
        RoleConfig(id="x", title="t", skills=[{"skill": "Python", "importance": 9}])
    cat = RoleCatalog.from_dict({"roles": {"py_dev": {"title": "Py", "skills": [{"skill": "Python", "importance": 5}]}}})
    rep = analyze_skill_gap({"profile": {"declared_skills": ["Python"]}, "role_id": "py_dev"}, catalog=cat)
    assert rep["skills"][0]["status"] == "missing_evidence"


def test_unknown_role_and_missing_role():
    with pytest.raises(ValueError, match="unknown role"):
        gap("astronaut")
    with pytest.raises(ValueError, match="role_id is required"):
        analyze_skill_gap({"profile": {}})


def test_target_role_used_when_role_id_absent():
    rep = analyze_skill_gap({"profile": {"target_role": "data_analyst"}})
    assert rep["role_id"] == "data_analyst"


# ---- status and credit rules --------------------------------------------------------------------
def summ(profile_kwargs, skill):
    return summarize_evidence(StudentProfile(**profile_kwargs))[skill]


def test_credit_and_status_conventions():
    declared = summ({"declared_skills": ["Python"]}, "Python")
    assert credit_for(declared) == 0.25 and status_for(declared) == "missing_evidence"
    weak_auto = summ({"evidence": [EvidenceRecord(skill="Python", source="interview_auto", strength=0.2)]}, "Python")
    assert status_for(weak_auto) == "demonstrated_weakness" and credit_for(weak_auto) == 0.1
    reviewed = summ({"evidence": [EvidenceRecord(skill="Python", source="task_review", strength=0.8)]}, "Python")
    assert credit_for(reviewed) == 0.8 and status_for(reviewed) == "met"
    resume = summ({"evidence": [EvidenceRecord(skill="Python", source="resume_evidence", strength=1.0)]}, "Python")
    assert credit_for(resume) == 0.55 and status_for(resume) == "self_reported_use"


def test_missing_information_is_never_a_weakness():
    rep = gap("ml_engineer")
    assert rep["demonstrated_weaknesses"] == [] and len(rep["unassessed"]) == len(rep["skills"])
    assert all(s["confidence"] == "none" for s in rep["skills"])
    assert rep["readiness_score"] == 0 and rep["readiness_max"] == 100
    assert any("not failed" in n for n in rep["notes"])


def test_declared_only_never_met_and_resume_only_never_met():
    rep = gap("data_analyst", declared=["SQL"], evidence=[ev("Python", "resume_evidence", 1.0)])
    s = by_skill(rep)
    assert s["SQL"]["status"] == "missing_evidence" and s["Python"]["status"] == "self_reported_use"
    assert rep["met"] == []


def test_automated_evidence_alone_can_be_met_but_is_not_verified():
    rep = gap("data_analyst", evidence=[ev("SQL", "interview_auto", 0.9, "i1")])
    s = by_skill(rep)["SQL"]
    assert s["status"] == "met" and s["level"] == "demonstrated" and s["confidence"] == "low"
    assert rep["verified_coverage"] == 0 and any("nothing here is verified" in n for n in rep["notes"])


def test_reviewed_result_overrides_resume_claim():
    rep = gap("data_analyst", evidence=[ev("SQL", "resume_evidence", 0.65), ev("SQL", "task_review", 0.3, "t")])
    s = by_skill(rep)["SQL"]
    assert s["status"] == "demonstrated_weakness" and s["level"] == "verified" and s["confidence"] == "high"
    assert "Human-reviewed" in s["explanation"]


def test_weakness_wording_distinguishes_automated_from_reviewed():
    s = by_skill(gap("data_analyst", evidence=[ev("SQL", "interview_auto", 0.2, "i")]))["SQL"]
    assert "Automated assessment" in s["explanation"]


# ---- prerequisites, priority ---------------------------------------------------------------------
def test_blocked_by_and_unlocks_follow_prerequisites():
    s = by_skill(gap("full_stack_developer", declared=["React"]))
    assert set(s["React"]["blocked_by"]) == {"JavaScript", "HTML", "CSS"}
    assert s["JavaScript"]["unlocks"] >= 4 and s["JavaScript"]["blocked_by"] == []
    assert "Build prerequisites first" in s["React"]["explanation"]


def test_met_prerequisite_unblocks():
    s = by_skill(gap("full_stack_developer", evidence=[ev(k, "task_review", 0.9, k) for k in ("JavaScript", "HTML", "CSS")]))
    assert s["React"]["blocked_by"] == []


def test_priority_order_weakness_beats_unassessed_beats_missing_evidence():
    rep = gap("data_analyst", declared=["Excel"], evidence=[ev("SQL", "task_review", 0.2, "t")])
    s = by_skill(rep)
    assert s["SQL"]["priority"] > s["Excel"]["priority"] and s["Statistics"]["priority"] > s["Excel"]["priority"]
    assert rep["priority_gaps"][0]["skill"] == "SQL"
    pr = [g["priority"] for g in rep["priority_gaps"]]
    assert pr == sorted(pr, reverse=True) and all(0 <= p <= 100 for p in pr)


def test_met_skills_have_zero_priority_and_are_not_gaps():
    rep = gap("data_analyst", evidence=[ev("SQL", "task_review", 0.9, "t")])
    assert by_skill(rep)["SQL"]["priority"] == 0 and "SQL" not in [g["skill"] for g in rep["priority_gaps"]]


def test_top_n_limits_gaps():
    assert len(gap("ml_engineer", top_n=3)["priority_gaps"]) == 3


# ---- readiness and sufficiency ---------------------------------------------------------------------
def test_readiness_bounds_bracket_score():
    for kw in ({}, {"declared": ["SQL", "Python"]}, {"evidence": [ev("SQL", "task_review", 0.2, "t"), ev("Python", "resume_evidence", 0.65)]}):
        r = gap("data_analyst", **kw)
        assert r["readiness_min"] <= r["readiness_score"] <= r["readiness_max"]


def test_sufficiency_levels():
    assert gap("data_analyst")["evidence_sufficiency"] == "low"
    mid = gap("data_analyst", evidence=[ev(k, "interview_auto", 0.8, k) for k in ("SQL", "Excel", "Python", "Pandas", "Statistics")])
    assert mid["evidence_sufficiency"] == "medium"
    full = gap("data_analyst", evidence=[ev(s.skill, "task_review", 0.8, s.skill) for s in default_catalog().get("data_analyst").skills])
    assert full["evidence_sufficiency"] == "high" and full["verified_coverage"] == 1.0 and full["readiness_score"] == 80.0


def test_report_lists_partition_all_skills():
    rep = gap("ml_engineer", declared=["Python"], evidence=[ev("Machine Learning", "task_review", 0.2, "t"), ev("Git", "task_review", 0.9, "g")])
    parts = rep["demonstrated_weaknesses"] + rep["missing_evidence"] + rep["unassessed"] + rep["self_reported_use"] + rep["met"]
    developing = [s["skill"] for s in rep["skills"] if s["status"] == "developing"]
    assert sorted(parts + developing) == sorted(s["skill"] for s in rep["skills"])


# ---- evidence merging, interview integration, reassessment ------------------------------------------
def test_alias_evidence_normalised():
    assert by_skill(gap("ml_engineer", evidence=[ev("sklearn", "interview_auto", 0.7, "i")]))["scikit-learn"]["status"] == "met"


def test_merge_evidence_dedupes_identical_records():
    p = StudentProfile(evidence=[EvidenceRecord(skill="SQL", source="task_review", strength=0.8, ref_id="t1")])
    merged = merge_evidence(p, [], [EvidenceRecord(skill="sql", source="task_review", strength=0.8, ref_id="t1")])
    assert len(merged.evidence) == 1
    assert len(p.evidence) == 1  # original untouched


def test_interview_evaluations_feed_gap_as_unverified_evidence():
    bank = default_bank()
    good = evaluate_answer(bank.get("sql_join_types"), "An inner join returns only the rows that have matching values in both tables. A left join returns all rows from the left table and the matching rows from the right, and the right-side columns are NULL where there is no match. For example, to list all customers including those with no orders I would use a left join.")
    rep = analyze_skill_gap({"profile": {}, "role_id": "data_analyst", "interview_evaluations": [good.model_dump()]})
    sql = by_skill(rep)["SQL"]
    assert sql["level"] == "demonstrated" and "interview_auto" in sql["evidence_sources"] and rep["verified_coverage"] == 0


def test_low_confidence_interview_evaluation_not_used_as_evidence():
    weak = evaluate_answer(default_bank().get("sql_join_types"), "They join tables.")
    rep = analyze_skill_gap({"profile": {}, "role_id": "data_analyst", "interview_evaluations": [weak.model_dump()]})
    sql = by_skill(rep)["SQL"]
    # compatibility change (Priority 2): an attempted-but-unusable assessment is "missing_evidence", still not a weakness
    assert sql["level"] == "none" and sql["credit"] == 0 and sql["status"] == "missing_evidence"
    assert sql["evidence_state"] == "missing_evidence" and "SQL" not in rep["demonstrated_weaknesses"]


def test_reassess_reports_what_changed():
    payload = {"profile": {"declared_skills": ["SQL"]}, "role_id": "data_analyst"}
    out = reassess(payload, [ev("SQL", "task_review", 0.9, "t9")])
    assert out["changes"]["readiness_delta"] > 0
    sql = next(c for c in out["changes"]["changed_skills"] if c["skill"] == "SQL")
    assert sql["status"] == ["missing_evidence", "met"] and sql["priority"][1] == 0
    assert out["before"]["verified_coverage"] == 0 < out["after"]["verified_coverage"]


def test_invalid_evidence_rejected_and_unverifiable_flag_cannot_be_forced():
    with pytest.raises(ValidationError):
        gap("data_analyst", extra_evidence=[{"skill": "SQL", "source": "task_review", "strength": 2}])
    with pytest.raises(ValidationError):
        gap("data_analyst", extra_evidence=[{"skill": "SQL", "source": "declared", "strength": 0.5, "verified": True}])


def test_deterministic_and_json_serialisable():
    kw = dict(declared=["Python"], evidence=[ev("Machine Learning", "task_review", 0.2, "t")])
    a, b = gap("ml_engineer", **kw), gap("ml_engineer", **kw)
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
    assert "not a measure of employability" in a["score_meaning"]


def test_analyze_gap_function_direct_use():
    rep = analyze_gap(StudentProfile(declared_skills=["SQL"]), default_catalog().get("data_analyst"))
    assert rep.role_id == "data_analyst" and rep.skills[0].skill == "SQL"
