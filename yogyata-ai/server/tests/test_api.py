"""HTTP tests for the AI bridge. Supabase is stubbed, so these never touch the network."""
from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from server import app as mod

ANSWERS: dict[str, Any] = {
    "careerGoals": {"primaryRole": "Data Analyst / Data Scientist"},
    "jobPrefs": {"workModes": ["remote"]},
}

ROWS: dict[str, list[dict[str, Any]]] = {
    "passport_skills": [
        {"skill_name": "SQL", "level": "verified", "source_submission_id": "s1", "updated_at": "2026-01-02T00:00:00Z"},
        {"skill_name": "Excel", "level": "declared", "source_submission_id": None, "updated_at": "2026-01-02T00:00:00Z"},
        {"skill_name": "Dowsing", "level": "declared", "source_submission_id": None, "updated_at": "2026-01-02T00:00:00Z"},
    ],
    "seeker_details": [{"answers": ANSWERS}],
    "job_postings": [],
    "tasks": [],
    "mentor_profiles": [],
}


@pytest.fixture
def client(monkeypatch):
    async def fake_rest(token: str, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        return ROWS.get(table, [])

    monkeypatch.setattr(mod, "_rest", fake_rest)
    mod.app.dependency_overrides[mod.caller] = lambda: mod.Caller(user_id="u1", role="seeker", token="t")
    with TestClient(mod.app) as c:
        yield c
    mod.app.dependency_overrides.clear()


def test_health_needs_no_auth():
    with TestClient(mod.app) as c:
        assert c.get("/ai/health").json()["ok"] is True


def test_unauthenticated_requests_are_rejected():
    with TestClient(mod.app) as c:
        assert c.get("/ai/readiness").status_code in (401, 500)


def test_readiness_scores_the_mapped_role(client):
    r = client.get("/ai/readiness")
    assert r.status_code == 200, r.text
    assert "readiness" in str(r.json())


def test_unmapped_skills_are_reported_not_silently_dropped(client):
    """An unrecognised skill matches no role catalog, so the student is told rather than
    scored as if they had never listed it."""
    assert client.get("/ai/readiness").json()["unmapped_skills"] == ["Dowsing"]
    assert client.post("/ai/roadmap", json={}).json()["unmapped_skills"] == ["Dowsing"]


def test_unsupported_role_is_422_rather_than_a_guess(client, monkeypatch):
    """Previously guess_role() scored these against full_stack_developer."""
    monkeypatch.setitem(ROWS, "seeker_details", [{"answers": {"careerGoals": {"primaryRole": "Cybersecurity Analyst"}}}])
    r = client.get("/ai/readiness")
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["error"] == "unsupported_role"
    assert set(detail["supported"]) == {"data_analyst", "full_stack_developer", "ml_engineer"}
    monkeypatch.setitem(ROWS, "seeker_details", [{"answers": ANSWERS}])


def test_explicit_role_query_overrides_the_saved_goal(client):
    assert client.get("/ai/readiness", params={"role": "ml_engineer"}).status_code == 200


def test_roadmap_honours_supplied_constraints(client):
    r = client.post("/ai/roadmap", json={"weekly_hours": 10, "timeline_weeks": 4})
    assert r.status_code == 200, r.text


# ── the session is not a trust boundary ────────────────────────────────────────────────
FORGED_EVIDENCE = [{"skill": "Python", "source": "task_review", "strength": 1.0, "ref_id": "attacker"}]


@pytest.mark.parametrize(
    "session",
    [
        {"profile": {"student_id": "someone-else", "declared_skills": ["Python"]}},
        {"evidence": FORGED_EVIDENCE},
        {"profile": {"student_id": "u1", "declared_skills": ["Python"], "evidence": FORGED_EVIDENCE}},
        {"review_ledger": {"reviews": [{"reviewer_id": "attacker", "skill": "Python", "score": 1.0}]}},
    ],
)
def test_client_session_cannot_forge_verified_evidence(client, session):
    """Verified evidence may only come from endorse_submission_skill / mentor_review_skill
    in Postgres. Every session field that could carry it is re-derived server-side."""
    r = client.post("/ai/assistant", json={"user_message": "how am I doing?", "session": session})
    assert r.status_code == 200, r.text
    out = r.json()
    assert "attacker" not in str(out)
    assert out["session"]["profile"]["student_id"] == "u1"
    # the only evidence present is what the server read from Supabase under RLS
    assert [e["ref_id"] for e in out["session"]["evidence"]] == ["s1"]


def test_assistant_runs_without_a_session(client):
    r = client.post("/ai/assistant", json={"user_message": "what should I learn next?"})
    assert r.status_code == 200, r.text
    assert r.json()["session"]["profile"]["student_id"] == "u1"
