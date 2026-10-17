"""The Career Assistant: ONE controlled agent with a bounded, fixed workflow.

INTAKE -> PROFILE (resume) -> ASSESS (interview, reviewed results) -> GAP -> MATCH (opportunities, mentors, tasks)
-> ROADMAP -> VERIFY -> RESPOND.

Planner (deterministic or optional LLM) only picks which stages run. Tools are typed and allow-listed, calls and time are
bounded, untrusted text is data only, and nothing consequential is ever executed.
"""
from __future__ import annotations

import json
import re
import time
from typing import Any

from yogyata_ai.common.llm import LLMAdapter
from yogyata_ai.common.safety import detect_injection, sanitize_untrusted
from yogyata_ai.practical_tasks.catalog import default_task_catalog
from yogyata_ai.skill_gap.roles import default_catalog

from .explain import deterministic_summary, llm_summary
from .planner import deterministic_plan, detect_consequential, llm_plan
from .schemas import AgentRequest, AgentResponse, AgentSession, ProposedAction
from .tools import CONFIRMABLE_KINDS, USER_ONLY_KINDS, RunContext, ToolRegistry
from .verify import verify_response

LIMITATIONS = [
    "Recommendations come from transparent rules and small demo data; they are guidance, not predictions or guarantees.",
    "Automated interview and task feedback is provisional. Only human-reviewed results count as verified.",
    "The assistant only works with opportunities and mentors supplied by the platform and never invents any.",
    "The assistant never applies to jobs, books or pays for anything; those steps are yours.",
]
REFUSAL_TEXT = {
    "apply_to_opportunity": "I can't apply to opportunities for you. I can show which ones fit and why, and you can apply yourself in the platform.",
    "book_mentor_session": "I can't book mentor sessions for you. I can suggest suitable mentors; you choose and book yourself.",
    "make_payment": "I can't make or start payments. Any paid step is something you do yourself, after checking the details.",
}
_SAVE = re.compile(r"\b(save|export|download)\b", re.I)


def _texts_of(items: list[dict], keys=("description", "title", "bio", "headline", "requirements", "text")) -> str:
    out = []
    for it in items:
        for k in keys:
            v = it.get(k)
            if isinstance(v, str):
                out.append(v)
            elif isinstance(v, list):
                out += [x for x in v if isinstance(x, str)]
    return "\n".join(out)


def _clean_opportunities(items: list[dict]) -> list[dict]:
    return json.loads(sanitize_dumps(items))


def sanitize_dumps(obj: Any) -> str:
    """Round-trip through JSON with control characters stripped from every string."""
    def walk(x):
        if isinstance(x, str):
            return sanitize_untrusted(x, 20_000)
        if isinstance(x, list):
            return [walk(i) for i in x]
        if isinstance(x, dict):
            return {k: walk(v) for k, v in x.items()}
        return x
    return json.dumps(walk(obj))


def run_agent(payload: dict[str, Any], *, llm: LLMAdapter | None = None) -> dict[str, Any]:
    req = AgentRequest(**payload)
    opts = req.options
    session = req.session.model_copy(deep=True)
    notes: list[str] = []
    skipped: list[dict[str, str]] = []
    needs: list[str] = []
    refused: list[dict[str, str]] = []

    # ---- INTAKE: sanitise and flag untrusted content (flags are advisory; permissions never change) ----------------
    resume = sanitize_untrusted(req.resume_text) if req.resume_text else None
    message = sanitize_untrusted(req.user_message, 2000) if req.user_message else None
    goals = sanitize_untrusted(req.goals, 2000) if req.goals else None
    answers = [(a.question_id, sanitize_untrusted(a.answer_text, 10_000)) for a in req.interview_answers]
    opps = _clean_opportunities(req.opportunities)
    mentors = _clean_opportunities(req.mentors)
    for label, text in (("resume", resume), ("user message", message), ("goals", goals), ("interview answers", "\n".join(t for _, t in answers)),
                        ("opportunity data", _texts_of(opps)), ("mentor data", _texts_of(mentors))):
        flags = detect_injection(text)
        if flags:
            notes.append(f"Instruction-like text found in {label} ({', '.join(flags)}); it was treated as plain data and did not change what the assistant may do.")
    if goals is not None:
        session.profile = session.profile.model_copy(update={"goals": goals})
    role_id = req.target_role or session.profile.target_role
    if req.target_role:
        session.profile = session.profile.model_copy(update={"target_role": req.target_role})
    roles = default_catalog()
    if role_id and role_id not in roles.ids:
        needs.append(f"a supported target role (got '{role_id[:40]}'; supported: {', '.join(roles.ids)})")
        role_id = None
    ctx = RunContext(session=session, role_id=role_id, opportunities=opps, mentors=mentors, availability=req.availability, top_k=opts.top_k,
                     known_opportunity_ids={str(o.get("id")) for o in opps if o.get("id") is not None},
                     known_mentor_ids={str(m.get("id")) for m in mentors if m.get("id") is not None})
    reg = ToolRegistry(ctx, max_calls=opts.max_tool_calls, timeout_s=opts.timeout_s)
    results: dict[str, Any] = {}

    # ---- consequential requests are refused up front, never planned ------------------------------------------------
    for kind in detect_consequential(message):
        reg.call("propose_external_action", kind=kind, target_id="user_request", note="requested in chat; assistant will not perform it")
        refused.append({"kind": kind, "explanation": REFUSAL_TEXT[kind]})

    # ---- plan ------------------------------------------------------------------------------------------------------
    available = {a for a, ok in (("resume", bool(resume)), ("interview", bool(answers))) if ok}
    plan, plan_source, llm_used = None, "deterministic", False
    if llm is not None and message:
        plan, err = llm_plan(llm, message)
        if plan is not None:
            plan_source, llm_used = "llm_validated", True
            if "interview" in available and "interview" not in plan:
                plan.append("interview")
        else:
            notes.append(f"LLM planner not used ({err}); deterministic routing used.")
    if plan is None:
        plan = deterministic_plan(message, available)

    def skip(stage: str, why: str):
        skipped.append({"stage": stage, "reason": why})

    ran: list[str] = []

    # ---- PROFILE ---------------------------------------------------------------------------------------------------
    if "resume" in plan:
        if not resume:
            skip("resume", "no resume text supplied")
        else:
            out, err = reg.call("analyze_resume", resume_text=resume)
            if err:
                skip("resume", f"tool_error: {err}")
            else:
                results["resume"] = out
                _, err2 = reg.call("build_profile", resume_text=resume)
                if err2:
                    notes.append(f"Resume analysed, but profile merge failed: {err2}")
                ran.append("resume")

    # ---- ASSESS ----------------------------------------------------------------------------------------------------
    if req.reviewed_results:
        n_ok = 0
        for r in req.reviewed_results[:20]:
            _, err = reg.call("record_reviewed_result", result=r)
            n_ok += err is None
            if err:
                notes.append(f"A reviewed result was rejected: {err}")
        if n_ok:
            ran.append("reviewed_results")
    if "interview" in plan:
        if not answers:
            skip("interview", "no interview answers supplied")
        else:
            evals = []
            for qid, text in answers[:opts.max_interview_answers]:
                out, err = reg.call("evaluate_interview_answer", question_id=qid, answer_text=text)
                if err:
                    notes.append(f"Interview answer for '{qid[:40]}' could not be assessed ({err}).")
                else:
                    evals.append({"question_id": qid, **out})
            if len(answers) > opts.max_interview_answers:
                notes.append(f"Only the first {opts.max_interview_answers} interview answers were assessed.")
            if evals:
                results["interview"] = evals
                ran.append("interview")
            else:
                skip("interview", "no answer could be assessed")

    # ---- stages that need a role ----------------------------------------------------------------------------------
    def need_role(stage: str) -> bool:
        if role_id:
            return True
        skip(stage, "target role unknown")
        if not any("target role" in n for n in needs):
            needs.append(f"a target role (one of: {', '.join(roles.ids)})")
        return False

    if "gap" in plan and need_role("gap"):
        out, err = reg.call("analyze_skill_gap", role_id=role_id)
        if err:
            skip("gap", f"tool_error: {err}")
        else:
            results["gap"] = out
            ran.append("gap")
    if "opportunities" in plan:
        if not opps:
            skip("opportunities", "the platform supplied no opportunities (none are invented)")
        else:
            out, err = reg.call("match_opportunities")
            if err:
                skip("opportunities", f"tool_error: {err}")
            else:
                results["opportunities"] = out
                notes += [w for w in out.get("warnings", []) if "skipped" in w.lower()][:5]
                ran.append("opportunities")
    if "mentors" in plan and need_role("mentors"):
        if not mentors:
            skip("mentors", "the platform supplied no mentors (none are invented)")
        else:
            out, err = reg.call("recommend_mentors", role_id=role_id)
            if err:
                skip("mentors", f"tool_error: {err}")
            else:
                results["mentors"] = out
                notes += [w for w in out.get("warnings", []) if "skipped" in w.lower()][:5]
                ran.append("mentors")
    if "roadmap" in plan and need_role("roadmap"):
        out, err = reg.call("generate_roadmap", role_id=role_id)
        if err:
            skip("roadmap", f"tool_error: {err}")
        else:
            results["roadmap"] = out
            ran.append("roadmap")
    if "tasks" in plan and need_role("tasks"):
        out, err = reg.call("recommend_tasks", role_id=role_id)
        if err:
            skip("tasks", f"tool_error: {err}")
        else:
            results["tasks"] = out
            ran.append("tasks")
    if message and _SAVE.search(message):
        if "roadmap" in results:
            reg.call("propose_external_action", kind="save_roadmap", target_id=role_id or "roadmap", note="requested in chat")
        else:
            skip("save_roadmap", "no roadmap was generated in this run")

    # ---- RESPOND + VERIFY ------------------------------------------------------------------------------------------
    base = deterministic_summary(results, skipped, needs, refused)
    summary, summary_source = base, "deterministic_template"
    if llm is not None and results:
        text, err = llm_summary(llm, base, results)
        if text is not None:
            summary, summary_source, llm_used = text, "llm_validated", True
        else:
            notes.append(f"LLM summary not used ({err}); deterministic summary used.")
    proposed = [a for a in session.pending_actions if a.status in ("suggested_for_user", "awaiting_user_confirmation")]
    verification = verify_response(
        results=results, session=session, proposed=session.pending_actions, summary=summary, known_opportunity_ids=ctx.known_opportunity_ids,
        known_mentor_ids=ctx.known_mentor_ids, max_calls=opts.max_tool_calls, calls_used=len(reg.trace),
        completed_activity_ids=session.profile.completed_activity_ids, task_ids=set(default_task_catalog().tasks), base_summary=base)
    if not verification.passed and summary_source == "llm_validated":
        summary, summary_source = base, "deterministic_template"
        verification = verify_response(
            results=results, session=session, proposed=session.pending_actions, summary=summary, known_opportunity_ids=ctx.known_opportunity_ids,
            known_mentor_ids=ctx.known_mentor_ids, max_calls=opts.max_tool_calls, calls_used=len(reg.trace),
            completed_activity_ids=session.profile.completed_activity_ids, task_ids=set(default_task_catalog().tasks), base_summary=base)
    if not verification.passed:
        notes.append("Verification found issues; treat the results with caution: " + "; ".join(verification.issues[:3]))

    return AgentResponse(
        session=session, plan=plan, plan_source=plan_source, stages_run=ran, stages_skipped=skipped, needs_input=needs, summary=summary,
        summary_source=summary_source, results=results, proposed_actions=proposed, refused_requests=refused, security_notes=notes,
        verification=verification, trace=reg.trace, limitations=LIMITATIONS, mode="llm_assisted" if llm_used else "deterministic",
    ).model_dump(mode="json")


def confirm_action(session: dict[str, Any], action_id: str, *, user_confirmed: bool) -> dict[str, Any]:
    """Called by the BACKEND after the user explicitly clicked confirm/decline. Not an agent tool: the planner/LLM cannot reach it.

    Even when confirmed, this package executes nothing; it returns a hand-off for the backend to carry out.
    """
    s = AgentSession(**session)
    act = next((a for a in s.pending_actions if a.id == action_id), None)
    if act is None:
        raise ValueError(f"unknown action '{action_id}'")
    if act.kind in USER_ONLY_KINDS:
        return {"session": s.model_dump(mode="json"), "handoff": None,
                "message": "This kind of action is never performed by the assistant; the user does it directly in the platform."}
    if act.kind not in CONFIRMABLE_KINDS or act.status != "awaiting_user_confirmation":
        raise ValueError(f"action '{action_id}' is not awaiting confirmation")
    if not user_confirmed:
        act.status = "declined"
        return {"session": s.model_dump(mode="json"), "handoff": None, "message": "Declined; nothing was done."}
    act.status = "confirmed_handoff_to_backend"
    return {"session": s.model_dump(mode="json"), "handoff": {"action_id": act.id, "kind": act.kind, "target_id": act.target_id, "executed": False},
            "message": "Confirmed by the user. The backend is responsible for carrying this out; nothing was executed here."}
