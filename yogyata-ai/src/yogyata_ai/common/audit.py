"""Append-only, tamper-evident audit trail for evidence and review changes.

This library stores nothing: the backend persists the `AuditLog` it receives back and passes it in again.
Safeguards against silent overwrite during ordinary updates:
  * every operation returns a NEW log that extends the one it was given (the input is never mutated);
  * events are hash-chained (each hash covers the previous hash), so editing, removing or reordering any stored event
    is detected by `verify_log`, and every public operation verifies its input first and refuses a broken log;
  * `merge_logs(stored, proposed)` accepts a proposed log only if it is a strict extension of the stored one.
Detection is not prevention: the database must still forbid UPDATE/DELETE on audit rows (see docs/INTEGRATION_GUIDE.md).

Privacy: events hold opaque ids, a state/score pair, a source label and a short reason (e-mails / phone numbers are
redacted, 300 characters max). They never hold answer text, resume text, names or comments.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .evidence import SkillEvidenceSummary, summarize_evidence
from .safety import redact_pii
from .schemas import EvidenceRecord, StudentProfile, parse_timestamp

GENESIS = "0" * 64
MAX_REASON = 300
SubjectType = Literal["skill_evidence", "interview_assessment", "readiness_review"]
_ID = re.compile(r"^[\w.:@/\-]{1,128}$")                 # opaque ids (reviewers, reviews)
_SUBJECT = re.compile(r"^[^\x00-\x1f\x7f]{1,128}$")        # skill names such as "C++" or "Data Visualization", or ids


class AuditTamperError(ValueError):
    """The audit log failed verification or a proposed log would overwrite stored history."""


class AuditValue(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: str | None = None
    score: float | None = None

    @field_validator("score")
    @classmethod
    def _finite(cls, v):
        if v is not None and (isinstance(v, bool) or not math.isfinite(v)):
            raise ValueError("score must be a finite number")
        return v


class AuditEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    seq: int = Field(..., ge=1)
    event_id: str
    timestamp: str
    subject_type: SubjectType
    subject_id: str = Field(..., description="Skill name or assessment/review identifier (opaque)")
    previous: AuditValue
    new: AuditValue
    source: str = Field(..., min_length=1, max_length=64, description="Evidence/review source label")
    reason: str = Field(..., min_length=1, max_length=MAX_REASON)
    actor: Literal["automatic", "reviewer"]
    actor_id: str | None = Field(None, description="Opaque reviewer id (required for reviewer events)")
    prev_hash: str
    hash: str


class AuditLog(BaseModel):
    model_config = ConfigDict(extra="forbid")
    events: list[AuditEvent] = Field(default_factory=list)

    @property
    def head(self) -> str:
        return self.events[-1].hash if self.events else GENESIS


def _digest(e: AuditEvent | dict) -> str:
    d = e.model_dump(mode="json") if isinstance(e, AuditEvent) else dict(e)
    d.pop("hash", None)
    return hashlib.sha256(json.dumps(d, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()).hexdigest()


def verify_log(log: AuditLog) -> list[str]:
    """Return problems found (empty list = intact chain)."""
    problems: list[str] = []
    prev = GENESIS
    for i, e in enumerate(log.events, start=1):
        if e.seq != i:
            problems.append(f"event {i}: sequence number is {e.seq} (event removed or reordered?)")
        if e.prev_hash != prev:
            problems.append(f"event {i}: chain broken (previous hash mismatch)")
        if e.hash != _digest(e):
            problems.append(f"event {i}: contents do not match their hash (edited)")
        prev = e.hash
    return problems


def assert_intact(log: AuditLog) -> None:
    problems = verify_log(log)
    if problems:
        raise AuditTamperError("audit log failed verification: " + "; ".join(problems[:3]))


def sanitize_reason(text: str) -> str:
    t = " ".join(str(text or "").split())
    t = redact_pii(t)[:MAX_REASON].strip()
    if not t:
        raise ValueError("a change reason is required")
    return t


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def append_event(log: AuditLog | None, *, subject_type: SubjectType, subject_id: str, previous: AuditValue | dict,
                 new: AuditValue | dict, source: str, reason: str, actor: Literal["automatic", "reviewer"],
                 actor_id: str | None = None, timestamp: str | None = None) -> AuditLog:
    """Return a new log with one event appended. The given log is verified first and left untouched."""
    log = log or AuditLog()
    assert_intact(log)
    if not _SUBJECT.match(str(subject_id)) or not str(subject_id).strip():
        raise ValueError("subject_id must be 1-128 printable characters")
    if actor == "reviewer" and not (actor_id and _ID.match(actor_id)):
        raise ValueError("reviewer events require an opaque actor_id")
    if actor == "automatic" and actor_id is not None:
        raise ValueError("automatic events must not carry an actor_id")
    if timestamp is not None:
        timestamp = parse_timestamp(timestamp).replace(microsecond=0).isoformat()
    seq = len(log.events) + 1
    body = dict(seq=seq, event_id=f"evt-{seq:06d}", timestamp=timestamp or _now(), subject_type=subject_type,
                subject_id=str(subject_id), previous=AuditValue.model_validate(previous).model_dump(),
                new=AuditValue.model_validate(new).model_dump(), source=source, reason=sanitize_reason(reason),
                actor=actor, actor_id=actor_id, prev_hash=log.head)
    ev = AuditEvent(**body, hash=_digest(body))
    return AuditLog(events=[*log.events, ev])


def extends(stored: AuditLog, proposed: AuditLog) -> bool:
    """True when `proposed` is `stored` plus zero or more new events and the chain is intact."""
    n = len(stored.events)
    return not verify_log(proposed) and proposed.events[:n] == stored.events


def merge_logs(stored: AuditLog, proposed: AuditLog) -> AuditLog:
    """Accept `proposed` only if it preserves every stored event unchanged; otherwise raise AuditTamperError."""
    assert_intact(stored)
    if not extends(stored, proposed):
        raise AuditTamperError("proposed audit log would modify, remove or reorder stored history")
    return proposed


def _skill_values(profile: StudentProfile, skills: list[str]) -> dict[str, AuditValue]:
    s: dict[str, SkillEvidenceSummary] = summarize_evidence(profile)
    from .evidence import level_of
    return {k: AuditValue(state=level_of(s, k).state, score=level_of(s, k).strength) for k in skills}


def audit_evidence_additions(log: AuditLog | None, profile: StudentProfile, new_records: list[EvidenceRecord], *,
                             reason: str, timestamp: str | None = None, actor: Literal["automatic", "reviewer"] = "automatic",
                             actor_id: str | None = None) -> tuple[AuditLog, StudentProfile]:
    """Add records to the profile and log one event per skill whose state or score changed.

    Returns (new_log, profile_with_records). Event source is the (single or comma-joined) record source.
    """
    from .taxonomy import get_taxonomy
    tax = get_taxonomy()
    canon = lambda n: tax.canonical(n) or n.strip()  # noqa: E731
    skills = sorted({canon(r.skill) for r in new_records})
    before = _skill_values(profile, skills)
    after_profile = profile.model_copy(update={"evidence": [*profile.evidence, *new_records]})
    after = _skill_values(after_profile, skills)
    out = log or AuditLog()
    for sk in skills:
        if before[sk] != after[sk]:
            src = ",".join(sorted({r.source for r in new_records if canon(r.skill) == sk}))
            out = append_event(out, subject_type="skill_evidence", subject_id=sk, previous=before[sk], new=after[sk],
                               source=src, reason=reason, actor=actor, actor_id=actor_id, timestamp=timestamp)
    return out, after_profile
