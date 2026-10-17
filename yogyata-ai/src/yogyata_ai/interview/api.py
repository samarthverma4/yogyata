"""Public integration surface for the mock-interview module (JSON-compatible dicts in and out).

History persistence is the backend's job: store the `history_item` returned by `evaluate` and pass
the accumulated list back into the other functions.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from yogyata_ai.common.llm import LLMAdapter

from .bank import QuestionBank, default_bank
from .evaluator import evaluate_answer
from .llm_evaluator import evaluate_with_llm
from .review import InterviewReviewRecord, final_result, review_interview
from .schemas import AnswerEvaluation, AnswerInput, HistoryItem
from .selection import (
    evaluation_to_history_item, evaluations_to_evidence, recommend_practice, select_next_question,
    summarize_topic_performance,
)


class _NextInput(BaseModel):
    role: str | None = None
    interview_type: str = "technical"
    history: list[HistoryItem] = Field(default_factory=list)


class _HistoryInput(BaseModel):
    history: list[HistoryItem] = Field(default_factory=list)
    interview_type: str | None = None


class _EvalListInput(BaseModel):
    evaluations: list[AnswerEvaluation]


def _public(q) -> dict:
    """Student-facing view: never includes reference answers or rubric internals."""
    return {"id": q.id, "type": q.type, "topic": q.topic, "difficulty": q.difficulty, "text": q.text}


def list_questions(payload: dict[str, Any] | None = None, *, bank: QuestionBank | None = None) -> list[dict]:
    p = payload or {}
    bank = bank or default_bank()
    qs = bank.filter(interview_type=p.get("interview_type"), role=p.get("role"))
    if p.get("topic"):
        qs = [q for q in qs if q.topic == p["topic"]]
    return [_public(q) for q in qs]


def next_question(payload: dict[str, Any], *, bank: QuestionBank | None = None) -> dict | None:
    d = _NextInput(**payload)
    sel = select_next_question(d.role, d.interview_type, d.history, bank)
    if sel is None:
        return None
    return {"question": _public(sel.question), "reason": sel.reason, "target_difficulty": sel.target_difficulty}


def evaluate(payload: dict[str, Any], *, llm: LLMAdapter | None = None, bank: QuestionBank | None = None) -> dict:
    """payload: {"question_id", "answer_text"}. Pass `llm` to enable the optional LLM layer."""
    d = AnswerInput(**payload)
    bank = bank or default_bank()
    q = bank.get(d.question_id)
    if q is None:
        raise ValueError(f"unknown question_id: {d.question_id}")
    ev = evaluate_with_llm(q, d.answer_text, llm) if llm is not None else evaluate_answer(q, d.answer_text)
    return {"evaluation": ev.model_dump(mode="json"),
            "history_item": evaluation_to_history_item(ev).model_dump(mode="json")}


def topic_performance(payload: dict[str, Any]) -> list[dict]:
    d = _HistoryInput(**payload)
    return [t.model_dump(mode="json") for t in summarize_topic_performance(d.history)]


def practice_plan(payload: dict[str, Any], *, bank: QuestionBank | None = None) -> dict:
    d = _HistoryInput(**payload)
    return recommend_practice(d.history, bank, interview_type=d.interview_type)


def evidence_from_evaluations(payload: dict[str, Any], *, bank: QuestionBank | None = None) -> list[dict]:
    d = _EvalListInput(**payload)
    return [e.model_dump(mode="json") for e in evaluations_to_evidence(d.evaluations, bank)]


def review_evaluation(payload: dict[str, Any]) -> dict:
    """payload: {"evaluation": <AnswerEvaluation dict>, "override": <InterviewOverride dict>, "authorized_reviewers"?: [ids], "now"?}.

    Returns the stored-side record (original automated + human result). It does NOT change readiness; use
    skill_gap.submit_interview_review to apply it under the readiness cap.
    """
    rec = review_interview(payload["evaluation"], payload["override"], authorized_reviewers=payload.get("authorized_reviewers"),
                           now=payload.get("now"))
    return rec.model_dump(mode="json")


def final_interview_result(payload: dict[str, Any]) -> dict:
    """payload: {"evaluation", "review"?: <InterviewReviewRecord dict>} -> the result downstream code should use."""
    ev = AnswerEvaluation(**payload["evaluation"])
    rv = payload.get("review")
    return final_result(ev, InterviewReviewRecord(**rv) if rv else None)
