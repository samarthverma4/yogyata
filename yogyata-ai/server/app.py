"""HTTP bridge between the Yogyata web app and the yogyata-ai package.

The browser sends the user's Supabase access token. Each request:
1. confirms the token with Supabase Auth and loads the caller's role,
2. reads the caller's own data from Supabase *with that same token*, so row-level
   security decides what is visible (no service-role key exists here),
3. calls the deterministic yogyata-ai functions and returns their JSON.

Nothing here writes to Supabase, applies, books or pays: results are advice the
user acts on in the normal screens. Run with:  uvicorn server.app:app --port 8787
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

from yogyata_ai import interview, mentor_recommendation, opportunity_matching, practical_tasks, resume_intelligence, roadmap, skill_gap
from yogyata_ai.agent import confirm_action, run_agent
from yogyata_ai.common.taxonomy import get_taxonomy


# ─── Configuration (public values only: the URL and the publishable key) ──────
def _env_file() -> dict[str, str]:
    """Reads VITE_SUPABASE_* from the web app's .env.local so both sides share one config."""
    path = Path(__file__).resolve().parents[2] / ".env.local"
    out: dict[str, str] = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"')
    return out


_file = _env_file()
SUPABASE_URL = (os.getenv("SUPABASE_URL") or _file.get("VITE_SUPABASE_URL", "")).rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY") or _file.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")
ALLOWED_ORIGINS = os.getenv("YOGYATA_WEB_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")

app = FastAPI(title="Yogyata AI", version="0.1.0", docs_url="/ai/docs", openapi_url="/ai/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])

TAXONOMY = get_taxonomy()
ROLE_IDS = [r["id"] for r in skill_gap.list_roles()]


# ─── Auth and Supabase reads as the caller ──────────────────────────────────
class Caller(BaseModel):
    user_id: str
    role: str
    token: str


async def _rest(token: str, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            params=params,
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"},
        )
    if r.status_code >= 400:
        raise HTTPException(502, f"Could not read {table} from Supabase.")
    return r.json()


async def caller(request: Request) -> Caller:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(500, "Server is missing the Supabase URL or publishable key.")
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(401, "Sign in first.")
    token = auth.split(" ", 1)[1].strip()
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {token}"})
    if r.status_code != 200:
        raise HTTPException(401, "Your session has expired. Sign in again.")
    uid = r.json()["id"]
    rows = await _rest(token, "profiles", {"id": f"eq.{uid}", "select": "role,approval"})
    if not rows or rows[0]["approval"] != "approved":
        raise HTTPException(403, "Your account is not approved yet.")
    return Caller(user_id=uid, role=rows[0]["role"], token=token)


def seeker_only(c: Caller = Depends(caller)) -> Caller:
    if c.role != "seeker":
        raise HTTPException(403, "This is part of the seeker workspace.")
    return c


def founder_only(c: Caller = Depends(caller)) -> Caller:
    if c.role != "entrepreneur":
        raise HTTPException(403, "This is part of the founder workspace.")
    return c


# ─── Mapping our data onto yogyata-ai shapes ────────────────────────────────
# Our levels → evidence the package understands. Only founder-reviewed work counts
# as human review ("verified"); assessed skills are treated as automated evidence.
_EVIDENCE = {"verified": ("task_review", 0.8), "assessed": ("interview_auto", 0.75)}


def _canon(name: str) -> str | None:
    return TAXONOMY.canonical(name)


def guess_role(text: str) -> str:
    t = (text or "").lower()
    if re.search(r"\b(ml|machine learning|ai engineer|data scien)", t):
        return "ml_engineer"
    if re.search(r"\b(data analy|analyst|bi\b|business intelligence)", t):
        return "data_analyst"
    return "full_stack_developer"


async def seeker_profile(c: Caller, role_id: str | None) -> tuple[dict[str, Any], str]:
    skills = await _rest(c.token, "passport_skills", {"seeker_id": f"eq.{c.user_id}", "select": "skill_name,level,source_submission_id,updated_at"})
    details = await _rest(c.token, "seeker_details", {"id": f"eq.{c.user_id}", "select": "answers"})
    answers = (details[0]["answers"] if details else {}) or {}
    goal = (answers.get("careerGoals") or {}).get("primaryRole", "")
    role = role_id if role_id in ROLE_IDS else guess_role(goal)
    prefs = answers.get("jobPrefs") or {}

    declared, evidence = [], []
    for s in skills:
        name = _canon(s["skill_name"]) or s["skill_name"].strip()
        declared.append(name)
        if s["level"] in _EVIDENCE:
            source, strength = _EVIDENCE[s["level"]]
            evidence.append({"skill": name, "source": source, "strength": strength,
                             "ref_id": s.get("source_submission_id"), "assessed_at": s["updated_at"][:10]})
    modes = {"remote": "remote", "hybrid": "hybrid", "on-site": "onsite", "onsite": "onsite"}
    profile = {
        "student_id": c.user_id,
        "target_role": role,
        "goals": goal,
        "declared_skills": sorted(set(declared)),
        "evidence": evidence,
        "preferred_work_modes": sorted({modes[m.lower()] for m in prefs.get("workModes", []) if m.lower() in modes}),
        "weekly_hours": 6,
        "timeline_weeks": 8,
    }
    return profile, role


async def opportunities(c: Caller) -> list[dict[str, Any]]:
    posts = await _rest(c.token, "job_postings", {"status": "eq.open", "select": "id,title,category,description,required_skills,location,work_arrangement"})
    tasks = await _rest(c.token, "tasks", {"status": "eq.published", "select": "id,title,org_name,problem_statement,required_skills"})
    mode = {"remote": "remote", "hybrid": "hybrid", "on-site": "onsite"}
    out = [
        {"id": f"job:{p['id']}", "type": "internship" if p["category"] == "internship" else "job", "title": p["title"],
         "description": p["description"][:4000], "required_skills": p["required_skills"], "location": p["location"] or None,
         "work_mode": mode.get(p["work_arrangement"])}
        for p in posts
    ]
    out += [
        {"id": f"task:{t['id']}", "type": "startup_task", "title": t["title"], "organisation": t["org_name"],
         "description": t["problem_statement"][:4000], "required_skills": t["required_skills"]}
        for t in tasks
    ]
    return out


async def mentors(c: Caller) -> list[dict[str, Any]]:
    rows = await _rest(c.token, "mentor_profiles", {"listed": "eq.true", "select": "id,headline,bio,technical_skills,expertise_areas,years_experience,languages,pricing,hourly_rate,accepting"})
    out = []
    for m in rows:
        expertise = {k: 4 for k in (_canon(s) for s in m["technical_skills"] + m["expertise_areas"]) if k}
        if not expertise:
            continue  # the recommender needs at least one recognised skill
        price = 0.0 if m["pricing"] == "free" else (float(re.sub(r"[^\d.]", "", m["hourly_rate"]) or 0) or None)
        out.append({"id": m["id"], "headline": m["headline"], "bio": m["bio"][:2000], "expertise": expertise,
                    "years_experience": m["years_experience"], "languages": m["languages"] or None,
                    "price_per_session_inr": price, "accepting_students": m["accepting"]})
    return out


def _call(fn, *args, **kwargs):
    """Package errors that mean bad input become 400s with the package's own message."""
    try:
        return fn(*args, **kwargs)
    except (ValidationError, ValueError, KeyError) as e:
        raise HTTPException(400, str(e).splitlines()[0][:300]) from e


# ─── Endpoints ──────────────────────────────────────────────────────────────
@app.get("/ai/health")
def health() -> dict[str, Any]:
    return {"ok": True, "supabase": bool(SUPABASE_URL and SUPABASE_KEY), "roles": ROLE_IDS}


@app.get("/ai/roles")
def roles() -> list[dict[str, Any]]:
    return skill_gap.list_roles()


@app.get("/ai/readiness")
async def readiness(role: str | None = Query(None), c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    profile, role_id = await seeker_profile(c, role)
    return _call(skill_gap.analyze_skill_gap, {"profile": profile, "role_id": role_id})


class RoadmapIn(BaseModel):
    role: str | None = None
    weekly_hours: float = Field(6, gt=0, le=60)
    timeline_weeks: int = Field(8, gt=0, le=52)


@app.post("/ai/roadmap")
async def ai_roadmap(body: RoadmapIn, c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    profile, role_id = await seeker_profile(c, body.role)
    profile.update(weekly_hours=body.weekly_hours, timeline_weeks=body.timeline_weeks)
    return _call(roadmap.generate_roadmap, {"profile": profile, "role_id": role_id})


@app.get("/ai/matches")
async def matches(role: str | None = Query(None), c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    profile, role_id = await seeker_profile(c, role)
    opps = await opportunities(c)
    ranked = _call(opportunity_matching.match_opportunities, {"profile": profile, "opportunities": opps, "top_k": 10}) if opps else {"ranked": [], "excluded": []}
    ms = await mentors(c)
    mentor_rank = _call(mentor_recommendation.recommend_mentors, {"profile": profile, "role_id": role_id, "mentors": ms, "limit": 5}) if ms else {"ranked": []}
    return {"role_id": role_id, "opportunities": ranked, "mentors": mentor_rank}


@app.get("/ai/interview/next")
async def interview_next(role: str | None = Query(None), kind: str = Query("technical"), history: str = Query(""), c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    _, role_id = await seeker_profile(c, role)
    asked = [{"question_id": q} for q in history.split(",") if q][:30]
    nxt = _call(interview.next_question, {"interview_type": kind, "role": role_id, "history": asked})
    return nxt or {"question": None, "reason": "You have answered every question in this set."}


class AnswerIn(BaseModel):
    question_id: str = Field(min_length=1, max_length=120)
    answer_text: str = Field(min_length=1, max_length=6000)


@app.post("/ai/interview/evaluate")
def interview_evaluate(body: AnswerIn, c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    return _call(interview.evaluate, body.model_dump())


class ResumeIn(BaseModel):
    resume_text: str = Field(min_length=40, max_length=60000)
    role: str | None = None


@app.post("/ai/resume")
async def resume(body: ResumeIn, c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    _, role_id = await seeker_profile(c, body.role)
    analysis = _call(resume_intelligence.analyze, {"resume_text": body.resume_text})
    # contact details are personal data the app already has; never echo them back
    parsed = analysis.get("parsed", {})
    parsed.pop("contact", None)
    parsed.get("sections", {}).pop("header", None)
    return {"role_id": role_id, "analysis": analysis}


class TaskCheckIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    text: str = Field(min_length=20, max_length=8000)


@app.post("/ai/task-check")
def task_check(body: TaskCheckIn, c: Caller = Depends(founder_only)) -> dict[str, Any]:
    return _call(practical_tasks.interpret, body.text, title=body.title)


class AgentIn(BaseModel):
    user_message: str = Field(min_length=1, max_length=4000)
    role: str | None = None
    resume_text: str | None = Field(None, max_length=60000)
    session: dict[str, Any] = Field(default_factory=dict)


@app.post("/ai/assistant")
async def assistant(body: AgentIn, c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    profile, role_id = await seeker_profile(c, body.role)
    session = body.session or {
        "profile": {k: profile[k] for k in ("student_id", "declared_skills", "preferred_work_modes", "weekly_hours", "timeline_weeks")},
        "evidence": profile["evidence"],
    }
    payload = {"target_role": role_id, "goals": profile["goals"] or None, "resume_text": body.resume_text, "opportunities": await opportunities(c),
               "mentors": await mentors(c), "user_message": body.user_message, "session": session}
    return _call(run_agent, payload)


class ConfirmIn(BaseModel):
    session: dict[str, Any]
    action_id: str
    user_confirmed: bool


@app.post("/ai/assistant/confirm")
def assistant_confirm(body: ConfirmIn, c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    # called only from an explicit click in the UI; the handoff is never executed here
    return _call(confirm_action, body.session, body.action_id, user_confirmed=body.user_confirmed)
