"""Reviewer override of automated interview assessments."""
import copy

import pytest

from yogyata_ai.common.audit import AuditLog, verify_log
from yogyata_ai.interview import final_interview_result, review_evaluation
from yogyata_ai.interview.bank import default_bank
from yogyata_ai.interview.evaluator import evaluate_answer
from yogyata_ai.interview.review import InterviewOverride, assessment_label, final_result, review_interview
from yogyata_ai.skill_gap import analyze_skill_gap, submit_interview_review

NOW = "2026-10-18T10:00:00Z"
GOOD = ("An inner join returns only the rows that have matching values in both tables. A left join returns all rows from the left "
        "table and the matching rows from the right, and the right-side columns are NULL where there is no match. For example, to "
        "list all customers including those with no orders I would use a left join.")


def evaluation(answer=GOOD, qid="sql_join_types", attempt="att-1", assessed_at="2026-10-01"):
    ev = evaluate_answer(default_bank().get(qid), answer)
    return ev.model_copy(update={"attempt_id": attempt, "assessed_at": assessed_at})


def override(decision="adjust", **kw):
    base = {"review_id": "ir-1", "reviewer_id": "rev-9", "attempt_id": "att-1", "decision": decision, "reason": "reviewed the transcript"}
    if decision == "adjust":
        base["reviewed_overall"] = 40
    base.update(kw)
    return base


# ---- record contents --------------------------------------------------------------------------------------------------
def test_adjust_keeps_original_and_stores_reviewed_result_side_by_side():
    ev = evaluation()
    rec = review_interview(ev, override(reviewed_overall=40, reviewer_comment="Missed NULL handling in practice"), now=NOW)
    assert rec.status == "human_adjusted" and rec.decision == "adjust"
    assert rec.original.overall == ev.overall and rec.original.status == "automated_unverified" and rec.original.scores == ev.scores
    assert rec.reviewed.overall == 40 and rec.reviewed.status == "human_adjusted" and rec.reviewed.assessment == "weak"
    assert rec.reason == "reviewed the transcript" and rec.reviewed_at == "2026-10-18T10:00:00+00:00" and rec.reviewer_id == "rev-9"
    assert rec.final_overall == 40 and rec.original.overall != rec.reviewed.overall
    assert ev.status == "automated_unverified"  # the input evaluation is untouched


def test_confirm_makes_automated_score_human_confirmed():
    ev = evaluation()
    rec = review_interview(ev, override("confirm"), now=NOW)
    assert rec.status == "human_confirmed" and rec.reviewed.overall == ev.overall and rec.original.status == "automated_unverified"


def test_invalidate_records_no_usable_score():
    rec = review_interview(evaluation(), override("invalidate", reason="candidate used a screen reader tool glitch"), now=NOW)
    assert rec.status == "human_invalidated" and rec.reviewed.overall is None and rec.reviewed.assessment == "unusable"
    assert rec.original.overall is not None


def test_dimension_scores_are_validated_and_merged():
    ev = evaluation()
    rec = review_interview(ev, override(reviewed_overall=55, reviewed_scores={"correctness": 30}), now=NOW)
    assert rec.reviewed.scores["correctness"] == 30 and rec.original.scores["correctness"] == ev.scores["correctness"]
    with pytest.raises(ValueError, match="unknown dimension"):
        review_interview(ev, override(reviewed_scores={"charisma": 90}), now=NOW)


def test_assessment_labels_follow_documented_bands():
    assert [assessment_label(x) for x in (0, 49.9, 50, 69.9, 70, 100, None)] == ["weak", "weak", "developing", "developing", "strong", "strong", "unusable"]


# ---- validation / authorization -------------------------------------------------------------------------------------------
@pytest.mark.parametrize("patch", [
    {"reviewed_overall": -1}, {"reviewed_overall": 101}, {"reviewed_overall": float("nan")}, {"reviewed_overall": "70"},
    {"reviewed_overall": True}, {"reviewed_overall": None}, {"reason": ""}, {"reason": "x"}, {"reviewer_id": ""},
    {"attempt_id": "bad id"}, {"decision": "approve"}, {"reviewed_at": "tomorrowish"}, {"reviewed_at": "2031-01-01"},
    {"extra": 1}, {"reviewed_scores": {"correctness": 101}},
])
def test_invalid_overrides_rejected(patch):
    with pytest.raises(Exception):
        review_interview(evaluation(), override(**patch), now=NOW)


def test_scores_not_allowed_with_confirm_or_invalidate():
    for d in ("confirm", "invalidate"):
        with pytest.raises(ValueError):
            review_interview(evaluation(), override(d, reviewed_overall=50), now=NOW)


def test_adjusting_to_the_same_score_is_rejected():
    ev = evaluation()
    with pytest.raises(ValueError, match="confirm"):
        review_interview(ev, override(reviewed_overall=ev.overall), now=NOW)


def test_attempt_mismatch_and_unauthorized_reviewer():
    with pytest.raises(ValueError, match="attempt_id"):
        review_interview(evaluation(attempt="att-1"), override(attempt_id="att-2"), now=NOW)
    with pytest.raises(PermissionError):
        review_interview(evaluation(), override(), authorized_reviewers=["someone-else"], now=NOW)
    assert review_interview(evaluation(), override(), authorized_reviewers=["rev-9"], now=NOW).reviewer_id == "rev-9"


def test_hr_evaluation_can_be_reviewed_but_not_applied_to_readiness():
    hr_q = next(q for q in default_bank().questions if q.type == "hr")
    ev = evaluate_answer(hr_q, "In my last team project I led the testing effort; the situation was a missed deadline, I organised a plan and we delivered.")
    ev = ev.model_copy(update={"attempt_id": "att-1"})
    assert review_interview(ev, override(reviewed_overall=60), now=NOW).interview_type == "hr"
    with pytest.raises(ValueError, match="technical"):
        submit_interview_review({"profile": {}}, ev.model_dump(), override(reviewed_overall=60), now=NOW)


# ---- final result selection -----------------------------------------------------------------------------------------------------
def test_final_result_uses_human_review_but_keeps_original_visible():
    ev = evaluation()
    assert final_result(ev, None)["source"] == "automated"
    rec = review_interview(ev, override(reviewed_overall=40), now=NOW)
    fr = final_result(ev, rec)
    assert fr["source"] == "human_reviewed" and fr["overall"] == 40 and fr["original_automated"]["overall"] == ev.overall
    other = evaluation(attempt="att-77")
    assert final_result(other, rec)["source"] == "automated"  # a review of another attempt does not apply
    via_api = final_interview_result({"evaluation": ev.model_dump(), "review": rec.model_dump()})
    assert via_api["overall"] == 40
    api_rec = review_evaluation({"evaluation": ev.model_dump(), "override": override(), "now": NOW})
    assert api_rec["status"] == "human_adjusted"


# ---- downstream skill-gap behaviour ---------------------------------------------------------------------------------------------------
def gap(ev, ledger=None):
    p = {"profile": {}, "interview_evaluations": [ev.model_dump()]}
    if ledger:
        p["review_ledger"] = ledger
    return analyze_skill_gap({**p, "role_id": "data_analyst"})


def sql(rep):
    return next(a for a in rep["skills"] if a["skill"] == "SQL")


def test_override_replaces_automated_evidence_downstream_without_double_counting():
    ev = evaluation()
    base = gap(ev)
    assert sql(base)["level"] == "demonstrated" and sql(base)["evidence_sources"] == ["interview_auto"]
    out = submit_interview_review({"profile": {}, "interview_evaluations": [ev.model_dump()]}, ev.model_dump(), override(reviewed_overall=35), now=NOW)
    rep = gap(ev, out["ledger"])
    s = sql(rep)
    assert s["level"] == "verified" and s["evidence_sources"] == ["interview_review"] and s["strength"] == 0.35
    assert s["evidence_state"] == "partially_demonstrated" and s["status"] == "demonstrated_weakness"
    assert any("replaced by a human review" in n for n in rep["notes"])
    assert out["review"]["original_automated_score"] == pytest.approx(ev.overall / 100, abs=1e-6)
    assert out["interview_review"]["original"]["overall"] == ev.overall  # original preserved in both records


def test_invalidated_interview_is_not_counted_at_all_and_is_not_a_weakness():
    ev = evaluation()
    out = submit_interview_review({"profile": {}, "interview_evaluations": [ev.model_dump()]}, ev.model_dump(), override("invalidate"), now=NOW)
    s = sql(gap(ev, out["ledger"]))
    assert s["level"] == "none" and s["credit"] == 0 and s["status"] == "unassessed" and s["evidence_state"] == "not_assessed"
    assert out["review"]["invalidated"] and out["review"]["applied_score"] is None


def test_confirm_keeps_score_and_upgrades_evidence_to_verified():
    ev = evaluation()
    out = submit_interview_review({"profile": {}, "interview_evaluations": [ev.model_dump()]}, ev.model_dump(), override("confirm"), now=NOW, max_readiness_increase=100)
    s = sql(gap(ev, out["ledger"]))
    assert s["level"] == "verified" and s["strength"] == pytest.approx(ev.overall / 100, abs=1e-3)


def test_interview_review_raise_is_capped_like_any_single_review():
    weak = evaluation("They join tables and stuff.", attempt="att-5")
    weak = weak.model_copy(update={"confidence": "medium", "overall": 20.0})
    out = submit_interview_review({"profile": {}, "interview_evaluations": [weak.model_dump()]}, weak.model_dump(),
                                  override(attempt_id="att-5", reviewed_overall=100), max_readiness_increase=3, now=NOW)
    r = out["review"]
    assert r["cap_applied"] and r["original_score"] == 1.0 and r["applied_score"] < 1.0
    assert out["readiness_increase"] <= 3 + 1e-9
    assert out["interview_review"]["reviewed"]["overall"] == 100  # the reviewer's real judgement is stored uncapped


def test_resubmission_duplicate_and_revised_override():
    ev = evaluation()
    pl = {"profile": {}, "interview_evaluations": [ev.model_dump()]}
    a = submit_interview_review(pl, ev.model_dump(), override(reviewed_overall=40), now=NOW, max_readiness_increase=100)
    dup = submit_interview_review(pl, ev.model_dump(), override(reviewed_overall=40), ledger=a["ledger"], now=NOW, max_readiness_increase=100)
    assert dup["status"] == "duplicate" and len(dup["ledger"]["reviews"]) == 1
    dup2 = submit_interview_review(pl, ev.model_dump(), override(review_id="ir-2", reviewed_overall=40), ledger=a["ledger"], now=NOW, max_readiness_increase=100)
    assert dup2["status"] == "duplicate"
    rev = submit_interview_review(pl, ev.model_dump(), override(review_id="ir-3", reviewed_overall=75), ledger=a["ledger"], now=NOW, max_readiness_increase=100)
    assert rev["status"] == "applied" and rev["review"]["supersedes"] == "ir-1"
    states = {r["review_id"]: r["status"] for r in rev["ledger"]["reviews"]}
    assert states == {"ir-1": "superseded", "ir-3": "applied"}
    assert sql(gap(ev, rev["ledger"]))["strength"] == 0.75


def test_audit_trail_records_override_with_reviewer_and_previous_state():
    ev = evaluation()
    pl = {"profile": {}, "interview_evaluations": [ev.model_dump()]}
    out = submit_interview_review(pl, ev.model_dump(), override(reviewed_overall=40), now=NOW)
    events = out["ledger"]["audit"]["events"]
    e = next(x for x in events if x["subject_type"] == "skill_evidence" and x["subject_id"] == "SQL")
    assert e["previous"]["state"] == "demonstrated" and e["new"]["state"] == "partially_demonstrated"
    assert e["source"] == "interview_review" and e["actor"] == "reviewer" and e["actor_id"] == "rev-9" and e["reason"] == "reviewed the transcript"
    assert verify_log(AuditLog(**out["ledger"]["audit"])) == []
    assert not any("rev-9@" in str(x) or ev.evidence and ev.evidence[0].quote in str(x) for x in events)  # no answer text in the log


def test_attempt_less_evaluation_is_matched_by_question():
    ev = evaluation().model_copy(update={"attempt_id": None})
    pl = {"profile": {}, "interview_evaluations": [ev.model_dump()]}
    out = submit_interview_review(pl, ev.model_dump(), override(reviewed_overall=40), now=NOW)
    s = sql(gap(ev, out["ledger"]))
    assert s["evidence_sources"] == ["interview_review"]


def test_override_of_one_attempt_does_not_remove_another_attempt():
    a1, a2 = evaluation(attempt="att-1"), evaluation("Joins combine tables using a matching column.", qid="sql_join_types", attempt="att-2")
    a2 = a2.model_copy(update={"confidence": "medium"})
    pl = {"profile": {}, "interview_evaluations": [a1.model_dump(), a2.model_dump()]}
    out = submit_interview_review(pl, a1.model_dump(), override(attempt_id="att-1", reviewed_overall=40), now=NOW, max_readiness_increase=100)
    rep = analyze_skill_gap({**pl, "role_id": "data_analyst", "review_ledger": out["ledger"]})
    srcs = sql(rep)["evidence_sources"]
    assert "interview_review" in srcs and "interview_auto" in srcs  # att-2 (different attempt id, same question) still counts
