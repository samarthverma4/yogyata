"""HTTP-level tests. Supabase is faked, so these never touch the network."""
from __future__ import annotations

import os
from typing import Any

import pytest

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")

from fastapi.testclient import TestClient  # noqa: E402

from service.app import app  # noqa: E402

AUTH = {"Authorization": "Bearer token-abc"}

ANSWERS = {
    "professional": {"experience": "1-2", "city": "Mandi", "country": "India"},
    "education": {"degree": "B.Tech", "graduationYear": "2026"},
    "resumeSkills": {"skills": ["Python", "SQL"]},
    "careerGoals": {"primaryRole": "Data Analyst / Data Scientist"},
    "jobPrefs": {"workModes": ["remote"], "opportunityTypes": ["internship"]},
}


class FakeDB:
    """Stands in for Supabase: returns canned rows and records what was asked for."""

    def __init__(self, role: str = "seeker", answers: dict | None = None):
        self.role = role
        self.answers = ANSWERS if answers is None else answers
        self.tables: list[str] = []

    async def user_id(self, token: str) -> str:
        if token != "token-abc":
            from service.supabase_io import AuthError

            raise AuthError("invalid or expired session")
        return "u1"

    async def select(self, token: str, table: str, params: dict) -> list[dict[str, Any]]:
        self.tables.append(table)
        return {
            "profiles": [{"id": "u1", "role": self.role, "full_name": "QA", "organization": "X"}],
            "seeker_details": [{"headline": "Analyst", "location": "Mandi", "answers": self.answers}],
            "passport_skills": [
                {"id": "p1", "skill_name": "SQL", "level": "assessed", "updated_at": "2026-01-02T00:00:00Z"}
            ],
            "submissions": [],
            "job_postings": [
                {
                    "id": "j1",
                    "title": "Data Analyst Intern",
                    "description": "Dashboards and SQL",
                    "required_skills": ["SQL", "Excel"],
                    "location": "Remote",
                    "work_arrangement": "remote",
                    "recruiter_id": "r1",
                }
            ],
            "mentor_profiles": [
                {
                    "id": "m1",
                    "headline": "Analytics mentor",
                    "bio": "",
                    "expertise_areas": ["SQL"],
                    "technical_skills": ["Excel"],
                    "languages": ["English"],
                    "years_experience": 6,
                    "hourly_rate": "",
                    "accepting": True,
                }
            ],
        }.get(table, [])

    async def one(self, token: str, table: str, params: dict) -> dict | None:
        rows = await self.select(token, table, params)
        return rows[0] if rows else None

    async def aclose(self) -> None: ...


@pytest.fixture
def client():
    with TestClient(app) as c:
        app.state.db = FakeDB()
        yield c


def test_health_needs_no_auth(client):
    assert client.get("/health").json()["ok"] is True


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Basic x"}, {"Authorization": "Bearer wrong"}])
def test_protected_routes_reject_bad_credentials(client, headers):
    assert client.post("/skill-gap", json={}, headers=headers).status_code == 401


def test_skill_gap_returns_readiness_and_notes(client):
    r = client.post("/skill-gap", json={}, headers=AUTH)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "readiness" in str(body["result"])
    assert body["notes"]["unmapped_skills"] == []


def test_roadmap_respects_supplied_planning_inputs(client):
    r = client.post("/roadmap", json={"weekly_hours": 10, "timeline_weeks": 4}, headers=AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["notes"]["weekly_hours_supplied"] is True


def test_unsupported_role_is_422_with_the_supported_list(client):
    app.state.db = FakeDB(answers={**ANSWERS, "careerGoals": {"primaryRole": "Cybersecurity Analyst"}})
    r = client.post("/skill-gap", json={}, headers=AUTH)
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["error"] == "unsupported_role"
    assert "data_analyst" in detail["supported"]


def test_opportunities_rank_supplied_postings_only(client):
    r = client.post("/opportunities/match", json={}, headers=AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["notes"]["postings_considered"] == 1


def test_mentors_recommend(client):
    r = client.post("/mentors/recommend", json={}, headers=AUTH)
    assert r.status_code == 200, r.text
    assert "ranked" in r.json()["result"]


def test_task_evaluation_is_always_preliminary(client):
    tasks = client.post("/tasks/recommend", json={}, headers=AUTH).json()["result"]
    assert tasks["recommendations"], "the demo profile should have open gaps to recommend against"
    task_id = tasks["recommendations"][0]["task_id"]
    r = client.post("/tasks/evaluate", json={"task_id": task_id, "submission_text": "x" * 400}, headers=AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["result"]["human_review_required"] is True


def test_cohort_analytics_is_recruiter_only(client):
    assert client.post("/analytics/cohort", json={"records": []}, headers=AUTH).status_code == 403
    app.state.db = FakeDB(role="recruiter")
    assert client.post("/analytics/cohort", json={"records": []}, headers=AUTH).status_code == 200


def test_agent_runs_with_the_server_derived_profile(client):
    r = client.post("/agent/run", json={"payload": {}}, headers=AUTH)
    assert r.status_code == 200, r.text
    assert r.json()["result"]["session"]["profile"]["student_id"] == "u1"


@pytest.mark.parametrize(
    "forged",
    [
        {"reviewed_results": [{"skill": "Python", "reviewer_id": "attacker", "score": 1.0}]},
        {"session": {"review_ledger": {"reviews": [{"reviewer_id": "attacker"}]}}},
        {
            "session": {
                "profile": {
                    "student_id": "someone-else",
                    "declared_skills": ["Python"],
                    "evidence": [
                        {"skill": "Python", "source": "task_review", "strength": 1.0, "ref_id": "attacker"}
                    ],
                }
            }
        },
    ],
)
def test_agent_rejects_every_client_route_to_forged_evidence(client, forged):
    """Verified evidence may only come from the Postgres review path, so the three fields
    that could carry it are overwritten with server-derived values."""
    r = client.post("/agent/run", json={"payload": forged}, headers=AUTH)
    assert r.status_code == 200, r.text
    session = r.json()["result"]["session"]
    assert session["profile"]["student_id"] == "u1", "caller cannot swap in another profile"
    assert "attacker" not in str(r.json()["result"])
    # the only evidence present is what the service read from Supabase under RLS
    assert [e["ref_id"] for e in session["profile"]["evidence"]] == ["p1"]
