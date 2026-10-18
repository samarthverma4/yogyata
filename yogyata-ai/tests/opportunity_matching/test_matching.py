import json

import pytest
from pydantic import ValidationError

from yogyata_ai.common.config import Settings
from yogyata_ai.common.evidence import level_of, summarize_evidence
from yogyata_ai.common.schemas import EducationInfo, EvidenceRecord, StudentProfile
from yogyata_ai.common.similarity import TfidfSimilarity, get_backend_with_status
from yogyata_ai.opportunity_matching import check_opportunity_eligibility, match_opportunities
from yogyata_ai.opportunity_matching.eligibility import check_eligibility, eligibility_status
from yogyata_ai.opportunity_matching.ranker import normalise_opportunity_skills, rank_opportunities, skill_credit
from yogyata_ai.opportunity_matching.schemas import EligibilityRules, MatchWeights, Opportunity


def ev(skill, source, strength=0.6):
    return EvidenceRecord(skill=skill, source=source, strength=strength)


def prof(**kw):
    return StudentProfile(**kw)


def opp(id="o", **kw):
    base = dict(id=id, type="job", title="Data Analyst", description="Analyse data", required_skills=["SQL", "Python"])
    base.update(kw)
    return Opportunity(**base)


# ---- shared evidence levels ----------------------------------------------------------------
def test_evidence_levels_declared_demonstrated_verified_none():
    p = prof(declared_skills=["Python", "sql"], evidence=[
        ev("SQL", "resume_evidence", 0.5), ev("Git", "task_review", 0.9), ev("Git", "resume_evidence", 0.2)])
    s = summarize_evidence(p)
    assert s["Python"].level == "declared"
    assert s["SQL"].level == "demonstrated"
    assert s["Git"].level == "verified" and s["Git"].strength == 0.9  # reviewed record dominates
    assert level_of(s, "Docker").level == "none" and level_of(s, "Docker").strength is None


def test_weak_signal_flag_and_alias_normalisation():
    s = summarize_evidence(prof(evidence=[ev("sklearn", "interview_auto", 0.2)]))
    assert s["scikit-learn"].level == "demonstrated" and s["scikit-learn"].weak_signal


def test_automated_evidence_never_becomes_verified():
    s = summarize_evidence(prof(evidence=[ev("Python", "task_auto", 1.0), ev("Python", "interview_auto", 1.0)]))
    assert s["Python"].level == "demonstrated"


# ---- eligibility ---------------------------------------------------------------------------
def rules(**kw):
    return opp(eligibility=EligibilityRules(**kw))


def status_of(p, o):
    return eligibility_status(check_eligibility(p, o))


def test_graduation_year_pass_fail_unknown():
    o = rules(allowed_graduation_years=[2026])
    assert status_of(prof(education=EducationInfo(graduation_year=2026)), o) == "eligible"
    assert status_of(prof(education=EducationInfo(graduation_year=2024)), o) == "ineligible"
    assert status_of(prof(), o) == "eligibility_unknown"


def test_cgpa_experience_degree_location_rules():
    p = prof(education=EducationInfo(degree="B.Tech CSE", cgpa=7.5), experience_years=1, location="Demo City A")
    assert status_of(p, rules(min_cgpa=7.5)) == "eligible"
    assert status_of(p, rules(min_cgpa=8.0)) == "ineligible"
    assert status_of(p, rules(min_experience_years=2)) == "ineligible"
    assert status_of(p, rules(allowed_degree_keywords=["tech"])) == "eligible"
    assert status_of(p, rules(allowed_degree_keywords=["mba"])) == "ineligible"
    o = opp(location="Demo City B", eligibility=EligibilityRules(location_required=True))
    assert status_of(p, o) == "ineligible"
    assert status_of(prof(), o) == "eligibility_unknown"


def test_fail_takes_precedence_over_unknown_and_unrestricted_is_eligible():
    o = rules(allowed_graduation_years=[2026], min_cgpa=9.0)
    assert status_of(prof(education=EducationInfo(graduation_year=2020)), o) == "ineligible"
    assert status_of(prof(), opp()) == "eligible"


def test_eligibility_api_and_location_not_required_by_default():
    out = check_opportunity_eligibility({"profile": prof(location="X").model_dump(),
                                         "opportunity": opp(location="Y", work_mode="onsite").model_dump()})
    assert out["status"] == "eligible" and out["checks"] == []


# ---- ranking ---------------------------------------------------------------------------------
def test_ineligible_excluded_with_reason_unknown_kept_and_flagged():
    p = prof(declared_skills=["SQL", "Python"], education=EducationInfo(graduation_year=2025))
    opps = [opp("ok"), opp("bad", eligibility=EligibilityRules(allowed_graduation_years=[2030])),
            opp("unk", eligibility=EligibilityRules(min_cgpa=8.0))]
    res = rank_opportunities(p, opps)
    assert {r.opportunity_id for r in res.ranked} == {"ok", "unk"}
    assert [e.opportunity_id for e in res.excluded] == ["bad"] and res.excluded[0].failed_rules[0].rule == "graduation_year"
    unk = next(r for r in res.ranked if r.opportunity_id == "unk")
    assert unk.eligibility_status == "eligibility_unknown" and any("Eligibility unknown" in x for x in unk.explanation)
    assert len(rank_opportunities(p, opps, include_ineligible=True).ranked) == 3


def test_evidence_beats_bare_claims():
    claimed = prof(declared_skills=["SQL", "Python"])
    shown = prof(declared_skills=["SQL", "Python"], evidence=[ev("SQL", "resume_evidence", 0.65), ev("Python", "resume_evidence", 0.65)])
    a = rank_opportunities(claimed, [opp()]).ranked[0]
    b = rank_opportunities(shown, [opp()]).ranked[0]
    assert b.score > a.score and set(a.weakly_supported_skills) == {"SQL", "Python"} and not b.weakly_supported_skills


def test_verified_weak_result_lowers_match():
    base = prof(declared_skills=["SQL"], evidence=[ev("SQL", "resume_evidence", 0.65)])
    weak = prof(declared_skills=["SQL"], evidence=[ev("SQL", "resume_evidence", 0.65), ev("SQL", "task_review", 0.2)])
    o = opp(required_skills=["SQL"])
    assert rank_opportunities(weak, [o]).ranked[0].score < rank_opportunities(base, [o]).ranked[0].score


def test_skill_credit_conventions():
    assert skill_credit("none", None) == 0 and skill_credit("declared", None) == 0.5
    assert skill_credit("demonstrated", 0.2) == 0.2 and skill_credit("demonstrated", 0.5) == pytest.approx(0.8)
    assert skill_credit("verified", 1.0) == 1.0 and skill_credit("verified", 0.3) == 0.3


def test_missing_skills_listed_and_explained():
    r = rank_opportunities(prof(declared_skills=["SQL"]), [opp(required_skills=["SQL", "Python", "Docker"])]).ranked[0]
    assert r.missing_skills == ["Python", "Docker"] and any("Missing required" in x for x in r.explanation)


def test_weights_are_configurable():
    p = prof(declared_skills=["SQL", "Python"], profile_text="gardening and cooking")
    o = [opp(description="enterprise reporting platform")]
    skills_only = rank_opportunities(p, o, weights=MatchWeights(required_coverage=1, preferred_coverage=0, text_similarity=0, preference_fit=0))
    text_only = rank_opportunities(p, o, weights=MatchWeights(required_coverage=0, preferred_coverage=0, text_similarity=1, preference_fit=0))
    assert skills_only.ranked[0].score == 50.0 and text_only.ranked[0].score < 20
    assert skills_only.weights_used["required_coverage"] == 1


def test_preference_fit_changes_ranking_but_not_eligibility():
    p = prof(declared_skills=["SQL", "Python"], preferred_opportunity_types=["internship"], preferred_work_modes=["remote"])
    a = opp("job", type="job", work_mode="onsite")
    b = opp("intern", type="internship", work_mode="remote")
    res = rank_opportunities(p, [a, b])
    assert res.ranked[0].opportunity_id == "intern" and len(res.ranked) == 2


def test_description_fallback_when_no_skill_lists_and_unknown_names_reported():
    o = opp(required_skills=[], description="Required: SQL and Python. Docker is a plus.")
    assert normalise_opportunity_skills(o)[:2] == (["Python", "SQL"], ["Docker"])
    o2 = opp(required_skills=["SQL", "Cobol"])
    r = rank_opportunities(prof(declared_skills=["SQL"]), [o2]).ranked[0]
    assert any("Cobol" in x for x in r.explanation)


def test_duplicates_empty_and_empty_profile_handled():
    res = rank_opportunities(prof(), [opp("a"), opp("a")])
    assert len(res.ranked) == 1 and any("Duplicate" in w for w in res.warnings)
    assert any("no skills or evidence" in w for w in res.warnings)
    empty = rank_opportunities(prof(declared_skills=["SQL"]), [])
    assert empty.ranked == [] and empty.excluded == []


def test_top_k_ranks_and_deterministic_tie_break():
    p = prof(declared_skills=["SQL", "Python"])
    res = rank_opportunities(p, [opp("b"), opp("a"), opp("c")], backend=TfidfSimilarity())
    assert [r.opportunity_id for r in res.ranked] == ["a", "b", "c"] and [r.rank for r in res.ranked] == [1, 2, 3]
    assert len(rank_opportunities(p, [opp("b"), opp("a")], top_k=1).ranked) == 1


def test_no_probability_claims():
    r = rank_opportunities(prof(declared_skills=["SQL"]), [opp()]).ranked[0]
    assert "not a probability" in r.score_meaning


def test_demo_flag_propagates():
    assert rank_opportunities(prof(), [opp(is_demo=True)]).ranked[0].is_demo


# ---- backend fallback --------------------------------------------------------------------------
def test_embeddings_unavailable_falls_back_to_tfidf_with_status():
    backend, status = get_backend_with_status(Settings(similarity_backend="embeddings", embedding_model="no/such-model"))
    assert isinstance(backend, TfidfSimilarity) and "unavailable" in status


# ---- API -----------------------------------------------------------------------------------------
def test_api_skips_invalid_records_and_is_json_serialisable():
    payload = {"profile": prof(declared_skills=["SQL", "Python"]).model_dump(),
               "opportunities": [opp("good").model_dump(), {"id": "broken"}, {"id": "x", "type": "nonsense", "title": "t"}],
               "top_k": 5}
    out = match_opportunities(payload)
    json.dumps(out)
    assert [r["opportunity_id"] for r in out["ranked"]] == ["good"]
    assert sum("skipped" in w for w in out["warnings"]) == 2


def test_api_validates_profile_and_weights():
    with pytest.raises(ValidationError):
        match_opportunities({"profile": {"weekly_hours": -1}, "opportunities": []})
    with pytest.raises(ValidationError):
        match_opportunities({"profile": {}, "opportunities": [], "weights": {"required_coverage": -1}})
    with pytest.raises(KeyError):
        match_opportunities({"opportunities": []})


def test_opportunity_schema_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        Opportunity(id="x", type="job", title="t", salary_guarantee=True)
