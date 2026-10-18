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
from yogyata_ai.practical_tasks.catalog import TaskCatalog


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


# ─── Founder: AI first look at a submission ─────────────────────────────────
# Maps a founder task row onto the package's PracticalTask so practical_tasks.evaluate
# can run its rubric checks. Only presence checks are automatic; every acceptance
# criterion the founder wrote stays a human check.
_DELIVERABLE_TERMS = {"README": ["readme"], "tests": ["test", "unit test"], "report": ["report", "write-up", "writeup"],
                      "code": ["code", "script", "implementation"], "dashboard": ["dashboard"],
                      "presentation": ["presentation", "slides"], "documentation": ["documentation", "docs"]}


def _task_skills(raw: list[str]) -> list[str]:
    return list(dict.fromkeys(_canon(s) or s.strip() for s in raw if s and s.strip()))


def practical_task(row: dict[str, Any]) -> dict[str, Any]:
    skills = _task_skills(row.get("required_skills") or [])
    brief = "\n".join(x for x in (row.get("problem_statement"), row.get("expected_deliverable"), row.get("evaluation_criteria")) if x)
    draft = practical_tasks.interpret(brief or row["title"], title=row["title"])
    rubric: list[dict[str, Any]] = []
    if skills:
        rubric.append({"id": "skills", "description": "Explains the work in terms of the required skills", "weight": 2.0,
                       "check": {"type": "concepts", "groups": [[s.lower()] for s in skills], "min_groups": max(1, (len(skills) + 1) // 2)}})
    for d in draft["deliverables"]:
        rubric.append({"id": f"deliverable_{d.lower()}", "description": f"Mentions the expected {d}", "weight": 1.0,
                       "check": {"type": "concepts", "groups": [_DELIVERABLE_TERMS[d]]}})
    rubric.append({"id": "explained", "description": "Notes explain what was built and how", "weight": 1.0, "check": {"type": "min_words", "n": 80}})
    rubric += [{**c, "id": f"criterion_{c['id']}"} for c in draft["draft_rubric"]]
    if not draft["draft_rubric"]:
        rubric.append({"id": "criterion_quality", "description": "The linked work meets the task brief", "weight": 2.0, "check": {"type": "human"}})
    return {"id": row["id"], "title": row["title"], "description": (row.get("problem_statement") or row["title"])[:4000],
            "skills": skills or ["General"], "difficulty": draft["difficulty"],
            "estimated_hours": min(200.0, draft["estimated_hours"] or 8.0), "deliverables": draft["deliverables"],
            "rubric": rubric, "source": "startup"}


class SubmissionCheckIn(BaseModel):
    submission_id: str = Field(min_length=1, max_length=64)


@app.post("/ai/submission-check")
async def submission_check(body: SubmissionCheckIn, c: Caller = Depends(founder_only)) -> dict[str, Any]:
    rows = await _rest(c.token, "submissions", {
        "id": f"eq.{body.submission_id}", "task.founder_id": f"eq.{c.user_id}",
        "select": "id,notes,task:tasks!inner(id,title,problem_statement,required_skills,expected_deliverable,evaluation_criteria,founder_id)"})
    if not rows:
        raise HTTPException(404, "That submission is not on one of your tasks.")
    task = practical_task(rows[0]["task"])
    # emit_evidence stays off: this is a first look for the founder, never evidence on the passport
    out = _call(practical_tasks.evaluate, task, rows[0]["notes"] or "")
    out.pop("suggested_evidence", None)
    return {"task_title": task["title"], "feedback": out,
            "read_note": "Only the candidate's notes were read. The linked work was not opened, so judge it yourself."}


# ─── Seeker: interview summary, roadmap update, resume against a posting, tasks for you ──
class InterviewSummaryIn(BaseModel):
    history: list[dict[str, Any]] = Field(default_factory=list, max_length=60)
    kind: str | None = None


@app.post("/ai/interview/summary")
def interview_summary(body: InterviewSummaryIn, c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    payload = {"history": body.history, "interview_type": body.kind}
    return {"topics": _call(interview.topic_performance, payload), "plan": _call(interview.practice_plan, payload)}


class RoadmapUpdateIn(RoadmapIn):
    completed_activity_ids: list[str] = Field(default_factory=list, max_length=100)


@app.post("/ai/roadmap/update")
async def ai_roadmap_update(body: RoadmapUpdateIn, c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    profile, role_id = await seeker_profile(c, body.role)
    profile.update(weekly_hours=body.weekly_hours, timeline_weeks=body.timeline_weeks)
    return _call(roadmap.update_roadmap, {"profile": profile, "role_id": role_id}, completed_activity_ids=body.completed_activity_ids)


class ResumeCompareIn(BaseModel):
    resume_text: str = Field(min_length=40, max_length=60000)
    posting_id: str = Field(min_length=1, max_length=64)


@app.post("/ai/resume/compare")
async def resume_compare(body: ResumeCompareIn, c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    posts = await _rest(c.token, "job_postings", {"id": f"eq.{body.posting_id}", "status": "eq.open",
                                                  "select": "id,title,description,required_skills,experience"})
    if not posts:
        raise HTTPException(404, "That posting is not open any more.")
    p = posts[0]
    jd = f"{p['title']}\n\n{p['description']}\n\nRequired skills: {', '.join(p['required_skills'])}"
    if p.get("experience"):
        jd += f"\nExperience: {p['experience']}"
    return {"posting_title": p["title"], "comparison": _call(resume_intelligence.compare_job, {"resume_text": body.resume_text, "job_description": jd[:20000]})}


@app.get("/ai/tasks-for-you")
async def tasks_for_you(role: str | None = Query(None), c: Caller = Depends(seeker_only)) -> dict[str, Any]:
    profile, role_id = await seeker_profile(c, role)
    rows = await _rest(c.token, "tasks", {"status": "eq.published", "select": "id,title,org_name,problem_statement,required_skills,expected_deliverable,evaluation_criteria"})
    mine = await _rest(c.token, "submissions", {"seeker_id": f"eq.{c.user_id}", "select": "task_id"})
    org = {r["id"]: r["org_name"] for r in rows}
    built = []
    for r in rows:
        t = practical_task(r)
        t["skills"] = [s for s in t["skills"] if _canon(s) == s]  # the catalog accepts taxonomy skills only
        if t["skills"]:
            built.append(t)
    if not built:
        return {"recommendations": [], "not_recommended": [], "notes": ["No published founder task lists a skill Yogyata AI recognises yet."]}
    catalog = _call(TaskCatalog.from_dict, {"tasks": built})
    out = _call(practical_tasks.recommend, {"profile": profile, "role_id": role_id, "limit": 5,
                                            "completed_task_ids": [m["task_id"] for m in mine]}, catalog=catalog)
    for rec in out["recommendations"]:
        rec["organisation"] = org.get(rec["task_id"], "")
    return out
