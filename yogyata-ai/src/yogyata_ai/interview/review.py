"""Reviewer override of an automated interview assessment.

The automated result is never edited or erased. A human review is stored NEXT TO it:
  original (automated, status "automated_unverified")  +  reviewed (human)  ->  `final` used downstream.
Review decisions: "confirm" (reviewer agrees; the automated score stands but becomes human-confirmed), "adjust" (reviewer
replaces the score and, optionally, per-dimension scores) and "invalidate" (the automated result is unusable and must not
count as evidence). Statuses: automated_unverified | human_confirmed | human_adjusted | human_invalidated.

Authorization is the backend's job (authenticate the reviewer, pass only reviewers allowed to review). When an
`authorized_reviewers` allow-list is passed it is enforced here as well. Nothing is stored by this module.
To turn a review into readiness evidence under the per-review cap use `skill_gap.api.submit_interview_review`.
"""
from __future__ import annotations

import datetime as dt
import math
import re
from typing import Iterable, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from yogyata_ai.common.audit import sanitize_reason
from yogyata_ai.common.schemas import parse_timestamp

from .schemas import HR_DIMENSIONS, TECH_DIMENSIONS, AnswerEvaluation
from .selection import STRONG_FROM, WEAK_BELOW

ReviewStatus = Literal["automated_unverified", "human_confirmed", "human_adjusted", "human_invalidated"]
_ID = re.compile(r"^[\w.:@/\-]{1,128}$")


def assessment_label(overall: float | None) -> str:
    """Band used for 'assessment' text: strong >= 70, weak < 50, otherwise developing (same bands as topic performance)."""
    if overall is None:
        return "unusable"
    return "strong" if overall >= STRONG_FROM else "weak" if overall < WEAK_BELOW else "developing"


def _num100(v, what):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= 100:
        raise ValueError(f"{what} must be a finite number between 0 and 100")
    return float(v)


class InterviewOverride(BaseModel):
    """Reviewer input."""
    model_config = ConfigDict(extra="forbid")

    review_id: str
    reviewer_id: str
    attempt_id: str
    decision: Literal["confirm", "adjust", "invalidate"]
    reason: str
    reviewed_overall: float | None = Field(None, description="0-100; required for 'adjust'")
    reviewed_scores: dict[str, float] | None = Field(None, description="Optional per-dimension scores 0-100 (adjust only)")
    reviewer_comment: str = Field("", max_length=300)
    reviewed_at: str | None = None

    @field_validator("review_id", "reviewer_id", "attempt_id")
    @classmethod
    def _ids(cls, v):
        if not _ID.match(v):
            raise ValueError("identifiers must be 1-128 characters of letters, digits and . : @ / - _")
        return v

    @field_validator("reviewed_overall", mode="before")
    @classmethod
    def _ov(cls, v):
        return None if v is None else _num100(v, "reviewed_overall")

    @field_validator("reviewed_scores", mode="before")
    @classmethod
    def _sc(cls, v):
        return None if v is None else {str(k): _num100(x, f"score for '{k}'") for k, x in v.items()}

    @field_validator("reason")
    @classmethod
    def _reason(cls, v):
        r = sanitize_reason(v)
        if len(r) < 3:
            raise ValueError("a reason of at least 3 characters is required")
        return r

    @field_validator("reviewer_comment")
    @classmethod
    def _comment(cls, v):
        from yogyata_ai.common.safety import redact_pii
        return redact_pii(" ".join(v.split()))

    @field_validator("reviewed_at")
    @classmethod
    def _ts(cls, v):
        if v in (None, ""):
            return None
        parse_timestamp(v)
        return v

    @model_validator(mode="after")
    def _rules(self):
        if self.decision == "adjust" and self.reviewed_overall is None:
            raise ValueError("reviewed_overall is required when decision='adjust'")
        if self.decision != "adjust" and (self.reviewed_overall is not None or self.reviewed_scores):
            raise ValueError("scores may only be supplied with decision='adjust'")
        return self


class AssessmentSnapshot(BaseModel):
    overall: float | None
    scores: dict[str, float] = Field(default_factory=dict)
    assessment: str
    confidence: str | None = None
    evaluator: str | None = None
    status: ReviewStatus


class InterviewReviewRecord(BaseModel):
    """Automated and human results side by side. `final` says which one downstream modules use."""
    review_id: str
    attempt_id: str
    question_id: str
    interview_type: str
    topic: str
    reviewer_id: str
    decision: str
    status: ReviewStatus
    original: AssessmentSnapshot
    reviewed: AssessmentSnapshot
    reason: str
    reviewer_comment: str = ""
    reviewed_at: str
    final_source: Literal["human_reviewed"] = "human_reviewed"

    @property
    def final_overall(self) -> float | None:
        return self.reviewed.overall


def review_interview(evaluation: AnswerEvaluation | dict, override: InterviewOverride | dict, *,
                     authorized_reviewers: Iterable[str] | None = None, now: str | None = None) -> InterviewReviewRecord:
    """Validate a reviewer override against the automated evaluation and return the combined record."""
    ev = evaluation if isinstance(evaluation, AnswerEvaluation) else AnswerEvaluation(**evaluation)
    ov = override if isinstance(override, InterviewOverride) else InterviewOverride(**override)
    if authorized_reviewers is not None and ov.reviewer_id not in set(authorized_reviewers):
        raise PermissionError("reviewer is not authorized to review interview assessments")
    if ev.attempt_id is not None and ev.attempt_id != ov.attempt_id:
        raise ValueError("override attempt_id does not match the evaluation's attempt_id")
    now_ts = parse_timestamp(now) if now else dt.datetime.now(dt.timezone.utc)
    reviewed_at = ov.reviewed_at or now_ts.replace(microsecond=0).isoformat()
    if parse_timestamp(reviewed_at) > now_ts + dt.timedelta(days=1):
        raise ValueError("reviewed_at is in the future")
    dims = HR_DIMENSIONS if ev.interview_type == "hr" else TECH_DIMENSIONS
    original = AssessmentSnapshot(overall=ev.overall, scores=dict(ev.scores), assessment=assessment_label(ev.overall),
                                  confidence=ev.confidence, evaluator=ev.evaluator, status="automated_unverified")
    if ov.decision == "confirm":
        status, rev = "human_confirmed", AssessmentSnapshot(overall=ev.overall, scores=dict(ev.scores), assessment=assessment_label(ev.overall), status="human_confirmed")
    elif ov.decision == "invalidate":
        status, rev = "human_invalidated", AssessmentSnapshot(overall=None, scores={}, assessment="unusable", status="human_invalidated")
    else:
        bad = [k for k in (ov.reviewed_scores or {}) if k not in dims]
        if bad:
            raise ValueError(f"unknown dimension(s) for a {ev.interview_type} interview: {', '.join(bad)}")
        if abs(ov.reviewed_overall - ev.overall) < 1e-9 and not ov.reviewed_scores:
            raise ValueError("reviewed_overall equals the automated score; use decision='confirm'")
        status = "human_adjusted"
        rev = AssessmentSnapshot(overall=ov.reviewed_overall, scores={**ev.scores, **(ov.reviewed_scores or {})},
                                 assessment=assessment_label(ov.reviewed_overall), status="human_adjusted")
    return InterviewReviewRecord(
        review_id=ov.review_id, attempt_id=ov.attempt_id, question_id=ev.question_id, interview_type=ev.interview_type,
        topic=ev.topic, reviewer_id=ov.reviewer_id, decision=ov.decision, status=status, original=original, reviewed=rev,
        reason=ov.reason, reviewer_comment=ov.reviewer_comment, reviewed_at=reviewed_at)


def final_result(evaluation: AnswerEvaluation, review: InterviewReviewRecord | None) -> dict:
    """The result downstream code should use: the human review when there is one, otherwise the automated result.

    Always returns both, so the original automated assessment stays visible.
    """
    auto = {"overall": evaluation.overall, "assessment": assessment_label(evaluation.overall), "status": "automated_unverified"}
    if (review is None or review.attempt_id != (evaluation.attempt_id or review.attempt_id)
            or review.question_id != evaluation.question_id):
        return {"source": "automated", "overall": auto["overall"], "assessment": auto["assessment"], "status": auto["status"],
                "original_automated": auto, "review": None}
    return {"source": "human_reviewed", "overall": review.reviewed.overall, "assessment": review.reviewed.assessment,
            "status": review.status, "original_automated": auto, "review": review.review_id}
