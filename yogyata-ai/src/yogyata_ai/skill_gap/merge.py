"""Combine every evidence source into one profile (kept separate from api.py to avoid import cycles)."""
from __future__ import annotations

from yogyata_ai.common.schemas import EvidenceRecord, StudentProfile
from yogyata_ai.interview.schemas import AnswerEvaluation
from yogyata_ai.interview.selection import evaluations_to_attempts, evaluations_to_evidence


def merge_evidence(profile: StudentProfile, interview_evaluations: list[AnswerEvaluation],
                   extra: list[EvidenceRecord], ledger=None) -> StudentProfile:
    """Return a copy of the profile with all evidence merged and exact duplicates removed.

    `ledger` (skill_gap.review.ReviewLedger, optional): its active human reviews are added as reviewed evidence at the
    strength that was APPLIED (after the readiness cap). Automated interview results that a reviewer overrode are
    excluded here (a review with an attempt_id replaces the evaluation carrying that attempt_id; a review with only a
    question_id replaces every automated result for that question, including profile-level interview_auto records; the original automated result stays stored in the review record; it is just not double counted).
    """
    by_attempt: set[str] = set()      # attempts a reviewer replaced
    q_any: set[str] = set()           # questions with an interview review (profile-level / attempt-less automated records)
    q_whole: set[str] = set()         # reviews that name only a question: replace every automated result for it
    reviewed: list[EvidenceRecord] = []
    if ledger is not None:
        from yogyata_ai.common.audit import assert_intact
        assert_intact(ledger.audit)  # never build on a ledger whose audit trail has been altered
        reviewed = ledger.evidence_records()
        for r in ledger.active():
            if r.kind == "interview":
                if r.attempt_id:
                    by_attempt.add(r.attempt_id)
                else:
                    q_whole.add(r.question_id or "")
                if r.question_id:
                    q_any.add(r.question_id)
    kept_evals = [e for e in interview_evaluations
                  if not ((e.attempt_id and e.attempt_id in by_attempt) or (e.attempt_id is None and e.question_id in q_any)
                          or e.question_id in q_whole)]
    base_evidence = [r for r in profile.evidence if not (r.source == "interview_auto" and r.ref_id in q_any)]
    merged, seen = [], set()
    for rec in [*base_evidence, *evaluations_to_evidence(kept_evals), *extra, *reviewed]:
        key = (rec.skill.lower(), rec.source, rec.ref_id, round(rec.strength, 3)) if rec.ref_id else None
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        merged.append(rec)
    attempts = [*profile.assessment_attempts, *evaluations_to_attempts(kept_evals)]
    uniq = list({(a.skill.lower(), a.kind, a.ref_id, a.assessed_at): a for a in attempts}.values())
    return profile.model_copy(update={"evidence": merged, "assessment_attempts": uniq})


