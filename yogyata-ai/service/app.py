"""HTTP interface for yogyata_ai, scoped to one signed-in Yogyata user per request.

Boundary rules, in order of importance:

1. This service is **read-only with respect to evidence**. It never calls `record_review`,
   `submit_review` or any other path that mints verified evidence. Those exist already in
   Postgres as `endorse_submission_skill` and `mentor_review_skill`, where row level security
   and the SQL tests enforce that only a task's founder or an assigned mentor can promote a
   skill. A second, weaker path to Verified would undermine the Skill Passport.
2. Every read uses the caller's own access token, so RLS decides what is visible. The
   service holds no service-role key.
3. Scores are indicators. Nothing here predicts hiring, and the package's own caveats are
   passed through to the client rather than stripped.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError

from yogyata_ai import (
    interview,
    mentor_recommendation,
    opportunity_matching,
    practical_tasks,
    resume_intelligence,
    roadmap,
    skill_gap,
    university_analytics,
)
from yogyata_ai.agent import confirm_action, list_tools, run_agent

from .config import load_settings
from .mapping import (
    build_student_profile,
    mentors_from_profiles,
    opportunities_from_postings,
)
from .supabase_io import AuthError, Supabase
from .vocab import resolve_role, supported_roles

settings = load_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = Supabase(settings)
    yield
    await app.state.db.aclose()


app = FastAPI(title="yogyata-ai service", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_methods=["GET", "POST"],
    allow_headers=["authorization", "content-type"],
)


# ── errors ──────────────────────────────────────────────────────────────────────────────
@app.exception_handler(AuthError)
async def _auth_error(_: Request, exc: AuthError) -> JSONResponse:
    return JSONResponse(status_code=401, content={"error": "unauthorized", "detail": str(exc)})


@app.exception_handler(ValidationError)
async def _validation_error(_: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"error": "invalid_input", "detail": exc.errors(include_url=False)})


@app.exception_handler(ValueError)
async def _value_error(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"error": "bad_request", "detail": str(exc)})


# ── auth ────────────────────────────────────────────────────────────────────────────────
async def caller(request: Request, authorization: str = Header(default="")) -> dict[str, Any]:
    """Resolve the bearer token to a Supabase user. Raises 401 when it is not usable."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise AuthError("send the Supabase access token as 'Authorization: Bearer <token>'")
    db: Supabase = request.app.state.db
    return {"id": await db.user_id(token), "token": token, "db": db}


# ── request bodies ──────────────────────────────────────────────────────────────────────
class ProfileOptions(BaseModel):
    target_role: str | None = Field(None, description="App role label or package role id")
    weekly_hours: float | None = Field(None, gt=0, le=80)
    timeline_weeks: int | None = Field(None, gt=0, le=156)


class ResumeBody(BaseModel):
    resume_text: str = Field(..., min_length=1)
    job_description: str | None = None


class InterviewNextBody(BaseModel):
    role: str
    interview_type: str = "technical"
    history: list[dict[str, Any]] = Field(default_factory=list)


class InterviewEvaluateBody(BaseModel):
    question_id: str
    answer_text: str


class TaskEvaluateBody(BaseModel):
    task_id: str
    submission_text: str = Field(..., min_length=1)


class CohortBody(BaseModel):
    records: list[dict[str, Any]]
    group_by: str = "department"
    k: int = Field(10, ge=5)
    default_role_id: str | None = None


class AgentBody(ProfileOptions):
    """Profile options plus the agent payload, in one body: two separate Pydantic
    parameters would make FastAPI expect them nested under their argument names."""

    payload: dict[str, Any] = Field(default_factory=dict)


class AgentConfirmBody(BaseModel):
    session: dict[str, Any]
    action_id: str
    user_confirmed: bool


# ── profile assembly ────────────────────────────────────────────────────────────────────
async def load_profile(who: dict[str, Any], opts: ProfileOptions) -> tuple[dict, dict, str]:
    """Build the package's StudentProfile for the signed-in seeker.

    Returns (profile, notes, role_id). Raises 422 when the target role is outside the
    package's catalog, rather than scoring against the wrong role.
    """
    db: Supabase = who["db"]
    token, uid = who["token"], who["id"]

    profile_row = await db.one(token, "profiles", {"select": "id,role,full_name,organization", "id": f"eq.{uid}"})
    if not profile_row:
        raise HTTPException(status_code=404, detail="no profile for this account")

    details = await db.one(token, "seeker_details", {"select": "headline,location,answers", "id": f"eq.{uid}"})
    passport = await db.select(
        token,
        "passport_skills",
        {"select": "id,skill_name,level,evidence,source_submission_id,created_at,updated_at", "seeker_id": f"eq.{uid}"},
    )
    subs = await db.select(token, "submissions", {"select": "id,rating,status", "seeker_id": f"eq.{uid}"})

    profile, notes = build_student_profile(
        profile_row=profile_row,
        seeker_details=details,
        passport_rows=passport,
        submissions={s["id"]: s for s in subs},
        target_role=opts.target_role,
        weekly_hours=opts.weekly_hours,
        timeline_weeks=opts.timeline_weeks,
    )

    role_id = resolve_role(profile["target_role"])
    if role_id is None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "unsupported_role",
                "requested": profile["target_role"],
                "supported": supported_roles(),
                "hint": "Only these roles have a reviewed skill catalog; pick one or extend roles.json.",
            },
        )
    profile["target_role"] = role_id
    return profile, notes, role_id


# ── meta ────────────────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "service": "yogyata-ai", "version": app.version}


@app.get("/meta/roles")
async def meta_roles() -> dict[str, Any]:
    return {"roles": skill_gap.list_roles(), "supported_ids": supported_roles()}


@app.get("/meta/tools")
async def meta_tools() -> dict[str, Any]:
    return {"tools": list_tools()}


@app.post("/me/profile")
async def me_profile(opts: ProfileOptions, who: dict = Depends(caller)) -> dict[str, Any]:
    """The StudentProfile this service derives from your Supabase rows, plus what it could not map."""
    profile, notes, role_id = await load_profile(who, opts)
    return {"profile": profile, "role_id": role_id, "notes": notes}


# ── scoring ─────────────────────────────────────────────────────────────────────────────
@app.post("/skill-gap")
async def post_skill_gap(opts: ProfileOptions, who: dict = Depends(caller)) -> dict[str, Any]:
    profile, notes, role_id = await load_profile(who, opts)
    return {"result": skill_gap.analyze_skill_gap({"profile": profile, "role_id": role_id}), "notes": notes}


@app.post("/roadmap")
async def post_roadmap(opts: ProfileOptions, who: dict = Depends(caller)) -> dict[str, Any]:
    profile, notes, role_id = await load_profile(who, opts)
    return {"result": roadmap.generate_roadmap({"profile": profile, "role_id": role_id}), "notes": notes}


@app.post("/opportunities/match")
async def post_opportunities(opts: ProfileOptions, who: dict = Depends(caller)) -> dict[str, Any]:
    profile, notes, role_id = await load_profile(who, opts)
    db: Supabase = who["db"]
    rows = await db.select(
        who["token"],
        "job_postings",
        {
            "select": "id,title,description,required_skills,location,work_arrangement,recruiter_id,status",
            "status": "eq.open",
            "limit": "200",
        },
    )
    opportunities = opportunities_from_postings(rows)
    result = opportunity_matching.match_opportunities(
        {"profile": profile, "opportunities": opportunities, "role_id": role_id}
    )
    return {"result": result, "notes": {**notes, "postings_considered": len(opportunities)}}


@app.post("/mentors/recommend")
async def post_mentors(opts: ProfileOptions, who: dict = Depends(caller)) -> dict[str, Any]:
    profile, notes, role_id = await load_profile(who, opts)
    db: Supabase = who["db"]
    rows = await db.select(
        who["token"],
        "mentor_profiles",
        {
            "select": "id,headline,role_title,bio,expertise_areas,technical_skills,languages,"
            "years_experience,hourly_rate,accepting,listed",
            "limit": "200",
        },
    )
    mentors, skipped = mentors_from_profiles(rows)
    result = mentor_recommendation.recommend_mentors(
        {"profile": profile, "role_id": role_id, "mentors": mentors}
    )
    return {"result": result, "notes": {**notes, "mentors_without_mappable_skills": len(skipped)}}


# ── stateless helpers (no Supabase read needed) ─────────────────────────────────────────
@app.post("/resume/analyze")
async def post_resume(body: ResumeBody, who: dict = Depends(caller)) -> dict[str, Any]:
    if body.job_description:
        return {"result": resume_intelligence.compare_job(
            {"resume_text": body.resume_text, "job_description": body.job_description}
        )}
    return {"result": resume_intelligence.analyze({"resume_text": body.resume_text})}


@app.get("/interview/questions")
async def get_questions(who: dict = Depends(caller)) -> dict[str, Any]:
    return {"result": interview.list_questions()}


@app.post("/interview/next")
async def post_interview_next(body: InterviewNextBody, who: dict = Depends(caller)) -> dict[str, Any]:
    return {"result": interview.next_question(body.model_dump())}


@app.post("/interview/evaluate")
async def post_interview_evaluate(body: InterviewEvaluateBody, who: dict = Depends(caller)) -> dict[str, Any]:
    # automated and unverified by construction; it cannot promote a skill on its own
    return {"result": interview.evaluate(body.model_dump())}


@app.post("/tasks/recommend")
async def post_tasks_recommend(opts: ProfileOptions, who: dict = Depends(caller)) -> dict[str, Any]:
    profile, notes, role_id = await load_profile(who, opts)
    return {"result": practical_tasks.recommend({"profile": profile, "role_id": role_id}), "notes": notes}


@app.post("/tasks/evaluate")
async def post_tasks_evaluate(body: TaskEvaluateBody, who: dict = Depends(caller)) -> dict[str, Any]:
    """Preliminary feedback only: always `human_review_required`, never verified evidence."""
    return {"result": practical_tasks.evaluate(body.task_id, body.submission_text, emit_evidence=False)}


@app.post("/analytics/cohort")
async def post_cohort(body: CohortBody, who: dict = Depends(caller)) -> dict[str, Any]:
    """Cohort analytics. Records are supplied by the caller; identifying fields are rejected
    by the package, and small groups are suppressed before anything is returned."""
    db: Supabase = who["db"]
    me = await db.one(who["token"], "profiles", {"select": "role", "id": f"eq.{who['id']}"})
    if not me or me.get("role") != "recruiter":
        raise HTTPException(status_code=403, detail="cohort analytics is for recruiter accounts")
    return {
        "result": university_analytics.cohort_analytics(
            body.records, group_by=body.group_by, k=body.k, default_role_id=body.default_role_id
        )
    }


# ── agent ───────────────────────────────────────────────────────────────────────────────
@app.post("/agent/run")
async def post_agent(body: AgentBody, who: dict = Depends(caller)) -> dict[str, Any]:
    """Run the career assistant.

    Three fields are server-owned and cannot be supplied by the caller, because each is a
    route to forged verified evidence: `reviewed_results`, `session.profile` (which carries
    its own evidence list) and `session.review_ledger`. Everything else in `session` is
    continuity state and is passed back through untouched.
    """
    profile, notes, role_id = await load_profile(who, body)

    session = dict(body.payload.get("session") or {})
    session["profile"] = profile
    session["evidence"] = []
    session.pop("review_ledger", None)

    payload = {k: v for k, v in body.payload.items() if k not in {"reviewed_results", "session"}}
    payload.update({"session": session, "target_role": role_id})
    return {"result": run_agent(payload), "notes": notes}


@app.post("/agent/confirm")
async def post_agent_confirm(body: AgentConfirmBody, who: dict = Depends(caller)) -> dict[str, Any]:
    """Record a user's confirmation. The action is still executed by the app, not here."""
    return {"result": confirm_action(body.session, body.action_id, user_confirmed=body.user_confirmed)}
