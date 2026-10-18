"""Human-review ledger with a configurable cap on how much ONE review can raise readiness.

How the cap works (all deterministic)
  * Readiness is the role readiness score (0-100, `readiness_exact`). For a submitted review we compute the readiness
    before and after adding the review evidence, for EVERY role in the catalog, and take the largest increase.
  * If that increase is <= `max_readiness_increase` (default 10.0 points, configurable) the review is applied as submitted.
    Otherwise the applied strength is lowered (bisection, floored to 3 decimals) to the highest value whose largest
    increase is still <= the cap. The reviewer's submitted score is never changed or hidden: the ledger stores
    `original_score`, `applied_score`, `applied_adjustment` (applied - original, <= 0), the reason and the cap used.
  * Only INCREASES are capped. A review that lowers readiness is applied in full. Readiness always stays in [0, 100].
  * The cap is evaluated at submission time against the evidence known then; later submissions are not re-capped.
    Several reviews can add up over time (each one is bounded), which is intended: the cap limits one reviewer's
    single judgement, not accumulated verified evidence.
Duplicates: the same review_id (or the same reviewer + item + skills + score) never applies twice; re-sending is a
no-op that reports status "duplicate". A changed score from the same reviewer on the same item must name the review it
`supersedes`; the old review is kept (status "superseded") and no longer counts.
Nothing here stores data: the backend persists the returned `ReviewLedger` (reviews + hash-chained audit log).
"""
from __future__ import annotations

import datetime as dt
import hashlib
import math
import os
import re
from dataclasses import dataclass
from typing import Any, Iterable, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from yogyata_ai.common.audit import AuditLog, AuditValue, append_event, assert_intact, sanitize_reason
from yogyata_ai.common.evidence import EvidenceConfig, level_of, summarize_evidence
from yogyata_ai.common.schemas import EvidenceRecord, StudentProfile, parse_timestamp
from yogyata_ai.common.taxonomy import get_taxonomy

from .analysis import readiness_exact
from .merge import merge_evidence
from .roles import RoleCatalog, default_catalog

DEFAULT_MAX_READINESS_INCREASE = 10.0   # configurable default (points on the 0-100 scale), not a measured value
ReviewKind = Literal["task", "portfolio", "interview"]
SOURCE_OF = {"task": "task_review", "portfolio": "portfolio_review", "interview": "interview_review"}
_ID = re.compile(r"^[\w.:@/\-]{1,128}$")


@dataclass(frozen=True)
class ReviewConfig:
    max_readiness_increase: float = DEFAULT_MAX_READINESS_INCREASE
    authorized_reviewers: frozenset[str] | None = None   # None = backend authenticates; set = allow-list enforced here

    def __post_init__(self):
        v = self.max_readiness_increase
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= 100:
            raise ValueError("max_readiness_increase must be a number between 0 and 100")

    @classmethod
    def from_env(cls) -> "ReviewConfig":
        try:
            cap = float(os.getenv("YOGYATA_MAX_READINESS_INCREASE_PER_REVIEW", DEFAULT_MAX_READINESS_INCREASE))
            cls(max_readiness_increase=cap)
        except ValueError:
            cap = DEFAULT_MAX_READINESS_INCREASE
        raw = os.getenv("YOGYATA_AUTHORIZED_REVIEWERS", "").strip()
        allow = frozenset(x.strip() for x in raw.split(",") if x.strip()) if raw else None
        return cls(max_readiness_increase=cap, authorized_reviewers=allow)


def _score(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise ValueError("score must be a number between 0 and 1")
    if not math.isfinite(v) or not 0 <= v <= 1:
        raise ValueError("score must be a finite number between 0 and 1")
    return float(v)


class ReviewSubmission(BaseModel):
    """What a human reviewer submits. `score` is on the 0-1 evidence scale (interview 0-100 scores: divide by 100)."""
    model_config = ConfigDict(extra="forbid")

    review_id: str = Field(..., description="Unique id chosen by the backend; the idempotency key")
    reviewer_id: str = Field(..., description="Opaque id of the authenticated reviewer")
    kind: ReviewKind
    item_id: str = Field(..., description="Task / portfolio item / interview assessment id")
    skills: list[str] = Field(..., min_length=1)
    score: float | None = Field(None, description="0-1; omit only when invalidate=True")
    invalidate: bool = Field(False, description="Interview reviews only: the automated result is unusable and must not count")
    reason: str = Field(..., description="Why this score (required, max 300 chars, e-mails/phones redacted)")
    reviewed_at: str | None = None
    supersedes: str | None = None
    original_automated_score: float | None = Field(None, description="Interview overrides: the automated score being replaced (0-1)")
    attempt_id: str | None = None
    question_id: str | None = None

    @field_validator("review_id", "reviewer_id", "item_id", "supersedes", "attempt_id", "question_id")
    @classmethod
    def _ids(cls, v):
        if v is not None and not _ID.match(v):
            raise ValueError("identifiers must be 1-128 characters of letters, digits and . : @ / - _")
        return v

    @field_validator("score")
    @classmethod
    def _sc(cls, v):
        return None if v is None else _score(v)

    @field_validator("original_automated_score")
    @classmethod
    def _osc(cls, v):
        return None if v is None else _score(v)

    @field_validator("score", "original_automated_score", mode="before")
    @classmethod
    def _no_str(cls, v):
        if isinstance(v, (bool, str)):
            raise ValueError("score must be a number")
        return v

    @field_validator("reason")
    @classmethod
    def _reason(cls, v):
        r = sanitize_reason(v)
        if len(r) < 3:
            raise ValueError("a reason of at least 3 characters is required")
        return r

    @field_validator("reviewed_at")
    @classmethod
    def _ts(cls, v):
        if v in (None, ""):
            return None
        parse_timestamp(v)
        return v

    @model_validator(mode="after")
    def _consistent(self):
        if self.invalidate:
            if self.kind != "interview":
                raise ValueError("only interview results can be invalidated")
            if self.score is not None:
                raise ValueError("do not send a score when invalidate=True")
        elif self.score is None:
            raise ValueError("score is required")
        return self

    @field_validator("skills")
    @classmethod
    def _skills(cls, v):
        tax = get_taxonomy()
        out = []
        for s in v:
            c = tax.canonical(s)
            if c is None:
                raise ValueError(f"unknown skill '{s}'")
            out.append(c)
        return list(dict.fromkeys(out))


class ReviewRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    review_id: str
    reviewer_id: str
    kind: ReviewKind
    item_id: str
    skills: list[str]
    reason: str
    reviewed_at: str
    original_score: float | None = Field(None, description="Score the reviewer submitted (None when the result was invalidated)")
    applied_score: float | None = Field(None, description="Score actually used as evidence after the cap (None when invalidated)")
    applied_adjustment: float = Field(0.0, description="applied_score - original_score (<= 0: the cap only ever lowers)")
    invalidated: bool = False
    cap_applied: bool
    max_increase_used: float
    binding_role: str | None = Field(None, description="Role with the largest readiness increase (None if no role changed)")
    readiness_before: float | None = None
    readiness_after: float | None = None
    original_automated_score: float | None = None
    attempt_id: str | None = None
    question_id: str | None = None
    supersedes: str | None = None
    superseded_by: str | None = None
    status: Literal["applied", "superseded"] = "applied"
    fingerprint: str


class ReviewLedger(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reviews: list[ReviewRecord] = Field(default_factory=list)
    audit: AuditLog = Field(default_factory=AuditLog)

    def active(self) -> list[ReviewRecord]:
        return [r for r in self.reviews if r.status == "applied"]

    def get(self, review_id: str) -> ReviewRecord | None:
        return next((r for r in self.reviews if r.review_id == review_id), None)

    def evidence_records(self) -> list[EvidenceRecord]:
        """Reviewed evidence at the APPLIED strength; superseded reviews are excluded."""
        return [EvidenceRecord(skill=s, source=SOURCE_OF[r.kind], strength=r.applied_score, ref_id=f"review:{r.review_id}",
                               note="human-reviewed" + (" (capped)" if r.cap_applied else ""), assessed_at=r.reviewed_at,
                               capped_from=r.original_score if r.cap_applied else None)
                for r in self.active() if not r.invalidated for s in r.skills]


def _fingerprint(sub: ReviewSubmission) -> str:
    sc = "invalidated" if sub.invalidate else f"{sub.score:.6f}"
    raw = "|".join([sub.reviewer_id, sub.kind, sub.item_id, ",".join(sorted(sub.skills)), sc, sub.supersedes or ""])
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _readiness_by_role(profile: StudentProfile, catalog: RoleCatalog, ecfg: EvidenceConfig | None, as_of) -> dict[str, float]:
    return {rid: readiness_exact(profile, role, config=ecfg, as_of=as_of) for rid, role in sorted(catalog.roles.items())}


def _skill_values(profile: StudentProfile, skills: list[str], ecfg, as_of) -> dict[str, AuditValue]:
    s = summarize_evidence(profile, config=ecfg, as_of=as_of)
    return {k: AuditValue(state=level_of(s, k).state, score=level_of(s, k).strength) for k in skills}


def _outcome(status: str, ledger: ReviewLedger, record: ReviewRecord | None, **extra) -> dict[str, Any]:
    return {"status": status, "applied": status == "applied", "review": record.model_dump(mode="json") if record else None,
            "ledger": ledger, **extra}


def apply_review(payload: dict[str, Any], review: ReviewSubmission | dict[str, Any], ledger: ReviewLedger | None = None, *,
                 config: ReviewConfig | None = None, catalog: RoleCatalog | None = None, now: str | None = None,
                 evidence_config: EvidenceConfig | None = None, as_of=None) -> dict[str, Any]:
    """Validate and apply ONE human review. Returns {"status": "applied"|"duplicate", "review", "ledger", ...}.

    `payload` is the skill-gap payload ({"profile", "interview_evaluations"?, "extra_evidence"?}); the ledger is separate.
    Raises ValueError (invalid input / conflicting review) or PermissionError (reviewer not on the allow-list).
    The input ledger is never mutated.
    """
    cfg = config or ReviewConfig.from_env()
    sub = review if isinstance(review, ReviewSubmission) else ReviewSubmission(**review)
    ledger = ledger or ReviewLedger()
    assert_intact(ledger.audit)
    if cfg.authorized_reviewers is not None and sub.reviewer_id not in cfg.authorized_reviewers:
        raise PermissionError("reviewer is not authorized to submit reviews")
    now_ts = parse_timestamp(now) if now else dt.datetime.now(dt.timezone.utc)
    now_s = now_ts.replace(microsecond=0).isoformat()
    reviewed_at = sub.reviewed_at or now_s
    if parse_timestamp(reviewed_at) > now_ts + dt.timedelta(days=1):
        raise ValueError("reviewed_at is in the future")

    fp = _fingerprint(sub)
    existing = ledger.get(sub.review_id)
    if existing is not None:
        if existing.fingerprint == fp:
            return _outcome("duplicate", ledger, existing, duplicate_of=existing.review_id)
        raise ValueError(f"review_id '{sub.review_id}' was already used for a different review")
    twin = next((r for r in ledger.active() if r.fingerprint == fp), None)
    if twin is not None:
        return _outcome("duplicate", ledger, twin, duplicate_of=twin.review_id)
    if sub.supersedes is not None:
        old = ledger.get(sub.supersedes)
        if old is None or old.status != "applied":
            raise ValueError("supersedes must name an existing, still-active review")
        if old.reviewer_id != sub.reviewer_id:
            raise ValueError("only the original reviewer can supersede a review")
        if old.kind != sub.kind or old.item_id != sub.item_id:
            raise ValueError("a review can only supersede a review of the same item")
        if old.invalidated == sub.invalidate and old.original_score == sub.score and set(old.skills) == set(sub.skills):
            return _outcome("duplicate", ledger, old, duplicate_of=old.review_id)   # re-sending the same judgement is not a revision
    else:
        clash = next((r for r in ledger.active() if (r.reviewer_id, r.kind, r.item_id) == (sub.reviewer_id, sub.kind, sub.item_id)), None)
        if clash is not None:
            raise ValueError(f"reviewer already reviewed this item (review '{clash.review_id}'); "
                             "set supersedes to replace it, or resend the identical review for a no-op")

    catalog = catalog or default_catalog()
    d_profile = payload.get("profile", {})
    base = d_profile if isinstance(d_profile, StudentProfile) else StudentProfile(**d_profile)
    from yogyata_ai.interview.schemas import AnswerEvaluation
    evals = [e if isinstance(e, AnswerEvaluation) else AnswerEvaluation(**e) for e in payload.get("interview_evaluations", [])]
    extra = [e if isinstance(e, EvidenceRecord) else EvidenceRecord(**e) for e in payload.get("extra_evidence", [])]

    def build(applied: float | None) -> tuple[StudentProfile, ReviewLedger]:
        revs = [r.model_copy(update={"status": "superseded", "superseded_by": sub.review_id}) if r.review_id == sub.supersedes else r
                for r in ledger.reviews]
        revs.append(_record(applied))
        lg = ReviewLedger(reviews=revs, audit=ledger.audit)
        return merge_evidence(base, evals, extra, lg), lg

    def _record(applied: float | None, **kw) -> ReviewRecord:
        inv = sub.invalidate
        return ReviewRecord(
            review_id=sub.review_id, reviewer_id=sub.reviewer_id, kind=sub.kind, item_id=sub.item_id, skills=sub.skills,
            reason=sub.reason, reviewed_at=reviewed_at, original_score=sub.score, applied_score=applied, invalidated=inv,
            applied_adjustment=0.0 if inv else round(applied - sub.score, 6), cap_applied=False if inv else applied < sub.score - 1e-12,
            max_increase_used=cfg.max_readiness_increase, original_automated_score=sub.original_automated_score,
            attempt_id=sub.attempt_id, question_id=sub.question_id, supersedes=sub.supersedes, fingerprint=fp, **kw)

    before_profile = merge_evidence(base, evals, extra, ledger)
    # Revisions are measured against the state BEFORE the whole chain of revisions started, so revising a review again and
    # again can never add more than one cap in total.
    chain, cur = set(), sub.supersedes
    while cur:
        chain.add(cur)
        cur = (ledger.get(cur).supersedes if ledger.get(cur) else None)
    baseline = ReviewLedger(reviews=[r for r in ledger.reviews if r.review_id not in chain], audit=ledger.audit)
    r0 = _readiness_by_role(merge_evidence(base, evals, extra, baseline), catalog, evidence_config, as_of)

    def max_increase(applied: float) -> tuple[float, str | None, dict[str, float]]:
        prof, _ = build(applied)
        r1 = _readiness_by_role(prof, catalog, evidence_config, as_of)
        best_role, best = None, 0.0
        for rid in r1:
            d = r1[rid] - r0[rid]
            if d > best + 1e-12:
                best_role, best = rid, d
        return best, best_role, r1

    cap = cfg.max_readiness_increase
    applied = None if sub.invalidate else sub.score
    inc, role, _ = max_increase(applied)
    if applied is not None and inc > cap + 1e-9:
        lo, hi = 0.0, sub.score
        for _ in range(60):
            mid = (lo + hi) / 2
            if max_increase(mid)[0] <= cap:
                lo = mid
            else:
                hi = mid
        applied = math.floor(lo * 1000) / 1000
        while applied > 0 and max_increase(applied)[0] > cap + 1e-9:
            applied = round(applied - 0.001, 3)
        applied = max(0.0, applied)
    if applied is not None and sub.supersedes and sub.score is not None and old.original_score is not None and sub.score <= old.original_score + 1e-12 and old.applied_score is not None:
        applied = max(applied, min(sub.score, old.applied_score))   # a downward revision is never cut below what was already applied
        applied = min(applied, sub.score)
    inc, role, r1 = max_increase(applied)
    after_profile, new_ledger = build(applied)
    # binding role for reporting: the role with the largest increase; otherwise the role with the largest absolute change
    if role is None and r1:
        role = max(r1, key=lambda k: (abs(r1[k] - r0[k]), k))
        if abs(r1[role] - r0[role]) < 1e-12:
            role = None
    rec = _record(applied, binding_role=role,
                  readiness_before=round(r0[role], 3) if role else None, readiness_after=round(r1[role], 3) if role else None)
    new_ledger = ReviewLedger(reviews=[*new_ledger.reviews[:-1], rec], audit=ledger.audit)

    # audit trail: one event per changed skill, plus one readiness_review event (score there is 0-100 readiness)
    log = ledger.audit
    cap_note = f" [score {sub.score:.3f} capped to {applied:.3f}: max +{cap:g} readiness]" if rec.cap_applied else (
        " [automated result invalidated]" if sub.invalidate else "")
    source = SOURCE_OF[sub.kind]
    b, a = _skill_values(before_profile, sub.skills, evidence_config, as_of), _skill_values(after_profile, sub.skills, evidence_config, as_of)
    for sk in sub.skills:
        if b[sk] != a[sk]:
            log = append_event(log, subject_type="skill_evidence", subject_id=sk, previous=b[sk], new=a[sk], source=source,
                               reason=sub.reason + cap_note, actor="reviewer", actor_id=sub.reviewer_id, timestamp=now_s)
    log = append_event(
        log, subject_type="readiness_review", subject_id=sub.review_id,
        previous=AuditValue(state="before", score=rec.readiness_before), new=AuditValue(state="capped" if rec.cap_applied else "applied", score=rec.readiness_after),
        source=source, reason=(("Supersedes " + sub.supersedes + ". ") if sub.supersedes else "") + sub.reason + cap_note,
        actor="reviewer", actor_id=sub.reviewer_id, timestamp=now_s)
    new_ledger = ReviewLedger(reviews=new_ledger.reviews, audit=log)
    return _outcome("applied", new_ledger, rec, readiness_increase=round(max(inc, 0.0), 3), cap=cap,
                    readiness={k: {"before": round(r0[k], 3), "after": round(r1[k], 3)} for k in r0})


def ledger_notes(ledger: ReviewLedger | None) -> list[str]:
    """Plain-language notes about reviews for gap reports."""
    if ledger is None or not ledger.reviews:
        return []
    act = ledger.active()
    notes = []
    capped = [r.review_id for r in act if r.cap_applied]
    if capped:
        notes.append(f"{len(capped)} human review(s) were capped by the per-review readiness limit; originals are kept in the review ledger.")
    ov = [r.review_id for r in act if r.kind == "interview"]
    if ov:
        notes.append(f"{len(ov)} automated interview result(s) were replaced by a human review (originals are kept in the ledger).")
    return notes
