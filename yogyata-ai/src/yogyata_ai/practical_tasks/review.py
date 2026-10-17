"""Convert HUMAN-reviewed results into evidence. This is the only path to verified task/portfolio evidence."""
from __future__ import annotations

from yogyata_ai.common.schemas import EvidenceRecord
from yogyata_ai.common.taxonomy import get_taxonomy

from .schemas import PracticalTask, ReviewedResult


def overall_from_review(result: ReviewedResult, task: PracticalTask | None) -> float:
    if task and result.criterion_scores:
        ids = {c.id: c.weight for c in task.rubric}
        unknown = [k for k in result.criterion_scores if k not in ids]
        if unknown:
            raise ValueError("unknown rubric criteria: " + ", ".join(unknown))
        w = sum(ids[k] for k in result.criterion_scores)
        return round(sum(ids[k] * v for k, v in result.criterion_scores.items()) / w, 3)
    if result.overall is None:
        raise ValueError("a reviewed result needs 'overall' (or criterion_scores together with a known task)")
    return result.overall


def evidence_from_review(result: ReviewedResult, task: PracticalTask | None = None) -> list[EvidenceRecord]:
    if result.kind == "task" and task is None and not result.skills:
        raise ValueError("task reviews need the task (or explicit skills) to know which skills were assessed")
    skills = result.skills or (task.skills if task else [])
    tax = get_taxonomy()
    canon = []
    for s in skills:
        c = tax.canonical(s)
        if c is None:
            raise ValueError(f"unknown skill '{s}'")
        canon.append(c)
    strength = overall_from_review(result, task)
    source = "task_review" if result.kind == "task" else "portfolio_review"
    return [EvidenceRecord(skill=s, source=source, strength=strength, ref_id=f"{result.item_id}:{result.reviewer_id}",
                           note="human-reviewed") for s in dict.fromkeys(canon)]


def submission_from_reviewed_result(result: ReviewedResult, task: PracticalTask | None = None, *, review_id: str | None = None,
                                    reason: str | None = None) -> dict:
    """ReviewedResult -> skill_gap.submit_review submission (so task/portfolio reviews use the readiness cap, duplicate
    protection and audit trail). Defaults keep old callers working: review_id = kind:item:reviewer, reason = the comment."""
    recs = evidence_from_review(result, task)
    return {"review_id": review_id or f"{result.kind}:{result.item_id}:{result.reviewer_id}", "reviewer_id": result.reviewer_id,
            "kind": result.kind, "item_id": result.item_id, "skills": [r.skill for r in recs], "score": recs[0].strength,
            "reason": reason or result.comment or "human review recorded by the review pipeline"}
