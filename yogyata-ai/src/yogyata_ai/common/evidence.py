"""Summarise competency evidence per skill into levels AND explicit evidence states.

Levels (unchanged, deterministic):
  verified      any record from a human-review source (task_review, interview_review, portfolio_review)
  demonstrated  otherwise, any record from resume_evidence, interview_auto or task_auto
  declared      otherwise, the skill is in declared_skills or has a "declared" record
  none          no information at all

Evidence STATES (new; one per skill, assigned by these rules in this order):
  demonstrated            assessed evidence (interview_auto / task_auto / any human-reviewed source) exists and its
                          strength is high enough to earn the "met" readiness credit (see demonstrated_min_strength)
  partially_demonstrated  assessed evidence exists but the strength is below that bar (this includes weak performance;
                          `weak_signal` marks strength < 0.4)
  missing_evidence        an assessment was ATTEMPTED (profile.assessment_attempts) but produced no usable evidence and
                          there is no assessed evidence for the skill
  mentioned_unverified    the skill is only claimed: listed (declared) or described in a resume project
                          (resume_evidence); nothing has assessed it
  not_assessed            nothing is known: not claimed, not assessed, no attempt. This is unknown, NOT weakness.
"Assessed" excludes declared and resume_evidence, so a resume mention can never become `demonstrated`.

Reviewed evidence outranks automated evidence for the level and strength. Disagreement between records is not hidden:
`conflict` is set when assessed records differ by >= conflict_spread, and `stale` when the newest dated assessed
record is older than stale_after_days at the reference date `as_of` (neither changes the state; both lower
confidence and add a note). `strength` is the mean strength of the records that determine the level.
"""
from __future__ import annotations

import datetime as dt
import os
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

from .schemas import REVIEWED_SOURCES, EvidenceRecord, StudentProfile, parse_timestamp
from .taxonomy import get_taxonomy

Level = Literal["none", "declared", "demonstrated", "verified"]
DEMONSTRATED_SOURCES = {"resume_evidence", "interview_auto", "task_auto"}
LEVEL_ORDER = {"none": 0, "declared": 1, "demonstrated": 2, "verified": 3}

EvidenceState = Literal["demonstrated", "partially_demonstrated", "mentioned_unverified", "not_assessed", "missing_evidence"]
EVIDENCE_STATES: tuple[str, ...] = ("demonstrated", "partially_demonstrated", "mentioned_unverified", "not_assessed", "missing_evidence")
SELF_REPORTED_SOURCES = {"declared", "resume_evidence"}
ASSESSED_SOURCES = {"interview_auto", "task_auto"} | set(REVIEWED_SOURCES)
MET_CREDIT = 0.60       # readiness credit at which a skill counts as met (shared with skill_gap.analysis)
WEAK_STRENGTH = 0.40


@dataclass(frozen=True)
class EvidenceConfig:
    """Configurable defaults (hand-set conventions, not measured quantities)."""
    stale_after_days: int = 365      # newest assessed evidence older than this is flagged stale
    conflict_spread: float = 0.35    # max-min strength among assessed records that is flagged as a conflict

    @classmethod
    def from_env(cls) -> "EvidenceConfig":
        def num(name, default, cast):
            try:
                v = cast(os.getenv(name, default))
            except (TypeError, ValueError):
                return default
            return v if v > 0 else default
        return cls(stale_after_days=num("YOGYATA_EVIDENCE_STALE_DAYS", 365, int),
                   conflict_spread=num("YOGYATA_EVIDENCE_CONFLICT_SPREAD", 0.35, float))


def demonstrated_min_strength(level: str) -> float:
    """Strength at which readiness credit reaches MET_CREDIT: reviewed credit = strength; automated = 0.1 + 0.8 * strength."""
    return MET_CREDIT if level == "verified" else round((MET_CREDIT - 0.1) / 0.8, 4)


class SkillEvidenceSummary(BaseModel):
    skill: str
    level: Level
    strength: float | None
    n_records: int
    sources: list[str]
    weak_signal: bool = False  # level is demonstrated/verified but the evidence shows weakness (< 0.4)
    state: EvidenceState = "not_assessed"
    state_reason: str = ""
    last_assessed_at: str | None = None
    stale: bool = False
    conflict: bool = False
    capped: bool = False   # strength was limited by the per-review readiness cap although the reviewer judged it >= 0.4
    notes: list[str] = Field(default_factory=list)


def _canon(name: str) -> str:
    return get_taxonomy().canonical(name) or name.strip()


def _fmt(d: dt.datetime) -> str:
    return d.date().isoformat() if (d.hour, d.minute, d.second, d.microsecond) == (0, 0, 0, 0) else d.isoformat()


def _state(level: str, strength: float | None, assessed: list[EvidenceRecord], self_reported: bool,
           attempts: int) -> tuple[str, str]:
    if assessed and level in ("demonstrated", "verified"):
        bar = demonstrated_min_strength(level)
        src = "human-reviewed" if level == "verified" else "automated"
        if strength is not None and strength >= bar:
            return "demonstrated", f"{src} assessment strength {strength:.2f} >= {bar:.3f}"
        return "partially_demonstrated", f"{src} assessment strength {strength if strength is not None else 0:.2f} < {bar:.3f}"
    if attempts:
        return "missing_evidence", f"{attempts} assessment attempt(s) produced no usable evidence"
    if self_reported:
        return "mentioned_unverified", "claimed in profile/resume only; nothing has assessed it"
    return "not_assessed", "no claim, assessment or attempt (unknown, not weak)"


def summarize_evidence(profile: StudentProfile, *, config: EvidenceConfig | None = None,
                       as_of: dt.date | dt.datetime | str | None = None) -> dict[str, SkillEvidenceSummary]:
    cfg = config or EvidenceConfig()
    ref = parse_timestamp(as_of) if as_of is not None else None
    by_skill: dict[str, list[EvidenceRecord]] = {}
    for rec in profile.evidence:
        by_skill.setdefault(_canon(rec.skill), []).append(rec)
    attempts: dict[str, int] = {}
    for a in profile.assessment_attempts:
        attempts[_canon(a.skill)] = attempts.get(_canon(a.skill), 0) + 1
    declared = {_canon(s) for s in profile.declared_skills}
    out: dict[str, SkillEvidenceSummary] = {}
    for skill in set(by_skill) | declared | set(attempts):
        recs = by_skill.get(skill, [])
        reviewed = [r for r in recs if r.source in REVIEWED_SOURCES]
        demo = [r for r in recs if r.source in DEMONSTRATED_SOURCES]
        if reviewed:
            level, used = "verified", reviewed
        elif demo:
            level, used = "demonstrated", demo
        elif skill in declared or any(r.source == "declared" for r in recs):
            level, used = "declared", [r for r in recs if r.source == "declared"]
        else:
            level, used = "none", []
        strength = sum(r.strength for r in used) / len(used) if used else None
        assessed = [r for r in recs if r.source in ASSESSED_SOURCES]
        # attempts only matter while nothing has actually assessed the skill
        n_att = 0 if assessed else attempts.get(skill, 0)
        state, why = _state(level, strength, assessed, level != "none", n_att)
        notes: list[str] = []
        dated = [d for d in (parse_timestamp(r.assessed_at) for r in assessed) if d is not None]
        last = max(dated) if dated else None
        stale = False
        if ref is not None and assessed:
            if last is None:
                notes.append("assessment date unknown; freshness cannot be checked")
            elif (ref - last).days > cfg.stale_after_days:
                stale = True
                notes.append(f"newest assessment is {(ref - last).days} days old (> {cfg.stale_after_days}); re-assess")
        conflict = False
        if len(assessed) >= 2:
            vals = [r.strength for r in assessed]
            if max(vals) - min(vals) >= cfg.conflict_spread - 1e-9:
                conflict = True
                srcs = ", ".join(sorted({r.source for r in assessed}))
                notes.append(f"assessed records disagree (strength {min(vals):.2f}..{max(vals):.2f}; sources: {srcs})"
                             + ("; the human-reviewed result takes precedence" if reviewed and demo else ""))
        if n_att and level != "none":
            notes.append("claimed, but an assessment attempt produced no usable evidence")
        capped = any(r.capped_from is not None and r.capped_from >= WEAK_STRENGTH for r in used)
        if capped:
            notes.append("a reviewer's higher score was limited by the per-review readiness cap; it is not a weakness signal")
        out[skill] = SkillEvidenceSummary(
            skill=skill, level=level, strength=round(strength, 3) if strength is not None else None,
            n_records=len(recs), sources=sorted({r.source for r in recs}),
            weak_signal=level in ("demonstrated", "verified") and strength is not None and strength < WEAK_STRENGTH and not capped,
            capped=capped,
            state=state, state_reason=why, last_assessed_at=_fmt(last) if last else None,
            stale=stale, conflict=conflict, notes=notes)
    return out


def level_of(summaries: dict[str, SkillEvidenceSummary], skill: str) -> SkillEvidenceSummary:
    s = summaries.get(_canon(skill))
    return s or SkillEvidenceSummary(skill=_canon(skill), level="none", strength=None, n_records=0, sources=[],
                                     state="not_assessed", state_reason="no claim, assessment or attempt (unknown, not weak)")
