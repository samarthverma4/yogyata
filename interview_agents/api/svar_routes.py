"""SVAR round — stateless agent endpoints.

Three pure functions of their input, no session state (the Node backend owns the
phase machine and persistence):

  POST /interview/svar/task    -> generate one task's content + reference data
  POST /interview/svar/score   -> separated content + delivery scores for a task
  POST /interview/svar/report  -> composite report from all per-task records

All LLM access goes through the svar_round package's own OpenAI-backed client.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from interview_agents.svar_round import content, scoring
from interview_agents.svar_round.llm import LLMClient, build_default_client, build_scoring_client
from interview_agents.svar_round.schemas import (
    ArticulationStability,
    AudioQualityFlag,
    ContentResult,
    ReferenceAlignResult,
    Report,
    ResponseSubmission,
    SpeechFeatures,
    TaskRecord,
    TaskType,
)


router = APIRouter()

# Opaque per-candidate-session ID the Node backend generates once at init and
# resends on every call for that session (see svarRound.controller.js's
# CORRELATION_HEADER) - just an ID, never candidate content, so it is safe to
# log freely and is the only thing that lets a Node log line and a FastAPI log
# line for the same request be tied together by hand.
def _correlation_id(x_correlation_id: str | None = Header(default=None, alias="X-Correlation-Id")) -> str:
    return x_correlation_id or "-"

# Two module-level clients; construction is lazy inside each client, so importing
# this module never requires a key.
_llm: LLMClient = build_default_client()         # temperature=0.8  — question generation
_scoring_llm: LLMClient = build_scoring_client()  # temperature=0.0  — scoring & report


def get_svar_llm() -> LLMClient:
    """FastAPI dependency: generation LLM (temperature=0.8)."""
    return _llm


def get_svar_scoring_llm() -> LLMClient:
    """FastAPI dependency: scoring LLM (temperature=0.0 — fully deterministic)."""
    return _scoring_llm


# ---- request / response models ----
class SvarTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task_type: TaskType
    level: int = Field(default=2, ge=1, le=3)
    context_previous_answer: dict | None = None
    # Domains/categories the caller has already used earlier in this candidate's
    # session, so back-to-back tasks don't land on the same theme (see
    # content.pick_domain's docstring for why that matters).
    exclude_domains: list[str] = Field(default_factory=list)
    exclude_categories: list[str] = Field(default_factory=list)
    # Admin-authored content for this task (same keys as TaskConfig — see
    # config.py). When present, no LLM call is made: the content is formatted
    # verbatim via content.build_manual_task_config().
    manual_config: dict | None = None


class SvarTaskResponse(BaseModel):
    task_type: TaskType
    time_limit_sec: int
    prompt_text: str
    reference_data: dict
    # Echoed back so the caller can accumulate its own exclude list across the
    # session without this stateless service needing to track anything.
    domain: str
    category: str
    domain_pool_size: int
    category_pool_size: int


class SvarScoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task_type: TaskType
    reference_data: dict = Field(default_factory=dict)
    submission: ResponseSubmission


class SvarScoreResponse(BaseModel):
    delivery: SpeechFeatures
    content: ContentResult


class SvarReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    records: list[TaskRecord]


@router.post("/interview/svar/task", response_model=SvarTaskResponse)
def api_svar_task(
    payload: SvarTaskRequest,
    llm: LLMClient = Depends(get_svar_llm),
    cid: str = Depends(_correlation_id),
) -> SvarTaskResponse:
    logging.info(f"[SVAR:{cid}] task task_type={payload.task_type} level={payload.level} manual={bool(payload.manual_config)}")
    if payload.manual_config:
        cfg = content.build_manual_task_config(payload.task_type, payload.level, payload.manual_config)
        return SvarTaskResponse(
            task_type=cfg.task_type,
            time_limit_sec=cfg.time_limit_sec,
            prompt_text=content.prompt_text_for(cfg),
            reference_data=content.reference_data_for(cfg),
            domain="manual",
            category="manual",
            domain_pool_size=content.domain_pool_size(),
            category_pool_size=content.category_pool_size(),
        )
    domain = content.pick_domain(payload.exclude_domains)
    category = content.pick_category(payload.exclude_categories)
    cfg = content.generate_task_config(
        llm, payload.task_type, payload.level,
        context_previous_answer=payload.context_previous_answer,
        domain=domain, category=category,
    )
    return SvarTaskResponse(
        task_type=cfg.task_type,
        time_limit_sec=cfg.time_limit_sec,
        prompt_text=content.prompt_text_for(cfg),
        reference_data=content.reference_data_for(cfg),
        domain=domain,
        category=category,
        domain_pool_size=content.domain_pool_size(),
        category_pool_size=content.category_pool_size(),
    )


@router.post("/interview/svar/score", response_model=SvarScoreResponse)
def api_svar_score(
    payload: SvarScoreRequest,
    llm: LLMClient = Depends(get_svar_scoring_llm),
    cid: str = Depends(_correlation_id),
) -> SvarScoreResponse:
    logging.info(f"[SVAR:{cid}] score task_type={payload.task_type} answer_status={payload.submission.answer_status}")
    try:
        delivery, content_result = scoring.score_task(
            llm, payload.task_type, payload.reference_data, payload.submission
        )
        return SvarScoreResponse(delivery=delivery, content=content_result)
    except Exception as exc:
        logging.warning(f"[SVAR:{cid}] Scoring fallback triggered for {payload.task_type}: {exc}")
        # Fallback to unanswered status submission if LLM scoring fails
        fallback_sub = ResponseSubmission(
            transcript=payload.submission.transcript,
            audio_duration_sec=payload.submission.audio_duration_sec,
            answer_status=payload.submission.answer_status,
        )
        try:
            delivery, content_result = scoring.score_task(
                llm, payload.task_type, payload.reference_data, fallback_sub
            )
            return SvarScoreResponse(delivery=delivery, content=content_result)
        except Exception:
            # Automated scoring failed twice (transient + retry). Do NOT fabricate
            # a plausible-looking score here - a candidate's actual performance is
            # unknown at this point. Return a zeroed, explicitly-flagged result:
            # audio_quality_flag=SCORING_UNAVAILABLE trips build_report()'s
            # existing human_review_recommended guard (scoring.py), and the notes
            # say exactly what happened rather than "Scored successfully."/
            # "Content evaluated." Mirrors the zeroed-result convention
            # score_delivery() already uses for a non-REAL_ANSWER submission.
            logging.error(f"[SVAR:{cid}] Automated scoring failed twice for {payload.task_type}; flagging for human review instead of returning a fabricated score.")
            failure_note = "Automated scoring failed for this task and could not be recovered - flagged for human review. This is not a real score."
            delivery_fallback = SpeechFeatures(
                speaking_rate_wpm=0.0,
                pause_count=0,
                pause_total_sec=0.0,
                filler_rate_per_100w=0.0,
                articulation_stability=ArticulationStability.ERRATIC,
                audio_quality_flag=AudioQualityFlag.SCORING_UNAVAILABLE,
                fluency_subscore_0_100=0,
                notes=failure_note,
            )
            # ReferenceAlignResult as generic content result fallback
            content_fallback = ReferenceAlignResult(
                task_type=payload.task_type if payload.task_type in (TaskType.READ_ALOUD, TaskType.REPEAT, TaskType.WORD_PRONUNCIATION) else TaskType.READ_ALOUD,
                completeness_0_1=0.0,
                word_accuracy_0_100=0,
                edit_distance=0,
                score_0_100=0,
                notes=failure_note,
            )
            return SvarScoreResponse(delivery=delivery_fallback, content=content_fallback)




@router.post("/interview/svar/report", response_model=Report)
def api_svar_report(
    payload: SvarReportRequest,
    llm: LLMClient = Depends(get_svar_scoring_llm),
    cid: str = Depends(_correlation_id),
) -> Report:
    logging.info(f"[SVAR:{cid}] report records={len(payload.records)}")
    # Same one-retry-then-fail-clean shape api_svar_score already uses for this
    # exact failure class (the LLM occasionally drifts off the required JSON
    # shape - e.g. "fluency" instead of "fluency_0_100", or a string where a
    # list is required). Previously this endpoint had no retry at all, so one
    # malformed response crashed the whole report generation with an
    # unhandled 500 - discovered via the report-persistence regression test,
    # not hypothesized. A clean 502 (rather than an unhandled exception) tells
    # the Node caller plainly that this attempt failed and a retry is safe -
    # getSvarReport already treats any agent failure as retry-safe, since it
    # never marks anything persisted/completed until this call succeeds.
    try:
        return scoring.build_report(llm, payload.records)
    except Exception as exc:
        logging.warning(f"[SVAR:{cid}] Report generation retry triggered: {exc}")
        try:
            return scoring.build_report(llm, payload.records)
        except Exception as exc2:
            logging.error(f"[SVAR:{cid}] Report generation failed twice: {exc2}")
            raise HTTPException(status_code=502, detail="Report generation failed - please retry.") from exc2
