"""Evidence states: assignment rules, freshness, conflicts and consistency across skill-gap and roadmap."""
import pytest

from yogyata_ai.common.evidence import (
    EVIDENCE_STATES, EvidenceConfig, demonstrated_min_strength, level_of, summarize_evidence,
)
from yogyata_ai.common.schemas import AssessmentAttempt, EvidenceRecord, StudentProfile
from yogyata_ai.roadmap import generate_roadmap
from yogyata_ai.skill_gap import analyze_skill_gap
from yogyata_ai.skill_gap.analysis import credit_for, status_for


def prof(**kw):
    return StudentProfile(**kw)


def rec(skill="SQL", source="interview_auto", strength=0.8, **kw):
    return EvidenceRecord(skill=skill, source=source, strength=strength, **kw)


def state(p, skill="SQL", **kw):
    return level_of(summarize_evidence(p, **kw), skill)


def test_all_five_states_exist_and_are_reachable():
    assert set(EVIDENCE_STATES) == {"demonstrated", "partially_demonstrated", "mentioned_unverified", "not_assessed", "missing_evidence"}
    got = {
        state(prof(evidence=[rec(strength=0.9)])).state,
        state(prof(evidence=[rec(strength=0.45)])).state,
        state(prof(declared_skills=["SQL"])).state,
        state(prof()).state,
        state(prof(assessment_attempts=[AssessmentAttempt(skill="SQL", kind="interview")])).state,
    }
    assert got == set(EVIDENCE_STATES)


def test_resume_mention_is_never_demonstrated_even_when_strong():
    s = state(prof(evidence=[rec(source="resume_evidence", strength=0.95)]))
    assert s.state == "mentioned_unverified" and s.level == "demonstrated"


def test_declared_only_is_mentioned_unverified():
    assert state(prof(declared_skills=["sql"])).state == "mentioned_unverified"


@pytest.mark.parametrize("source", ["interview_auto", "task_auto", "task_review", "interview_review", "portfolio_review"])
def test_assessed_sources_can_be_demonstrated(source):
    assert state(prof(evidence=[rec(source=source, strength=0.9)])).state == "demonstrated"


def test_unknown_skill_is_not_assessed_and_not_a_weakness():
    s = state(prof(), "Python")
    assert s.state == "not_assessed" and s.level == "none"
    rep = analyze_skill_gap({"profile": {}, "role_id": "data_analyst"})
    assert rep["demonstrated_weaknesses"] == []
    assert all(a["status"] == "unassessed" and a["evidence_state"] == "not_assessed" for a in rep["skills"])
    assert rep["evidence_states"]["not_assessed"] and not rep["evidence_states"]["demonstrated"]


def test_missing_evidence_requires_an_attempt_and_is_not_weakness():
    p = prof(assessment_attempts=[AssessmentAttempt(skill="SQL", kind="task", reason="empty submission")])
    assert state(p).state == "missing_evidence"
    rep = analyze_skill_gap({"profile": p.model_dump(), "role_id": "data_analyst"})
    sql = next(a for a in rep["skills"] if a["skill"] == "SQL")
    assert sql["status"] == "missing_evidence" and sql["credit"] == 0 and "SQL" not in rep["demonstrated_weaknesses"]
    assert "SQL" in rep["missing_evidence"]


def test_attempt_plus_claim_is_missing_evidence_with_note_and_attempt_ignored_once_assessed():
    p = prof(declared_skills=["SQL"], assessment_attempts=[AssessmentAttempt(skill="SQL", kind="interview")])
    s = state(p)
    assert s.state == "missing_evidence" and any("claimed" in n for n in s.notes)
    p2 = prof(declared_skills=["SQL"], evidence=[rec(strength=0.9)], assessment_attempts=[AssessmentAttempt(skill="SQL", kind="interview")])
    assert state(p2).state == "demonstrated"


def test_state_threshold_matches_readiness_met_status_across_a_sweep():
    """Guards against drift: state==demonstrated exactly when the readiness status is 'met' (or the weak case)."""
    for source in ("interview_auto", "task_review"):
        for i in range(0, 101):
            st = i / 100
            s = state(prof(evidence=[rec(source=source, strength=st)]))
            status = status_for(s)
            assert (s.state == "demonstrated") == (status == "met"), (source, st, status, s.state)
            assert s.state in ("demonstrated", "partially_demonstrated")
            assert credit_for(s) >= 0.6 if s.state == "demonstrated" else credit_for(s) < 0.6


def test_thresholds_are_documented_functions_of_level():
    assert demonstrated_min_strength("verified") == 0.60 and demonstrated_min_strength("demonstrated") == 0.625


def test_weak_assessed_evidence_is_partial_with_weak_signal():
    s = state(prof(evidence=[rec(strength=0.2)]))
    assert s.state == "partially_demonstrated" and s.weak_signal
    rep = analyze_skill_gap({"profile": prof(evidence=[rec(strength=0.2)]).model_dump(), "role_id": "data_analyst"})
    assert "SQL" in rep["demonstrated_weaknesses"]


def test_status_to_state_mapping_is_total_and_consistent_on_demo_scenarios():
    import json
    from pathlib import Path
    scen = json.loads((Path(__file__).parents[2] / "data" / "demo" / "skill_gap_scenarios.json").read_text())["scenarios"]
    allowed = {"met": {"demonstrated"}, "developing": {"partially_demonstrated"}, "demonstrated_weakness": {"partially_demonstrated"},
               "self_reported_use": {"mentioned_unverified"}, "missing_evidence": {"mentioned_unverified", "missing_evidence"},
               "unassessed": {"not_assessed"}}
    seen = set()
    for sc in scen:
        rep = analyze_skill_gap({"profile": sc["profile"], "role_id": sc["role_id"]})
        for a in rep["skills"]:
            assert a["evidence_state"] in allowed[a["status"]], (sc["id"], a["skill"], a["status"], a["evidence_state"])
            seen.add(a["evidence_state"])
        flat = [x for v in rep["evidence_states"].values() for x in v]
        assert sorted(flat) == sorted(a["skill"] for a in rep["skills"])
    assert {"demonstrated", "mentioned_unverified", "not_assessed"} <= seen


# ---- reviewed vs automated, conflicts, freshness ---------------------------------------------------------------------
def test_reviewed_evidence_outranks_automated_and_conflict_is_flagged_not_hidden():
    p = prof(evidence=[rec(source="interview_auto", strength=0.9), rec(source="task_review", strength=0.3)])
    s = state(p)
    assert s.level == "verified" and s.strength == 0.3 and s.state == "partially_demonstrated"
    assert s.conflict and any("human-reviewed result takes precedence" in n for n in s.notes)


def test_small_disagreement_is_not_a_conflict_and_threshold_is_configurable():
    p = prof(evidence=[rec(strength=0.7), rec(source="task_auto", strength=0.5)])
    assert not state(p).conflict
    assert state(p, config=EvidenceConfig(conflict_spread=0.2)).conflict


def test_conflict_lowers_report_confidence():
    clean = prof(evidence=[rec(source="task_review", strength=0.8)])
    messy = prof(evidence=[rec(source="task_review", strength=0.8), rec(source="portfolio_review", strength=0.2)])
    c1 = analyze_skill_gap({"profile": clean.model_dump(), "role_id": "data_analyst"})
    c2 = analyze_skill_gap({"profile": messy.model_dump(), "role_id": "data_analyst"})
    g = lambda r: next(a for a in r["skills"] if a["skill"] == "SQL")  # noqa: E731
    assert g(c1)["confidence"] == "high" and g(c2)["confidence"] == "medium" and g(c2)["evidence_conflict"]
    assert any("disagrees" in n for n in c2["notes"])


def test_stale_evidence_is_flagged_only_when_as_of_given():
    p = prof(evidence=[rec(source="task_review", strength=0.9, assessed_at="2024-01-10")])
    assert not state(p).stale and state(p).last_assessed_at == "2024-01-10"
    s = state(p, as_of="2026-10-18")
    assert s.stale and s.state == "demonstrated" and any("re-assess" in n for n in s.notes)
    assert not state(p, as_of="2024-12-01").stale
    assert state(p, as_of="2024-12-01", config=EvidenceConfig(stale_after_days=30)).stale


def test_stale_flag_flows_to_report_and_lowers_confidence_but_not_credit():
    p = prof(evidence=[rec(source="task_review", strength=0.9, assessed_at="2023-05-01")])
    fresh = analyze_skill_gap({"profile": p.model_dump(), "role_id": "data_analyst"})
    old = analyze_skill_gap({"profile": p.model_dump(), "role_id": "data_analyst", "as_of": "2026-10-18"})
    g = lambda r: next(a for a in r["skills"] if a["skill"] == "SQL")  # noqa: E731
    assert g(old)["evidence_stale"] and g(old)["confidence"] == "medium" and g(fresh)["confidence"] == "high"
    assert g(old)["credit"] == g(fresh)["credit"] and old["readiness_score"] == fresh["readiness_score"]
    assert old["as_of"] == "2026-10-18" and fresh["as_of"] is None
    assert analyze_skill_gap({"profile": p.model_dump(), "role_id": "data_analyst", "as_of": "2026-10-18", "stale_after_days": 5000})["notes"] != old["notes"]


def test_unknown_assessment_date_is_reported_transparently():
    s = state(prof(evidence=[rec(strength=0.9)]), as_of="2026-10-18")
    assert not s.stale and any("date unknown" in n for n in s.notes)


def test_datetime_and_timezone_values_accepted_and_garbage_rejected():
    assert rec(assessed_at="2026-03-01T10:00:00Z").assessed_at == "2026-03-01T10:00:00Z"
    with pytest.raises(ValueError):
        rec(assessed_at="yesterday")
    with pytest.raises(ValueError):
        AssessmentAttempt(skill="SQL", kind="task", assessed_at="31/02/2026")


def test_existing_payloads_without_new_fields_still_validate():
    EvidenceRecord(skill="SQL", source="declared", strength=0.3)
    StudentProfile()


def test_config_from_env(monkeypatch):
    monkeypatch.setenv("YOGYATA_EVIDENCE_STALE_DAYS", "90")
    monkeypatch.setenv("YOGYATA_EVIDENCE_CONFLICT_SPREAD", "bad")
    c = EvidenceConfig.from_env()
    assert c.stale_after_days == 90 and c.conflict_spread == 0.35


def test_interview_low_confidence_creates_attempt_and_dated_evidence_keeps_date():
    from yogyata_ai.interview.evaluator import evaluate_answer
    from yogyata_ai.interview.bank import default_bank
    from yogyata_ai.interview.selection import evaluations_to_attempts, evaluations_to_evidence
    weak = evaluate_answer(default_bank().get("sql_join_types"), "They join tables.")
    assert evaluations_to_evidence([weak]) == [] and evaluations_to_attempts([weak])[0].skill == "SQL"
    good = evaluate_answer(default_bank().get("sql_join_types"), "An inner join returns only the rows that have matching values in both tables. A left join returns all rows from the left table and the matching rows from the right, and the right-side columns are NULL where there is no match. For example, to list all customers including those with no orders I would use a left join.")
    good = good.model_copy(update={"assessed_at": "2026-10-01"})
    assert evaluations_to_evidence([good])[0].assessed_at == "2026-10-01"


# ---- roadmap consistency -----------------------------------------------------------------------------------------------
def test_roadmap_treats_states_consistently():
    base = {"profile": {"declared_skills": ["SQL"], "weekly_hours": 20, "timeline_weeks": 30}, "role_id": "data_analyst"}
    r = generate_roadmap(base)
    ms = {m["skill"]: m for m in r["milestones"]}
    assert ms["SQL"]["evidence_state"] == "mentioned_unverified"
    assert ms["Python"]["evidence_state"] == "not_assessed" and ms["Python"]["status_now"] == "unassessed"
    sql_types = [i["type"] for i in r["items"] if i["skill"] == "SQL" and i["type"] != "project"]
    assert "learn" not in sql_types  # a claimed skill gets a diagnostic + reviewed assessment, not a basic course
    py_why = next(i for i in r["items"] if i["skill"] == "Python")["reason"]
    assert "not a weakness" in py_why


def test_roadmap_milestone_state_for_attempted_assessment():
    p = {"profile": {"assessment_attempts": [{"skill": "SQL", "kind": "interview"}], "weekly_hours": 20, "timeline_weeks": 30}, "role_id": "data_analyst"}
    ms = {m["skill"]: m for m in generate_roadmap(p)["milestones"]}
    assert ms["SQL"]["evidence_state"] == "missing_evidence" and ms["SQL"]["status_now"] == "missing_evidence"
