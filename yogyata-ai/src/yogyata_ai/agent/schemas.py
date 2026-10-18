"""Schemas for the Career Assistant agent. The agent is stateless: all state lives in AgentSession, owned by the backend."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from yogyata_ai.common.schemas import EvidenceRecord, StudentProfile

Action = Literal["resume", "interview", "gap", "opportunities", "roadmap", "mentors", "tasks"]
ALL_ACTIONS: list[str] = ["resume", "interview", "gap", "opportunities", "roadmap", "mentors", "tasks"]


class ProposedAction(BaseModel):
    id: str
    kind: str
    target_id: str
    note: str = ""
    status: Literal["suggested_for_user", "awaiting_user_confirmation", "confirmed_handoff_to_backend", "declined"]
    executed: Literal[False] = False
    message: str


class AgentSession(BaseModel):
    """Persist and pass back on the next call. Contains no contact details, only what the modules need."""
    model_config = ConfigDict(extra="forbid")
    profile: StudentProfile = Field(default_factory=StudentProfile)
    evidence: list[EvidenceRecord] = Field(default_factory=list)
    interview_history: list[dict[str, Any]] = Field(default_factory=list)
    completed_task_ids: list[str] = Field(default_factory=list)
    pending_actions: list[ProposedAction] = Field(default_factory=list)
    action_counter: int = 0
    review_ledger: dict[str, Any] | None = Field(None, description="Human-review ledger (reviews + hash-chained audit log); persist and pass back")


class InterviewAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question_id: str
    answer_text: str


class AgentOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    max_tool_calls: int = Field(14, ge=1, le=40)
    timeout_s: float = Field(30.0, gt=0, le=300)
    max_interview_answers: int = Field(5, ge=1, le=20)
    top_k: int = Field(5, ge=1, le=20)


class AgentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session: AgentSession = Field(default_factory=AgentSession)
    target_role: str | None = None
    goals: str | None = None
    resume_text: str | None = None
    interview_answers: list[InterviewAnswer] = Field(default_factory=list)
    reviewed_results: list[dict[str, Any]] = Field(default_factory=list, description="HUMAN-review results from your review pipeline only")
    opportunities: list[dict[str, Any]] = Field(default_factory=list)
    mentors: list[dict[str, Any]] = Field(default_factory=list)
    availability: list[dict[str, str]] | None = None
    user_message: str | None = None
    options: AgentOptions = Field(default_factory=AgentOptions)


class ToolCallRecord(BaseModel):
    step: int
    tool: str
    ok: bool
    error: str | None = None
    duration_ms: float
    args_summary: dict[str, Any]


class Verification(BaseModel):
    passed: bool
    checks_run: list[str]
    issues: list[str] = Field(default_factory=list)


class AgentResponse(BaseModel):
    session: AgentSession
    plan: list[str]
    plan_source: str
    stages_run: list[str]
    stages_skipped: list[dict[str, str]]
    needs_input: list[str]
    summary: str
    summary_source: str
    results: dict[str, Any]
    proposed_actions: list[ProposedAction]
    refused_requests: list[dict[str, str]]
    security_notes: list[str]
    verification: Verification
    trace: list[ToolCallRecord]
    limitations: list[str]
    mode: Literal["deterministic", "llm_assisted"]
