"""Regression tests for strict weekly scheduling, prerequisites, deadlines, availability changes and bad inputs."""
import math
import random

import pytest

from yogyata_ai.roadmap import generate_roadmap, update_roadmap
from yogyata_ai.roadmap.scheduler import Task, check_schedule_integrity, schedule, schedule_complete_only, validate_capacities


def plan(role="data_analyst", weekly=8, weeks=8, **kw):
    profile = {"weekly_hours": weekly, **({"timeline_weeks": weeks} if weeks else {}), **kw.pop("profile", {})}
    return generate_roadmap({"profile": profile, "role_id": role, **kw})


def week_load(r):
    """Hours per week recomputed ONLY from per-item allocations (independent of weekly_schedule)."""
    load = {}
    for it in r["items"]:
        for a in it["allocations"]:
            load[a["week"]] = load.get(a["week"], 0) + a["hours"]
    return load


# ---- the reported failure -----------------------------------------------------------------------------------------
def test_default_data_analyst_never_exceeds_8_hours_in_any_week():
    r = plan()
    load = week_load(r)
    assert load and max(load.values()) <= 8 + 1e-9
    assert all(w["allocated_hours"] <= 8 + 1e-9 for w in r["weekly_schedule"])
    assert r["schedule"]["capacity_respected"] and r["schedule"]["peak_week_hours"] <= 8


def test_week_2_is_not_overloaded_like_the_old_11_5_hour_estimate():
    r = plan()
    w2 = next(w for w in r["weekly_schedule"] if w["week"] == 2)
    assert w2["allocated_hours"] <= 8 and w2["capacity_hours"] == 8
    # an even spread of each item over its start..end weeks is what produced 11.5h; allocations make that unnecessary
    naive = {}
    for it in r["items"]:
        span = it["end_week"] - it["start_week"] + 1
        for w in range(it["start_week"], it["end_week"] + 1):
            naive[w] = naive.get(w, 0) + it["hours"] / span
    assert max(week_load(r).values()) <= 8 and week_load(r)[2] <= 8


@pytest.mark.parametrize("weekly,weeks", [(1, 30), (2.5, 20), (5, 10), (8, 8), (8, 20), (12, 6), (40, 3)])
@pytest.mark.parametrize("role", ["data_analyst", "ml_engineer", "full_stack_developer"])
def test_weekly_budget_never_violated(role, weekly, weeks):
    r = plan(role, weekly, weeks)
    assert max(week_load(r).values(), default=0) <= weekly + 1e-9
    assert r["schedule"]["capacity_respected"]


def test_item_allocations_sum_to_remaining_hours_and_match_weekly_schedule():
    r = plan()
    for it in r["items"]:
        assert sum(a["hours"] for a in it["allocations"]) == pytest.approx(it["hours_remaining"])
        assert [a["week"] for a in it["allocations"]][0] == it["start_week"] and it["allocations"][-1]["week"] == it["end_week"]
    ws = {w["week"]: w["allocated_hours"] for w in r["weekly_schedule"]}
    assert ws == {w: pytest.approx(h) for w, h in {**{k: 0 for k in ws}, **week_load(r)}.items()}
    assert r["total_hours"] == pytest.approx(sum(ws.values()))


def test_no_item_is_partially_scheduled_then_abandoned():
    r = plan(weekly=3, weeks=4)
    scheduled = {i["activity_id"] for i in r["items"]}
    for d in r["deferred"]:
        assert d["activity_id"] not in scheduled
    assert sum(w["allocated_hours"] for w in r["weekly_schedule"]) == pytest.approx(sum(i["hours_remaining"] for i in r["items"]))


# ---- prerequisites ------------------------------------------------------------------------------------------------
def first_week(it):
    return it["allocations"][0]["week"]


def test_activity_chain_and_prerequisite_skills_are_ordered_in_time():
    r = plan("ml_engineer", 20, 26)
    by = {i["activity_id"]: i for i in r["items"]}
    for chain in (("learn_python", "practice_python", "assess_python"), ("learn_machine_learning", "practice_machine_learning", "assess_machine_learning")):
        for a, b in zip(chain, chain[1:]):
            if a in by and b in by:
                assert by[a]["end_week"] <= first_week(by[b])
    last_python = max(i["end_week"] for i in r["items"] if i["skill"] == "Python" and i["type"] != "project")
    first_ml = min(first_week(i) for i in r["items"] if i["skill"] == "Machine Learning" and i["type"] != "project")
    assert last_python <= first_ml


def test_same_week_dependency_allocates_prerequisite_first():
    res = schedule([Task("a", 3), Task("b", 3, ["a"])], [8])
    assert res.finish_week == {"a": 1, "b": 1}
    assert [h for _, h in res.allocations["a"]] == [3.0] and [h for _, h in res.allocations["b"]] == [3.0]
    assert check_schedule_integrity([Task("a", 3), Task("b", 3, ["a"])], [8], res) == []


def test_dependent_never_scheduled_when_prerequisite_deferred():
    r = plan("ml_engineer", 4, 5)
    sched = {i["skill"] for i in r["items"] if i["type"] != "project"}
    assert "Machine Learning" not in sched and "scikit-learn" not in sched
    assert any(d["skill"] == "Machine Learning" for d in r["deferred"])


def test_completed_prerequisite_unblocks_dependents():
    done = ["learn_python", "practice_python", "assess_python", "interview_python"]
    base = plan("ml_engineer", 20, 26)
    after = plan("ml_engineer", 20, 26, profile={"completed_activity_ids": done})
    assert all(i["activity_id"] not in done for i in after["items"])
    assert after["total_hours"] < base["total_hours"]


# ---- deadlines ---------------------------------------------------------------------------------------------------------
def test_deadline_conflict_is_reported_honestly_not_hidden():
    r = plan(weeks=None, start_date="2026-11-02", target_date="2026-11-30", weekly=8)
    assert r["schedule"]["horizon_weeks"] == 4 and r["schedule"]["horizon_source"] == "target_date"
    assert r["schedule"]["deadline_met"] is False and r["schedule"]["unscheduled_hours"] > 0
    c = r["conflicts"][0]
    assert c["type"] == "deadline_conflict" and "2026-11-30" in c["message"] and c["unscheduled_hours"] > 0
    assert any("extend the timeline" in o for o in c["options"]) and any("increase availability" in o for o in c["options"])
    assert max(week_load(r).values()) <= 8
    assert r["schedule"]["projected_completion_week"] > 4
    assert r["schedule"]["projected_completion_date"] > __import__("datetime").date(2026, 11, 30).isoformat()


def test_deadline_met_when_enough_time():
    r = plan(weeks=None, start_date="2026-11-02", target_date="2027-06-30", weekly=8)
    assert r["schedule"]["deadline_met"] is True and r["conflicts"] == [] and r["deferred"] == []
    last = r["weekly_schedule"][-1]
    assert last["end_date"] is not None


def test_weekly_schedule_has_dates():
    r = plan(start_date="2026-11-02")
    assert r["weekly_schedule"][0]["start_date"] == "2026-11-02" and r["weekly_schedule"][0]["end_date"] == "2026-11-08"
    assert r["weekly_schedule"][1]["start_date"] == "2026-11-09"


def test_target_date_with_timeline_uses_the_tighter_limit():
    r = plan(weeks=3, start_date="2026-11-02", target_date="2027-03-01")
    assert r["schedule"]["horizon_weeks"] == 3 and r["schedule"]["horizon_source"] == "target_date_and_timeline_weeks"


@pytest.mark.parametrize("kw,msg", [
    ({"target_date": "2026-12-01"}, "start_date is required"),
    ({"start_date": "2026-12-01", "target_date": "2026-12-01"}, "after start_date"),
    ({"start_date": "2026-12-01", "target_date": "2026-11-01"}, "after start_date"),
])
def test_invalid_dates(kw, msg):
    with pytest.raises(ValueError, match=msg):
        plan(**kw)


def test_unparseable_date_rejected():
    with pytest.raises(Exception):
        plan(start_date="not-a-date", target_date="2026-12-01")


def test_time_budget_conflict_without_target_date():
    r = plan(weekly=2, weeks=3)
    assert r["conflicts"][0]["type"] == "time_budget_conflict" and r["schedule"]["deadline_met"] is None


# ---- availability ---------------------------------------------------------------------------------------------------------
def test_per_week_availability_is_respected_including_zero_weeks():
    r = plan(weeks=8, availability_by_week={1: 2, 2: 0, 3: 12})
    caps = {w["week"]: w["capacity_hours"] for w in r["weekly_schedule"]}
    assert caps[1] == 2 and caps[2] == 0 and caps[3] == 12 and caps[4] == 8
    load = week_load(r)
    assert load.get(2, 0) == 0 and load[1] <= 2 and load[3] <= 12 and all(load[w] <= caps[w] + 1e-9 for w in load)


@pytest.mark.parametrize("bad", [{1: -1}, {1: 169}, {1: float("nan")}, {1: "lots"}, {0: 4}, {"x": 4}])
def test_invalid_availability_rejected(bad):
    with pytest.raises((ValueError, Exception)):
        plan(availability_by_week=bad)


def test_availability_beyond_horizon_ignored_with_note():
    r = plan(weeks=4, availability_by_week={9: 20})
    assert any("beyond" in n for n in r["notes"]) and r["constraints"]["availability_by_week"] == {}


def test_zero_weekly_hours_everywhere_defers_everything_without_error():
    r = plan(weeks=4, availability_by_week={1: 0, 2: 0, 3: 0, 4: 0})
    assert r["items"] == [] and r["deferred"] and r["conflicts"]


def test_invalid_weekly_hours_rejected():
    with pytest.raises(Exception):
        plan(weekly=0)
    with pytest.raises(Exception):
        plan(weekly=-3)


# ---- in-progress / completed / updates ---------------------------------------------------------------------------------------
def test_in_progress_hours_are_not_rescheduled():
    full = plan(weekly=20, weeks=30)
    first = full["items"][0]
    part = generate_roadmap({"profile": {"weekly_hours": 20, "timeline_weeks": 30}, "role_id": "data_analyst",
                             "in_progress": {first["activity_id"]: min(1.0, first["hours"] / 2)}})
    it = next(i for i in part["items"] if i["activity_id"] == first["activity_id"])
    assert it["hours_done"] > 0 and it["hours_remaining"] == pytest.approx(first["hours"] - it["hours_done"])
    assert sum(a["hours"] for a in it["allocations"]) == pytest.approx(it["hours_remaining"])
    assert part["total_hours"] == pytest.approx(full["total_hours"] - it["hours_done"])


def test_in_progress_at_or_over_duration_is_treated_as_complete_with_note():
    first = plan(weekly=20, weeks=30)["items"][0]
    r = generate_roadmap({"profile": {"weekly_hours": 20, "timeline_weeks": 30}, "role_id": "data_analyst",
                          "in_progress": {first["activity_id"]: first["hours"] + 5}})
    assert all(i["activity_id"] != first["activity_id"] for i in r["items"])
    assert any("treated as complete" in n for n in r["notes"])


def test_in_progress_bad_values_and_unknown_ids():
    for bad in (-1, float("nan"), "x"):
        with pytest.raises(Exception):
            generate_roadmap({"profile": {}, "role_id": "data_analyst", "in_progress": {"learn_sql": bad}})
    r = generate_roadmap({"profile": {}, "role_id": "data_analyst", "in_progress": {"ghost": 2}})
    assert any("unknown activity 'ghost'" in n for n in r["notes"])


def test_update_after_completion_reduces_remaining_work_and_never_exceeds_limit():
    p = {"profile": {"weekly_hours": 8, "timeline_weeks": 8}, "role_id": "data_analyst"}
    first_two = [i["activity_id"] for i in generate_roadmap(p)["items"][:2]]
    u = update_roadmap(p, completed_activity_ids=first_two)
    assert u["diff"]["schedule"]["remaining_hours"][1] > 0
    assert max(week_load(u["after"]).values()) <= 8
    assert all(a not in [i["activity_id"] for i in u["after"]["items"]] for a in first_two)
    assert u["diff"]["schedule"]["unscheduled_hours"][1] <= u["diff"]["schedule"]["unscheduled_hours"][0]
    assert u["diff"]["moved"]  # later items shift earlier


def test_update_reduced_availability_defers_more_and_raises_conflict():
    p = {"profile": {"weekly_hours": 8, "timeline_weeks": 8}, "role_id": "data_analyst"}
    u = update_roadmap(p, weekly_hours=4)
    assert u["after"]["total_hours"] < u["before"]["total_hours"]
    assert u["diff"]["schedule"]["unscheduled_hours"][1] > u["diff"]["schedule"]["unscheduled_hours"][0]
    assert max(week_load(u["after"]).values()) <= 4
    assert any(r["reason"].startswith("deferred") for r in u["diff"]["removed"])


def test_update_increased_availability_resolves_conflict():
    p = {"profile": {"weekly_hours": 4, "timeline_weeks": 6}, "role_id": "data_analyst"}
    u = update_roadmap(p, weekly_hours=30)
    assert u["diff"]["schedule"]["conflicts"][0] >= 1 and u["diff"]["schedule"]["unscheduled_hours"][1] < u["diff"]["schedule"]["unscheduled_hours"][0]
    assert max(week_load(u["after"]).values()) <= 30


def test_update_with_one_week_holiday():
    p = {"profile": {"weekly_hours": 8, "timeline_weeks": 8}, "role_id": "data_analyst"}
    u = update_roadmap(p, availability_by_week={3: 0})
    assert week_load(u["after"]).get(3, 0) == 0 and u["diff"]["moved"]


def test_update_with_in_progress_and_new_start_date():
    p = {"profile": {"weekly_hours": 8, "timeline_weeks": 8}, "role_id": "data_analyst", "start_date": "2026-11-02"}
    first = generate_roadmap(p)["items"][0]
    u = update_roadmap(p, in_progress={first["activity_id"]: 0.5}, start_date="2026-11-16")
    assert u["after"]["weekly_schedule"][0]["start_date"] == "2026-11-16"
    assert u["after"]["total_hours"] <= u["before"]["total_hours"]


def test_update_rejects_invalid_values():
    p = {"profile": {}, "role_id": "data_analyst"}
    with pytest.raises(Exception):
        update_roadmap(p, availability_by_week={1: -5})
    with pytest.raises(Exception):
        update_roadmap(p, in_progress={"learn_sql": -1})


def test_max_items_still_respected_with_schedule():
    r = generate_roadmap({"profile": {"weekly_hours": 20, "timeline_weeks": 26}, "role_id": "data_analyst", "max_items": 3})
    assert len(r["items"]) == 3 and max(week_load(r).values()) <= 20


# ---- generic scheduler: edge cases ---------------------------------------------------------------------------------------------
@pytest.mark.parametrize("bad", [None, 0, -2, float("nan"), float("inf"), "3", True])
def test_missing_or_invalid_duration_is_reported_and_blocks_dependents(bad):
    tasks = [Task("x", bad), Task("y", 2, ["x"]), Task("z", 2)]
    res, dropped = schedule_complete_only(tasks, [8, 8])
    assert "x" in dropped and "y" in dropped and "z" in res.finish_week
    assert any("invalid duration" in i for i in res.issues)
    assert "blocked" in dropped["y"]


def test_cycle_unknown_dependency_duplicates_self_dependency():
    with pytest.raises(ValueError, match="cycle"):
        schedule([Task("a", 1, ["b"]), Task("b", 1, ["a"])], [8])
    with pytest.raises(ValueError, match="unknown task"):
        schedule([Task("a", 1, ["zzz"])], [8])
    with pytest.raises(ValueError, match="duplicate"):
        schedule([Task("a", 1), Task("a", 2)], [8])
    with pytest.raises(ValueError, match="itself"):
        schedule([Task("a", 1, ["a"])], [8])


@pytest.mark.parametrize("caps", [[-1], [float("nan")], [200], ["8"], [True]])
def test_invalid_capacities(caps):
    with pytest.raises(ValueError, match="invalid available hours"):
        validate_capacities(caps)


def test_task_split_across_weeks_and_exact_fit():
    res = schedule([Task("a", 10)], [8, 8])
    assert res.allocations["a"] == [(1, 8.0), (2, 2.0)] and res.finish_week == {"a": 2}
    exact = schedule([Task("a", 8), Task("b", 8)], [8, 8])
    assert exact.finish_week == {"a": 1, "b": 2}


def test_tasks_that_do_not_fit_are_reported_with_partial_hours():
    res = schedule([Task("a", 5), Task("b", 9)], [8])
    assert "b" in res.unscheduled and res.partial_hours["b"] == 3.0 and "only 3h" in res.unscheduled["b"]


def test_completed_dependencies_count_as_satisfied():
    res = schedule([Task("b", 2, ["a"])], [4], completed={"a"})
    assert res.finish_week == {"b": 1}


def test_integrity_checker_detects_tampering():
    tasks = [Task("a", 4), Task("b", 4, ["a"])]
    res = schedule(tasks, [8])
    assert check_schedule_integrity(tasks, [8], res) == []
    res.allocations["b"] = [(1, 6.0)]
    assert any("allocated" in v for v in check_schedule_integrity(tasks, [8], res))
    res2 = schedule(tasks, [3, 8])
    res2.allocations["a"] = [(1, 3.0), (2, 1.0)]
    res2.allocations["b"] = [(1, 4.0)]
    res2.finish_week = {"a": 2, "b": 1}
    assert any("before prerequisite" in v for v in check_schedule_integrity(tasks, [3, 8], res2))
    res3 = schedule(tasks, [8])
    res3.allocations["a"] = [(1, 9.0)]
    assert any("only 8h available" in v for v in check_schedule_integrity(tasks, [8], res3))


def test_randomised_schedules_always_satisfy_integrity_invariants():
    rng = random.Random(2026)
    for _ in range(300):
        n = rng.randint(1, 12)
        tasks = []
        for i in range(n):
            deps = [f"t{j}" for j in range(i) if rng.random() < 0.3]
            tasks.append(Task(f"t{i}", rng.choice([0.5, 1, 2.5, 3, 4, 6, 9, 13]), deps))
        caps = [rng.choice([0, 1, 2, 4, 8, 8, 12, 20]) for _ in range(rng.randint(1, 10))]
        res, dropped = schedule_complete_only(tasks, caps)
        kept = [t for t in tasks if t.id in res.allocations]
        assert check_schedule_integrity(kept, caps, res) == []
        assert set(res.finish_week) == {t.id for t in kept}
        for t in tasks:  # a dropped task's dependents are dropped too
            if t.id in dropped:
                assert all(t.id not in k.depends_on or k.id in dropped for k in tasks)
        assert all(sum(h for w, h in a if w == wk) >= 0 for a in res.allocations.values() for wk in range(1, len(caps) + 1))


def test_schedule_is_deterministic():
    a, b = plan(), plan()
    assert a == b


def test_projection_matches_extended_schedule():
    r = plan(weekly=8, weeks=2)
    wk = r["schedule"]["projected_completion_week"]
    assert wk and wk * 8 >= r["schedule"]["scheduled_hours"] + r["schedule"]["unscheduled_hours"] - 8
    assert not math.isnan(wk)
