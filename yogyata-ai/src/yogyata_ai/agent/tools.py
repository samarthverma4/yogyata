"""Typed, allow-listed tools. Every tool is a pure computation over data the caller supplied.

There is NO tool that touches the network, filesystem, shell, database or payments, and none that applies to a job,
books a mentor or submits anything. 'propose_external_action' only records a proposal; it never executes anything.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from yogyata_ai import interview, mentor_recommendation, opportunity_matching, practical_tasks, resume_intelligence, roadmap, skill_gap
from yogyata_ai.common.safety import redact_pii
from yogyata_ai.common.schemas import EvidenceRecord, StudentProfile
from yogyata_ai.interview.api import evaluate as interview_evaluate
from yogyata_ai.opportunity_matching.api import match_opportunities
from yogyata_ai.practical_tasks.api import record_review

from .schemas import AgentSession, ProposedAction, ToolCallRecord

USER_ONLY_KINDS = {"apply_to_opportunity", "book_mentor_session", "make_payment", "submit_task_for_review"}
CONFIRMABLE_KINDS = {"save_roadmap", "export_report"}


class ToolError(Exception):
    pass


@dataclass
class RunContext:
    """Mutable state for one run. Tools read and write here; the planner/LLM never touches it."""
    session: AgentSession
    role_id: str | None = None
    opportunities: list[dict] = field(default_factory=list)
    mentors: list[dict] = field(default_factory=list)
    availability: list[dict] | None = None
    top_k: int = 5
    known_opportunity_ids: set[str] = field(default_factory=set)
    known_mentor_ids: set[str] = field(default_factory=set)

    def profile_payload(self) -> dict:
        ev = list(self.session.evidence)
        if self.session.review_ledger:  # reviewed evidence lives in the ledger, at the strength the readiness cap allowed
            from yogyata_ai.skill_gap.review import ReviewLedger
            ev.extend(ReviewLedger(**self.session.review_ledger).evidence_records())
        p = self.session.profile.model_copy(update={"evidence": ev})
        return p.model_dump(mode="json")


# ---- argument models (extra=forbid: unknown arguments are rejected, not ignored) --------------------------------
class _A(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ResumeArgs(_A):
    resume_text: str = Field(..., max_length=30_000)


class InterviewArgs(_A):
    question_id: str
    answer_text: str = Field(..., max_length=10_000)


class RoleArgs(_A):
    role_id: str


class NoArgs(_A):
    pass


class ReviewArgs(_A):
    result: dict[str, Any]
    review_id: str | None = None
    reason: str | None = None


class ProposeArgs(_A):
    kind: Literal["apply_to_opportunity", "book_mentor_session", "make_payment", "submit_task_for_review", "save_roadmap", "export_report"]
    target_id: str = Field(..., max_length=100)
    note: str = Field("", max_length=300)


@dataclass
class ToolSpec:
    name: str
    description: str
    args: type[BaseModel]
    fn: Callable[[RunContext, Any], dict]
    effect: Literal["read_only_compute", "state_update", "proposal_only"]


def _t_analyze_resume(ctx: RunContext, a: ResumeArgs) -> dict:
    full = resume_intelligence.analyze({"resume_text": a.resume_text})
    parsed = full["parsed"]
    out = {"overall_score": full["overall_score"], "components": full["components"], "suggestions": full["suggestions"],
           "warnings": full["warnings"], "information_gaps": full["information_gaps"],
           "skills": [{"name": s["name"], "support": s.get("support")} for s in parsed["skills"]]}  # contact details deliberately dropped
    return redact_pii(out)  # quoted resume snippets must not leak e-mails or phone numbers either


def _t_build_profile(ctx: RunContext, a: ResumeArgs) -> dict:
    p = resume_intelligence.build_profile({"resume_text": a.resume_text, "target_role": ctx.role_id})
    new = StudentProfile(**p)
    old = ctx.session.profile
    # merge: keep what the student/backend already told us; resume adds declared skills and resume-based evidence only
    merged = old.model_copy(update={
        "declared_skills": sorted(set(old.declared_skills) | set(new.declared_skills)),
        "education": new.education if old.education == type(old.education)() else old.education,
        "experience_years": old.experience_years if old.experience_years is not None else new.experience_years})
    ctx.session.profile = merged
    have = {(e.skill, e.source, e.ref_id, e.strength) for e in ctx.session.evidence}
    added = 0
    for e in new.evidence:
        if e.source in ("declared", "resume_evidence") and (e.skill, e.source, e.ref_id, e.strength) not in have:
            ctx.session.evidence.append(e)
            added += 1
    return {"declared_skills": len(merged.declared_skills), "resume_evidence_records_added": added}


def _t_interview(ctx: RunContext, a: InterviewArgs) -> dict:
    out = interview_evaluate({"question_id": a.question_id, "answer_text": a.answer_text})
    ev = out["evaluation"]
    ctx.session.interview_history.append(out["history_item"])
    have = {(e.skill, e.source, e.ref_id, e.strength) for e in ctx.session.evidence}
    added = 0
    for rec in interview.evidence_from_evaluations({"evaluations": [ev]}):  # low-confidence results yield no evidence
        e = EvidenceRecord(**rec)
        if (e.skill, e.source, e.ref_id, e.strength) not in have:
            ctx.session.evidence.append(e)
            added += 1
    return {"question_id": a.question_id, "overall": ev.get("overall"), "confidence": ev.get("confidence"),
            "strengths": ev.get("strengths"), "improvements": ev.get("improvements"), "evidence_records_added": added,
            "label": "automated_unverified"}


def _gap_payload(ctx: RunContext, role_id: str) -> dict:
    return {"profile": ctx.profile_payload(), "role_id": role_id, "top_n": 8}


def _t_gap(ctx: RunContext, a: RoleArgs) -> dict:
    return skill_gap.analyze_skill_gap(_gap_payload(ctx, a.role_id))


def _t_roadmap(ctx: RunContext, a: RoleArgs) -> dict:
    return roadmap.generate_roadmap(_gap_payload(ctx, a.role_id))


def _t_tasks(ctx: RunContext, a: RoleArgs) -> dict:
    return practical_tasks.recommend({**_gap_payload(ctx, a.role_id), "limit": ctx.top_k, "completed_task_ids": ctx.session.completed_task_ids})


def _t_opps(ctx: RunContext, a: NoArgs) -> dict:
    return match_opportunities({"profile": ctx.profile_payload(), "opportunities": ctx.opportunities, "top_k": ctx.top_k})


def _t_mentors(ctx: RunContext, a: RoleArgs) -> dict:
    return mentor_recommendation.recommend_mentors({**_gap_payload(ctx, a.role_id), "mentors": ctx.mentors,
                                                   "availability": ctx.availability, "limit": ctx.top_k})


def _t_review(ctx: RunContext, a: ReviewArgs) -> dict:
    """Human-reviewed result -> reviewed evidence through the review ledger (readiness cap, duplicate guard, audit trail)."""
    from yogyata_ai.practical_tasks.api import review_submission
    from yogyata_ai.skill_gap import submit_review
    sub = review_submission(a.result, review_id=a.review_id, reason=a.reason)
    base = ctx.session.profile.model_copy(update={"evidence": list(ctx.session.evidence)}).model_dump(mode="json")
    out = submit_review({"profile": base}, sub, ledger=ctx.session.review_ledger)
    ctx.session.review_ledger = out["ledger"]
    r = out["review"]
    return {"status": out["status"], "evidence_added": 0 if out["status"] == "duplicate" else len(r["skills"]),
            "sources": [] if out["status"] == "duplicate" else [f"{r['kind']}_review"], "original_score": r["original_score"],
            "applied_score": r["applied_score"], "cap_applied": r["cap_applied"]}


def _t_propose(ctx: RunContext, a: ProposeArgs) -> dict:
    s = ctx.session
    s.action_counter += 1
    aid = f"act_{s.action_counter}"
    if a.kind in USER_ONLY_KINDS:
        act = ProposedAction(id=aid, kind=a.kind, target_id=a.target_id, note=a.note, status="suggested_for_user",
                             message="The assistant never does this itself. If you want to proceed, do it yourself in the platform after reviewing the details.")
    else:
        act = ProposedAction(id=aid, kind=a.kind, target_id=a.target_id, note=a.note, status="awaiting_user_confirmation",
                             message="Nothing has been done. This needs your explicit confirmation in the platform before the backend acts on it.")
    s.pending_actions.append(act)
    return act.model_dump(mode="json")


def build_specs() -> dict[str, ToolSpec]:
    specs = [
        ToolSpec("analyze_resume", "Score and analyse resume text (rules).", ResumeArgs, _t_analyze_resume, "read_only_compute"),
        ToolSpec("build_profile", "Merge resume-derived skills into the session profile.", ResumeArgs, _t_build_profile, "state_update"),
        ToolSpec("evaluate_interview_answer", "Evaluate one mock-interview answer (automated, unverified).", InterviewArgs, _t_interview, "state_update"),
        ToolSpec("record_reviewed_result", "Record a HUMAN-reviewed result supplied by the review pipeline.", ReviewArgs, _t_review, "state_update"),
        ToolSpec("analyze_skill_gap", "Evidence-based skill-gap report for a role.", RoleArgs, _t_gap, "read_only_compute"),
        ToolSpec("generate_roadmap", "Personalised, constraint-aware roadmap.", RoleArgs, _t_roadmap, "read_only_compute"),
        ToolSpec("recommend_tasks", "Practical tasks for the student's gaps.", RoleArgs, _t_tasks, "read_only_compute"),
        ToolSpec("match_opportunities", "Rank the opportunities supplied by the platform.", NoArgs, _t_opps, "read_only_compute"),
        ToolSpec("recommend_mentors", "Rank the mentors supplied by the platform.", RoleArgs, _t_mentors, "read_only_compute"),
        ToolSpec("propose_external_action", "Record a proposal for a consequential action. Never executes anything.", ProposeArgs, _t_propose, "proposal_only"),
    ]
    return {s.name: s for s in specs}


class ToolRegistry:
    """Executes allow-listed tools with argument validation, a call budget and a deadline."""

    def __init__(self, ctx: RunContext, *, max_calls: int, timeout_s: float, specs: dict[str, ToolSpec] | None = None):
        self.ctx = ctx
        self.specs = specs or build_specs()
        self.max_calls = max_calls
        self.deadline = time.monotonic() + timeout_s
        self.trace: list[ToolCallRecord] = []

    @property
    def names(self) -> list[str]:
        return sorted(self.specs)

    def _log(self, tool, ok, error, t0, args):
        summary = {k: (f"<{len(v)} chars>" if isinstance(v, str) else type(v).__name__ if isinstance(v, (dict, list)) else v) for k, v in args.items()}
        self.trace.append(ToolCallRecord(step=len(self.trace) + 1, tool=tool, ok=ok, error=error,
                                         duration_ms=round((time.monotonic() - t0) * 1000, 2), args_summary=summary))

    def call(self, name: str, **args: Any) -> tuple[dict | None, str | None]:
        """Returns (result, None) or (None, error). Never raises; errors are recorded in the trace, never hidden."""
        t0 = time.monotonic()
        if len(self.trace) >= self.max_calls:
            return None, "tool_budget_exhausted"
        if t0 > self.deadline:
            return None, "deadline_exceeded"
        spec = self.specs.get(name)
        if spec is None:
            self._log(name[:60], False, "tool_not_allowed", t0, {})
            return None, "tool_not_allowed"
        try:
            parsed = spec.args(**args)
        except ValidationError as e:
            self._log(name, False, "invalid_arguments: " + e.errors()[0]["type"], t0, args)
            return None, "invalid_arguments"
        try:
            out = spec.fn(self.ctx, parsed)
        except (ValueError, ToolError, ValidationError) as e:
            msg = f"{type(e).__name__}: {str(e)[:160]}"
            self._log(name, False, msg, t0, args)
            return None, msg
        except Exception as e:  # defensive: a bug in a tool must not crash the run or be hidden
            msg = f"unexpected_error: {type(e).__name__}"
            self._log(name, False, msg, t0, args)
            return None, msg
        self._log(name, True, None, t0, args)
        return out, None
