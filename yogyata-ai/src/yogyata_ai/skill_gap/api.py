"""Public integration surface for skill-gap analysis.

Integrity note for the backend: records with sources task_review / interview_review / portfolio_review
count as VERIFIED. Only pass such records when they come from your human-review pipeline.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from yogyata_ai.common.evidence import EvidenceConfig
from yogyata_ai.common.schemas import EvidenceRecord, StudentProfile
from yogyata_ai.interview.schemas import AnswerEvaluation
from yogyata_ai.interview.selection import evaluations_to_attempts, evaluations_to_evidence

from .analysis import analyze_gap, compare_reports
from .merge import merge_evidence  # noqa: F401  (re-exported: public API)
from .review import ReviewConfig, ReviewLedger, apply_review, ledger_notes
from .roles import RoleCatalog, default_catalog
from .schemas import GapReport


class _GapInput(BaseModel):
    profile: StudentProfile
    role_id: str | None = None
    interview_evaluations: list[AnswerEvaluation] = Field(default_factory=list)
    extra_evidence: list[EvidenceRecord] = Field(default_factory=list)
    top_n: int = Field(8, ge=1, le=50)
    review_ledger: ReviewLedger | None = Field(None, description="Human-review ledger returned by submit_review (persisted by the backend)")
    as_of: str | None = Field(None, description="Reference date (ISO) for evidence freshness checks; omit to skip them")
    stale_after_days: int | None = Field(None, gt=0)
    conflict_spread: float | None = Field(None, gt=0, le=1)


def analyze_skill_gap(payload: dict[str, Any], *, catalog: RoleCatalog | None = None) -> dict[str, Any]:
    """payload: {"profile", "role_id"?, "interview_evaluations"?, "extra_evidence"?, "top_n"?} -> GapReport dict."""
    d = _GapInput(**payload)
    catalog = catalog or default_catalog()
    role_id = d.role_id or d.profile.target_role
    if not role_id:
        raise ValueError("role_id is required (or set profile.target_role)")
    role = catalog.get(role_id)
    if d.review_ledger is not None:
        from yogyata_ai.common.audit import assert_intact
        assert_intact(d.review_ledger.audit)
    profile = merge_evidence(d.profile, d.interview_evaluations, d.extra_evidence, d.review_ledger)
    cfg = EvidenceConfig(**{k: v for k, v in (("stale_after_days", d.stale_after_days), ("conflict_spread", d.conflict_spread)) if v is not None})
    report = analyze_gap(profile, role, top_n=d.top_n, config=cfg, as_of=d.as_of)
    report.notes.extend(ledger_notes(d.review_ledger))
    return report.model_dump(mode="json")


def submit_review(payload: dict[str, Any], review: dict[str, Any], *, ledger: dict[str, Any] | ReviewLedger | None = None,
                  max_readiness_increase: float | None = None, authorized_reviewers: list[str] | None = None,
                  now: str | None = None, catalog: RoleCatalog | None = None) -> dict[str, Any]:
    """Apply ONE human review under the readiness cap (see skill_gap/review.py).

    payload: the same dict you pass to analyze_skill_gap (without review_ledger). ledger: the ledger returned by the
    previous call (persist it; the audit log inside is hash-chained and append-only). Returns
    {"status": "applied"|"duplicate", "applied", "review", "ledger", "readiness_increase", "cap", "readiness"}.
    """
    base = ReviewConfig.from_env()
    cfg = ReviewConfig(
        max_readiness_increase=base.max_readiness_increase if max_readiness_increase is None else max_readiness_increase,
        authorized_reviewers=frozenset(authorized_reviewers) if authorized_reviewers is not None else base.authorized_reviewers)
    lg = ledger if isinstance(ledger, ReviewLedger) or ledger is None else ReviewLedger(**ledger)
    clean = {k: v for k, v in payload.items() if k != "review_ledger"}
    out = apply_review(clean, review, lg, config=cfg, now=now, catalog=catalog)
    out["ledger"] = out["ledger"].model_dump(mode="json")
    return out


def reassess(payload: dict[str, Any], new_evidence: list[dict[str, Any]], *,
             catalog: RoleCatalog | None = None) -> dict[str, Any]:
    """Re-run the analysis with additional evidence and report what changed."""
    before = analyze_skill_gap(payload, catalog=catalog)
    merged = dict(payload)
    merged["extra_evidence"] = [*payload.get("extra_evidence", []), *new_evidence]
    after = analyze_skill_gap(merged, catalog=catalog)
    diff = compare_reports(GapReport(**before), GapReport(**after))
    return {"before": before, "after": after, "changes": diff}


def list_roles(*, catalog: RoleCatalog | None = None) -> list[dict[str, Any]]:
    catalog = catalog or default_catalog()
    return [{"id": r.id, "title": r.title, "skills": [s.skill for s in r.skills]} for r in catalog.roles.values()]


def submit_interview_review(payload: dict[str, Any], evaluation: dict[str, Any], override: dict[str, Any], *,
                            ledger: dict[str, Any] | ReviewLedger | None = None, max_readiness_increase: float | None = None,
                            authorized_reviewers: list[str] | None = None, now: str | None = None,
                            catalog: RoleCatalog | None = None) -> dict[str, Any]:
    """Reviewer overrides an automated interview assessment.

    1. interview.review_interview builds the record (original automated + reviewed result; originals are never erased).
    2. The result is applied to readiness through submit_review, so the per-review readiness cap, duplicate protection and
       audit trail apply. Returns {"interview_review": <record>, **submit_review result}.
    Only technical interviews map to skills; an HR interview review is recorded but gives no skill evidence.
    """
    from yogyata_ai.interview.bank import default_bank
    from yogyata_ai.interview.review import review_interview

    rec = review_interview(evaluation, override, authorized_reviewers=authorized_reviewers, now=now)
    if rec.interview_type != "technical":
        raise ValueError("only technical interview reviews map to skills; HR reviews are not applied to readiness")
    q = default_bank().get(rec.question_id)
    if q is None or not q.skills:
        raise ValueError(f"question '{rec.question_id}' has no mapped skills")
    sub: dict[str, Any] = {
        "review_id": rec.review_id, "reviewer_id": rec.reviewer_id, "kind": "interview", "item_id": rec.attempt_id,
        "skills": list(q.skills), "reason": rec.reason, "reviewed_at": rec.reviewed_at, "attempt_id": rec.attempt_id,
        "question_id": rec.question_id, "original_automated_score": round(rec.original.overall / 100, 6)}
    if rec.status == "human_invalidated":
        sub["invalidate"] = True
    else:
        sub["score"] = round(rec.reviewed.overall / 100, 6)
    prior = ledger if isinstance(ledger, ReviewLedger) or ledger is None else ReviewLedger(**ledger)
    # a second override of the same attempt by the same reviewer replaces the first one
    if prior is not None:
        old = next((r for r in prior.active() if (r.reviewer_id, r.kind, r.item_id) == (rec.reviewer_id, "interview", rec.attempt_id)
                    and r.review_id != rec.review_id), None)
        same = old is not None and old.invalidated == bool(sub.get("invalidate")) and \
            (old.invalidated or abs((old.original_score or 0) - sub["score"]) < 1e-9) and set(old.skills) == set(sub["skills"])
        if old is not None and not same:   # identical content is left for duplicate detection (no-op)
            sub["supersedes"] = old.review_id
    out = submit_review(payload, sub, ledger=prior, max_readiness_increase=max_readiness_increase,
                        authorized_reviewers=authorized_reviewers, now=now, catalog=catalog)
    return {"interview_review": rec.model_dump(mode="json"), **out}
