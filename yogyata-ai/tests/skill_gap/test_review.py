"""Human-review ledger: readiness cap, duplicates, validation, supersession, audit trail, downstream consistency."""
import copy
import json

import pytest

from yogyata_ai.common.audit import AuditLog, AuditTamperError, verify_log
from yogyata_ai.common.schemas import StudentProfile
from yogyata_ai.skill_gap import analyze_skill_gap, submit_review
from yogyata_ai.skill_gap.analysis import analyze_gap, readiness_exact
from yogyata_ai.skill_gap.review import ReviewConfig, ReviewLedger, ReviewSubmission, apply_review
from yogyata_ai.skill_gap.roles import default_catalog

NOW = "2026-10-18T10:00:00Z"
PAYLOAD = {"profile": {}}


def sub(rid="r1", score=0.9, skills=("SQL",), item="t1", reviewer="rev1", kind="task", reason="clear, correct work", **kw):
    return {"review_id": rid, "reviewer_id": reviewer, "kind": kind, "item_id": item, "skills": list(skills),
            "score": score, "reason": reason, **kw}


def go(review, ledger=None, payload=PAYLOAD, cap=10.0, **kw):
    return submit_review(payload, review, ledger=ledger, max_readiness_increase=cap, now=NOW, **kw)


def da_ready(ledger, payload=PAYLOAD):
    return analyze_skill_gap({**payload, "role_id": "data_analyst", "review_ledger": ledger})["readiness_score"]


BIG = ("SQL", "Python", "Excel", "Pandas")


# ---- cap ---------------------------------------------------------------------------------------------------------------
def test_small_review_applied_as_submitted_and_originals_preserved():
    o = go(sub(score=0.4, skills=("SQL",)), cap=50)  # SQL weight 5/39 -> +5.1 points at 0.4
    r = o["review"]
    assert o["status"] == "applied" and not r["cap_applied"]
    assert r["original_score"] == r["applied_score"] == 0.4 and r["applied_adjustment"] == 0
    assert r["reason"] == "clear, correct work" and r["reviewer_id"] == "rev1" and r["max_increase_used"] == 50


def test_large_review_is_capped_to_the_configured_maximum_increase():
    o = go(sub(score=1.0, skills=BIG), cap=10)
    r = o["review"]
    assert r["cap_applied"] and r["original_score"] == 1.0 and r["applied_score"] < 1.0
    assert r["applied_adjustment"] == pytest.approx(r["applied_score"] - 1.0)
    assert 0 < o["readiness_increase"] <= 10 and o["readiness_increase"] > 9.9  # uses (nearly) all the allowance
    assert r["readiness_after"] - r["readiness_before"] <= 10 + 1e-9
    assert da_ready(o["ledger"]) <= 10.0 + 0.05


@pytest.mark.parametrize("cap", [0, 2.5, 5, 10, 25, 60, 100])
def test_cap_is_configurable_and_never_exceeded_across_scores(cap):
    prev = 0.0
    for score in [0, 0.1, 0.25, 0.5, 0.6, 0.75, 0.9, 0.999, 1.0]:
        o = go(sub(score=score, skills=BIG), cap=cap)
        assert o["readiness_increase"] <= cap + 1e-9
        applied = o["review"]["applied_score"]
        assert 0 <= applied <= score + 1e-12 and applied >= prev - 1e-12  # monotone in the submitted score
        prev = applied
        for v in o["readiness"].values():
            assert 0 <= v["after"] <= 100


def test_cap_zero_blocks_any_increase_and_cap_100_never_binds():
    z = go(sub(score=1.0, skills=BIG), cap=0)
    assert z["readiness_increase"] == 0 and z["review"]["cap_applied"]
    f = go(sub(score=1.0, skills=BIG), cap=100)
    assert not f["review"]["cap_applied"] and f["review"]["applied_score"] == 1.0


def test_cap_is_checked_across_all_roles_not_just_the_target_role():
    o = go(sub(score=1.0, skills=("Python", "Pandas", "NumPy", "Statistics")), cap=8)
    for role, v in o["readiness"].items():
        assert v["after"] - v["before"] <= 8 + 1e-9, role
    assert o["review"]["binding_role"] in o["readiness"]


def test_review_that_lowers_readiness_is_not_capped():
    first = go(sub("r1", 0.9, BIG, item="t1"), cap=100)
    low = go(sub("r2", 0.1, BIG, item="t1", reason="re-review: weak", supersedes="r1"), ledger=first["ledger"], cap=1)
    assert low["review"]["applied_score"] == 0.1 and not low["review"]["cap_applied"]
    assert da_ready(low["ledger"]) < da_ready(first["ledger"])


def test_zero_score_boundary_is_recorded_as_weak_evidence_not_dropped():
    o = go(sub(score=0.0, skills=("SQL",)))
    rep = analyze_skill_gap({**PAYLOAD, "role_id": "data_analyst", "review_ledger": o["ledger"]})
    sql = next(a for a in rep["skills"] if a["skill"] == "SQL")
    assert sql["level"] == "verified" and sql["status"] == "demonstrated_weakness" and sql["evidence_state"] == "partially_demonstrated"


def test_repeated_reviews_each_capped_but_accumulate_and_stay_in_range():
    lg, ready = None, []
    items = [("SQL", "Excel"), ("Python", "Pandas"), ("Statistics", "Data Visualization"), ("Communication", "NumPy")]
    for i, sk in enumerate(items):
        o = go(sub(f"r{i}", 1.0, sk, item=f"t{i}"), ledger=lg, cap=10)
        assert o["readiness_increase"] <= 10 + 1e-9
        lg = o["ledger"]
        ready.append(da_ready(lg))
    assert ready == sorted(ready) and ready[-1] <= 100 and ready[-1] > ready[0]


def test_many_full_marks_reviews_never_push_readiness_above_100():
    from yogyata_ai.common.taxonomy import get_taxonomy
    names = [s.skill for s in default_catalog().get("data_analyst").skills]
    lg = None
    for i, n in enumerate(names * 2):
        lg = go(sub(f"x{i}", 1.0, (n,), item=f"i{i}", reviewer=f"rv{i}"), ledger=lg, cap=100)["ledger"]
    assert da_ready(lg) <= 100.0


# ---- duplicates / supersession -----------------------------------------------------------------------------------------
def test_resubmitting_same_review_id_is_a_noop_and_does_not_double_apply():
    a = go(sub(score=1.0, skills=BIG))
    b = go(sub(score=1.0, skills=BIG), ledger=a["ledger"])
    assert b["status"] == "duplicate" and not b["applied"] and b["duplicate_of"] == "r1"
    assert b["ledger"] == a["ledger"] and len(b["ledger"]["reviews"]) == 1
    assert da_ready(b["ledger"]) == da_ready(a["ledger"])


def test_same_content_under_new_review_id_is_a_duplicate():
    a = go(sub("r1", 1.0, BIG))
    b = go(sub("r1-retry", 1.0, BIG), ledger=a["ledger"])
    assert b["status"] == "duplicate" and b["duplicate_of"] == "r1" and len(b["ledger"]["reviews"]) == 1


def test_duplicate_detection_ignores_skill_order_and_reason_text():
    a = go(sub("r1", 0.8, ("SQL", "Excel")))
    b = go(sub("r9", 0.8, ("Excel", "SQL"), reason="a different sentence"), ledger=a["ledger"])
    assert b["status"] == "duplicate"


def test_review_id_reuse_with_different_content_is_rejected():
    a = go(sub("r1", 0.8))
    with pytest.raises(ValueError, match="already used"):
        go(sub("r1", 0.3), ledger=a["ledger"])


def test_same_reviewer_same_item_new_score_requires_supersedes():
    a = go(sub("r1", 0.8))
    with pytest.raises(ValueError, match="supersedes"):
        go(sub("r2", 0.3), ledger=a["ledger"])


def test_supersede_replaces_effect_keeps_history_and_does_not_double_count():
    a = go(sub("r1", 0.5, ("SQL",)), cap=100)
    b = go(sub("r2", 0.9, ("SQL",), reason="after resubmission", supersedes="r1"), ledger=a["ledger"], cap=100)
    revs = {r["review_id"]: r for r in b["ledger"]["reviews"]}
    assert revs["r1"]["status"] == "superseded" and revs["r1"]["superseded_by"] == "r2" and revs["r2"]["supersedes"] == "r1"
    only = go(sub("rx", 0.9, ("SQL",)), cap=100)
    assert da_ready(b["ledger"]) == da_ready(only["ledger"])  # same as if only the new review existed
    rep = analyze_skill_gap({**PAYLOAD, "role_id": "data_analyst", "review_ledger": b["ledger"]})
    assert next(x for x in rep["skills"] if x["skill"] == "SQL")["strength"] == 0.9


def test_supersede_cap_applies_to_the_net_change():
    a = go(sub("r1", 0.2, BIG), cap=100)
    b = go(sub("r2", 1.0, BIG, supersedes="r1"), ledger=a["ledger"], cap=6)
    assert b["readiness_increase"] <= 6 + 1e-9 and b["review"]["cap_applied"]


@pytest.mark.parametrize("bad", ["nope", "r2"])
def test_supersede_must_reference_an_active_review(bad):
    a = go(sub("r1", 0.5))
    b = go(sub("r2", 0.6, supersedes="r1"), ledger=a["ledger"])
    with pytest.raises(ValueError):
        go(sub("r3", 0.7, supersedes="nope" if bad == "nope" else "r1"), ledger=b["ledger"])


def test_only_original_reviewer_can_supersede_and_other_reviewers_are_independent():
    a = go(sub("r1", 0.5))
    with pytest.raises(ValueError, match="original reviewer"):
        go(sub("r2", 0.6, reviewer="rev2", supersedes="r1"), ledger=a["ledger"])
    ok = go(sub("r3", 0.7, reviewer="rev2"), ledger=a["ledger"])  # independent second opinion on the same item
    assert ok["status"] == "applied" and len(ok["ledger"]["reviews"]) == 2


# ---- validation -------------------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("score", [-0.01, 1.01, float("nan"), float("inf"), "0.5", True, None, 7])
def test_invalid_scores_rejected(score):
    with pytest.raises(Exception):
        go(sub(score=score))


@pytest.mark.parametrize("field", ["review_id", "reviewer_id", "kind", "item_id", "skills", "score", "reason"])
def test_required_fields(field):
    s = sub()
    del s[field]
    with pytest.raises(Exception):
        go(s)


@pytest.mark.parametrize("patch", [
    {"reason": ""}, {"reason": "  "}, {"reason": "ok"}, {"skills": []}, {"skills": ["Underwater Basket Weaving"]},
    {"review_id": "bad id"}, {"reviewer_id": ""}, {"kind": "essay"}, {"reviewed_at": "last week"},
    {"reviewed_at": "2031-01-01"}, {"extra_field": 1}, {"original_automated_score": 2},
])
def test_invalid_fields_rejected(patch):
    with pytest.raises(Exception):
        go({**sub(), **patch})


def test_reviewer_allow_list_enforced_when_configured():
    with pytest.raises(PermissionError):
        go(sub(reviewer="intruder"), authorized_reviewers=["rev1"])
    assert go(sub(reviewer="rev1"), authorized_reviewers=["rev1"])["status"] == "applied"


def test_config_validation_and_env(monkeypatch):
    for bad in (-1, 101, float("nan"), "5", True):
        with pytest.raises(ValueError):
            ReviewConfig(max_readiness_increase=bad)
    monkeypatch.setenv("YOGYATA_MAX_READINESS_INCREASE_PER_REVIEW", "4")
    monkeypatch.setenv("YOGYATA_AUTHORIZED_REVIEWERS", "a, b")
    c = ReviewConfig.from_env()
    assert c.max_readiness_increase == 4 and c.authorized_reviewers == frozenset({"a", "b"})
    monkeypatch.setenv("YOGYATA_MAX_READINESS_INCREASE_PER_REVIEW", "garbage")
    monkeypatch.delenv("YOGYATA_AUTHORIZED_REVIEWERS")
    assert ReviewConfig.from_env().max_readiness_increase == 10.0
    monkeypatch.delenv("YOGYATA_MAX_READINESS_INCREASE_PER_REVIEW")
    o = submit_review(PAYLOAD, sub(score=1.0, skills=BIG), now=NOW)  # default cap = 10
    assert o["cap"] == 10.0


def test_reason_is_scrubbed_of_contact_details():
    o = go(sub(reason="Call me at priya@example.com or +91 98765 43210 if unsure"))
    assert "@" not in o["review"]["reason"] and "98765" not in o["review"]["reason"]


# ---- audit trail ---------------------------------------------------------------------------------------------------------
def test_audit_events_for_state_change_and_readiness_review():
    o = go(sub(score=0.9, skills=("SQL",)), cap=100)
    ev = o["ledger"]["audit"]["events"]
    skill_ev = next(e for e in ev if e["subject_type"] == "skill_evidence")
    assert (skill_ev["subject_id"], skill_ev["previous"]["state"], skill_ev["new"]["state"], skill_ev["new"]["score"]) == ("SQL", "not_assessed", "demonstrated", 0.9)
    assert skill_ev["source"] == "task_review" and skill_ev["actor"] == "reviewer" and skill_ev["actor_id"] == "rev1"
    assert skill_ev["timestamp"].startswith("2026-10-18T10:00:00") and skill_ev["reason"] == "clear, correct work"
    rr = ev[-1]
    assert rr["subject_type"] == "readiness_review" and rr["subject_id"] == "r1" and rr["new"]["state"] == "applied"
    assert verify_log(AuditLog(**o["ledger"]["audit"])) == []


def test_capped_review_audit_mentions_cap_and_original_score():
    o = go(sub(score=1.0, skills=BIG), cap=10)
    last = o["ledger"]["audit"]["events"][-1]
    assert last["new"]["state"] == "capped" and "capped" in last["reason"] and "1.000" in last["reason"]


def test_duplicate_adds_no_audit_events_and_ledger_input_is_not_mutated():
    a = go(sub())
    snap = copy.deepcopy(a["ledger"])
    lg = ReviewLedger(**a["ledger"])
    b = apply_review(PAYLOAD, sub(), lg, config=ReviewConfig(), now=NOW)
    assert b["status"] == "duplicate" and lg.model_dump(mode="json") == snap
    c = apply_review(PAYLOAD, sub("r2", 0.5, ("Excel",), item="t2"), lg, config=ReviewConfig(), now=NOW)
    assert lg.model_dump(mode="json") == snap and len(c["ledger"].audit.events) > len(lg.audit.events)
    assert c["ledger"].audit.events[:len(lg.audit.events)] == lg.audit.events


def test_tampered_audit_log_is_refused_for_new_reviews_and_analysis():
    a = go(sub())
    bad = copy.deepcopy(a["ledger"])
    bad["audit"]["events"][0]["new"]["score"] = 0.01
    with pytest.raises(AuditTamperError):
        go(sub("r2", 0.4, ("Excel",), item="t2"), ledger=bad)
    with pytest.raises(AuditTamperError):
        analyze_skill_gap({**PAYLOAD, "role_id": "data_analyst", "review_ledger": bad})


def test_ledger_roundtrips_through_json():
    a = go(sub(score=1.0, skills=BIG))
    again = json.loads(json.dumps(a["ledger"]))
    b = go(sub("r2", 0.5, ("Excel",), item="t2"), ledger=again)
    assert len(b["ledger"]["reviews"]) == 2 and verify_log(AuditLog(**b["ledger"]["audit"])) == []


# ---- downstream consistency --------------------------------------------------------------------------------------------------------
def test_gap_report_uses_applied_strength_and_marks_reviewed_evidence_verified():
    o = go(sub(score=1.0, skills=BIG), cap=10)
    applied = o["review"]["applied_score"]
    rep = analyze_skill_gap({**PAYLOAD, "role_id": "data_analyst", "review_ledger": o["ledger"]})
    sql = next(a for a in rep["skills"] if a["skill"] == "SQL")
    assert sql["level"] == "verified" and sql["strength"] == applied and "task_review" in sql["evidence_sources"]
    assert rep["verified_coverage"] > 0 and any("capped" in n for n in rep["notes"])
    assert sql["last_assessed_at"] == "2026-10-18T10:00:00+00:00"


def test_readiness_exact_matches_report_rounding_and_range():
    cat = default_catalog()
    for payload in ({}, {"declared_skills": ["SQL", "Python"]}):
        p = StudentProfile(**payload)
        for role in cat.roles.values():
            x = readiness_exact(p, role)
            assert 0 <= x <= 100 and round(x, 1) == analyze_gap(p, role).readiness_score


def test_review_on_skill_with_no_prior_evidence_and_with_failed_attempt():
    pl = {"profile": {"assessment_attempts": [{"skill": "SQL", "kind": "task"}]}}
    o = go(sub(score=0.8), payload=pl, cap=100)
    rep = analyze_skill_gap({**pl, "role_id": "data_analyst", "review_ledger": o["ledger"]})
    assert next(a for a in rep["skills"] if a["skill"] == "SQL")["evidence_state"] == "demonstrated"
    ev0 = [e for e in o["ledger"]["audit"]["events"] if e["subject_type"] == "skill_evidence"][0]
    assert ev0["previous"]["state"] == "missing_evidence"


def test_review_ledger_does_not_change_other_modules_defaults():
    base = analyze_skill_gap({**PAYLOAD, "role_id": "data_analyst"})
    same = analyze_skill_gap({**PAYLOAD, "role_id": "data_analyst", "review_ledger": ReviewLedger().model_dump()})
    assert base == same


def test_roadmap_removes_skill_after_uncapped_review_and_keeps_it_when_capped_low():
    from yogyata_ai.roadmap import generate_roadmap
    big = go(sub(score=0.95, skills=("SQL",)), cap=100)
    capped = go(sub(score=0.95, skills=("SQL",)), cap=1)
    p = {"profile": {"weekly_hours": 20, "timeline_weeks": 30}, "role_id": "data_analyst"}
    r_big = generate_roadmap({**p, "review_ledger": big["ledger"]})
    r_cap = generate_roadmap({**p, "review_ledger": capped["ledger"]})
    assert all(i["skill"] != "SQL" for i in r_big["items"] if i["type"] != "project")
    assert any(i["skill"] == "SQL" for i in r_cap["items"])


# ---- cap semantics: never mislabel, never ramp ---------------------------------------------------------------------------------
def test_cap_limited_review_is_not_reported_as_a_weakness():
    o = go(sub(score=0.9, skills=BIG), cap=3)
    rep = analyze_skill_gap({**PAYLOAD, "role_id": "data_analyst", "review_ledger": o["ledger"]})
    sql = next(a for a in rep["skills"] if a["skill"] == "SQL")
    assert o["review"]["applied_score"] < 0.4 and o["review"]["cap_applied"]
    assert sql["status"] == "developing" and sql["evidence_state"] == "partially_demonstrated"
    assert "SQL" not in rep["demonstrated_weaknesses"]
    assert any("limited by the per-review readiness cap" in n for n in sql["evidence_notes"])


def test_genuinely_weak_review_is_still_a_weakness():
    o = go(sub(score=0.1, skills=("SQL",)), cap=100)
    rep = analyze_skill_gap({**PAYLOAD, "role_id": "data_analyst", "review_ledger": o["ledger"]})
    assert "SQL" in rep["demonstrated_weaknesses"]


def test_revision_chain_cannot_ramp_readiness_beyond_one_cap():
    lg, prev = None, "none"
    for i, score in enumerate([0.2, 1.0, 0.99, 0.98, 0.97]):
        s = sub(f"r{i}", score, BIG)
        if prev != "none":
            s["supersedes"] = prev
        o = go(s, ledger=lg, cap=10)
        lg, prev = o["ledger"], f"r{i}"
        assert da_ready(lg) <= 10.0 + 0.05, (i, da_ready(lg))
    assert [r["status"] for r in lg["reviews"]] == ["superseded"] * 4 + ["applied"]


def test_resending_the_same_score_as_a_revision_is_a_duplicate():
    a = go(sub("r1", 1.0, BIG), cap=10)
    b = go(sub("r2", 1.0, BIG, supersedes="r1"), ledger=a["ledger"], cap=10)
    assert b["status"] == "duplicate" and len(b["ledger"]["reviews"]) == 1


def test_downward_revision_of_a_capped_review_is_not_cut_further():
    a = go(sub("r1", 1.0, BIG), cap=10)
    capped = a["review"]["applied_score"]
    b = go(sub("r2", 0.9, BIG, supersedes="r1"), ledger=a["ledger"], cap=10)
    assert b["review"]["applied_score"] >= min(0.9, capped) - 1e-9 and b["review"]["applied_score"] <= 0.9
    c = go(sub("r3", 0.1, BIG, supersedes="r2"), ledger=b["ledger"], cap=10)
    assert c["review"]["applied_score"] == 0.1 and not c["review"]["cap_applied"]


def test_invalidate_requires_interview_kind_and_no_score():
    with pytest.raises(Exception):
        go({**sub(), "invalidate": True, "score": None})        # task reviews cannot be invalidated
    with pytest.raises(Exception):
        go({**sub(kind="interview"), "invalidate": True})       # score must be omitted
