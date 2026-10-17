"""Public integration surface for practical tasks. Tasks are supplied/curated by the platform; nothing is stored here."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from yogyata_ai.skill_gap.api import _GapInput, merge_evidence
from yogyata_ai.skill_gap.roles import RoleCatalog, default_catalog

from .catalog import TaskCatalog, default_task_catalog
from .evaluate import evaluate_submission
from .interpret import interpret_task_description
from .portfolio import analyze_portfolio_item
from .recommend import recommend_tasks
from .review import evidence_from_review
from .schemas import PracticalTask, ReviewedResult


def list_tasks(*, catalog: TaskCatalog | None = None) -> list[dict[str, Any]]:
    return [t.model_dump(mode="json") for t in (catalog or default_task_catalog()).tasks.values()]


class _RecInput(_GapInput):
    limit: int = Field(5, ge=1, le=50)
    completed_task_ids: list[str] = Field(default_factory=list)


def recommend(payload: dict[str, Any], *, roles: RoleCatalog | None = None, catalog: TaskCatalog | None = None) -> dict[str, Any]:
    d = _RecInput(**payload)
    role_id = d.role_id or d.profile.target_role
    if not role_id:
        raise ValueError("role_id is required (or set profile.target_role)")
    role = (roles or default_catalog()).get(role_id)
    profile = merge_evidence(d.profile, d.interview_evaluations, d.extra_evidence, d.review_ledger)
    return recommend_tasks(profile, role, catalog or default_task_catalog(), limit=d.limit,
                           completed_task_ids=d.completed_task_ids).model_dump(mode="json")


def evaluate(task_id_or_task: str | dict[str, Any], submission_text: str, *, emit_evidence: bool = False,
             catalog: TaskCatalog | None = None) -> dict[str, Any]:
    task = (PracticalTask(**task_id_or_task) if isinstance(task_id_or_task, dict)
            else (catalog or default_task_catalog()).get(task_id_or_task))
    return evaluate_submission(task, submission_text, emit_evidence=emit_evidence).model_dump(mode="json")


def interpret(text: str, *, title: str | None = None) -> dict[str, Any]:
    return interpret_task_description(text, title=title)


def record_review(result: dict[str, Any], *, catalog: TaskCatalog | None = None) -> list[dict[str, Any]]:
    """Turn a HUMAN reviewer's result into evidence records. Call only from your authenticated review workflow."""
    r = ReviewedResult(**result)
    task = None
    if r.kind == "task":
        cat = catalog or default_task_catalog()
        task = cat.tasks.get(r.item_id)
        if task is None and not r.skills:
            raise ValueError(f"unknown task '{r.item_id}'; provide 'skills' to review a task outside the catalog")
    return [e.model_dump(mode="json") for e in evidence_from_review(r, task)]


def review_submission(result: dict[str, Any], *, catalog: TaskCatalog | None = None, review_id: str | None = None,
                      reason: str | None = None) -> dict[str, Any]:
    """Human-reviewed task/portfolio result -> a submission for skill_gap.submit_review (readiness cap + audit trail)."""
    from .review import submission_from_reviewed_result
    r = ReviewedResult(**result)
    task = None
    if r.kind == "task":
        task = (catalog or default_task_catalog()).tasks.get(r.item_id)
        if task is None and not r.skills:
            raise ValueError(f"unknown task '{r.item_id}'; provide 'skills' to review a task outside the catalog")
    return submission_from_reviewed_result(r, task, review_id=review_id, reason=reason)


def portfolio_feedback(text: str) -> dict[str, Any]:
    return analyze_portfolio_item(text)
