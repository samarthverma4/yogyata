import json

import pytest

from yogyata_ai.university_analytics import cohort_analytics


def rec(dept="CSE", n=1, sql=None, placed=None, year=2027, role="data_analyst", source="interview_auto", sid=None):
    out = []
    for i in range(n):
        ev = [] if sql is None else [{"skill": "SQL", "source": source, "strength": sql, "ref_id": f"{dept}{i}"}]
        prof = {"evidence": ev}
        if sid:
            prof["student_id"] = f"{sid}-{dept}-{i}"
        out.append({"department": dept, "graduation_year": year, "target_role": role, "profile": prof, "placed": placed})
    return out


def test_group_stats_released_for_large_groups_only():
    r = cohort_analytics(rec("CSE", 12, sql=0.2) + rec("ECE", 11, sql=0.9) + rec("MECH", 3, sql=0.9))
    labels = [g["label"] for g in r["groups"]]
    assert labels == ["CSE", "ECE"] and r["pooled"] is None or r["pooled"]["n"] >= 10


def test_small_groups_pooled_and_pool_reaches_k_by_complementary_suppression():
    r = cohort_analytics(rec("CSE", 30, sql=0.2) + rec("ECE", 14, sql=0.5) + rec("MECH", 4) + rec("CIVIL", 3))
    assert [g["label"] for g in r["groups"]] == ["CSE"]
    assert r["pooled"]["n"] == 21 and set(r["pooled"]["members"]) == {"MECH", "CIVIL", "ECE"}
    assert any("subtraction" in n for n in r["suppression_notes"])
    assert all(g["n"] >= 10 for g in r["groups"])


def test_pooled_small_groups_that_reach_k_need_no_extra_group():
    r = cohort_analytics(rec("CSE", 30, sql=0.2) + rec("MECH", 6) + rec("CIVIL", 6))
    assert r["pooled"]["n"] == 12 and set(r["pooled"]["members"]) == {"MECH", "CIVIL"}


def test_everything_below_k_releases_nothing():
    r = cohort_analytics(rec("CSE", 4) + rec("ECE", 3))
    assert r["overall"] is None and r["groups"] == [] and r["pooled"] is None
    assert any("fewer than" in n for n in r["suppression_notes"])


def test_all_small_groups_but_enough_total_gives_overall_and_pool_only():
    r = cohort_analytics(sum((rec(f"D{i}", 3, sql=0.5) for i in range(5)), []))
    assert r["groups"] == [] and r["pooled"]["n"] == 15 and r["overall"]["n"] == 15


def test_k_floor_enforced_and_group_by_validated():
    with pytest.raises(ValueError, match="at least"):
        cohort_analytics(rec(n=10), k=2)
    with pytest.raises(ValueError, match="group_by"):
        cohort_analytics(rec(n=10), group_by="gender")


def test_no_identifiers_in_output():
    r = cohort_analytics(rec("CSE", 15, sql=0.3, sid="SECRET"))
    assert "SECRET" not in json.dumps(r)


def test_identifying_fields_rejected_not_accepted():
    bad = rec("CSE", 15, sql=0.3)
    for b in bad[:3]:
        b["name"] = "Asha Rao"
    r = cohort_analytics(bad)
    assert r["skipped_records"] == 3 and any("rejected" in w for w in r["warnings"]) and r["overall"]["n"] == 12


def test_unassessed_is_not_reported_as_weakness():
    r = cohort_analytics(rec("CSE", 20))
    g = r["groups"][0]
    assert g["top_gaps"] == [] and g["skill_rows"] == [] and g["evidence_sufficiency_share"]["low"] == 1.0


def test_planted_weakness_recovered_with_correct_shares():
    r = cohort_analytics(rec("CSE", 10, sql=0.2) + rec("CSE", 10, sql=0.9))
    row = next(s for s in r["groups"][0]["skill_rows"] if s["skill"] == "SQL")
    assert row["assessed_n"] == 20 and row["weakness_share_of_assessed"] == 0.5 and row["met_share_of_assessed"] == 0.5
    assert r["groups"][0]["top_gaps"][0] == "SQL"


def test_skill_rate_withheld_when_fewer_than_k_assessed():
    r = cohort_analytics(rec("CSE", 8, sql=0.2) + rec("CSE", 12))
    assert r["groups"][0]["n"] == 20 and not any(s["skill"] == "SQL" for s in r["groups"][0]["skill_rows"])


def test_placement_uses_known_outcomes_only_and_is_suppressed_when_few():
    r = cohort_analytics(rec("CSE", 8, placed=True) + rec("CSE", 8, placed=False) + rec("CSE", 8, placed=None))
    p = r["groups"][0]["placement"]
    assert p["known_outcome_n"] == 16 and p["placed_share_of_known"] == 0.5 and "not a prediction" in p["note"]
    r2 = cohort_analytics(rec("CSE", 3, placed=True) + rec("CSE", 20))
    assert "suppressed" in r2["groups"][0]["placement"]


def test_records_without_role_skipped_and_reported():
    r = cohort_analytics(rec("CSE", 12, sql=0.2) + rec("CSE", 3, role=None) , default_role_id=None)
    assert r["skipped_records"] == 3 and r["overall"]["n"] == 12
    r2 = cohort_analytics(rec("CSE", 12, role=None), default_role_id="data_analyst")
    assert r2["overall"]["n"] == 12


def test_group_by_other_dimensions():
    r = cohort_analytics(rec("CSE", 12, year=2026) + rec("CSE", 12, year=2027), group_by="graduation_year")
    assert [g["label"] for g in r["groups"]] == ["2026", "2027"]


def test_interpretation_caveats_present_and_no_prediction_language():
    r = cohort_analytics(rec("CSE", 12))
    text = " ".join(r["interpretation"]).lower()
    assert "not poor performance" in text and "guarantees" in text
    assert "will be placed" not in json.dumps(r).lower()


def test_deterministic():
    d = rec("CSE", 12, sql=0.3) + rec("ECE", 11, sql=0.7)
    assert cohort_analytics(d) == cohort_analytics(d)
