# Evidence states, review controls and audit trail (Priority 2)

All rules below are implemented and covered by tests (see `tests/common/test_evidence_states.py`, `tests/common/test_audit.py`,
`tests/skill_gap/test_review.py`, `tests/interview/test_interview_review.py`, `scripts/evaluate_evidence_review.py`).
Every threshold is a hand-set, documented default, not a measured quantity.

## 1. Skill evidence states

One state per skill, in `SkillAssessment.evidence_state` (plus `evidence_state_reason`, `last_assessed_at`, `evidence_stale`,
`evidence_conflict`, `evidence_notes`) and `GapReport.evidence_states` (state -> skills).

| State | Rule | Typical status |
|---|---|---|
| `demonstrated` | assessed evidence exists (`interview_auto`, `task_auto` or any human-reviewed source) and its strength earns the "met" credit: reviewed >= 0.60, automated >= 0.625 | `met` |
| `partially_demonstrated` | assessed evidence exists but is below that bar (includes weak performance; `weak_signal` marks < 0.4) | `developing`, `demonstrated_weakness` |
| `mentioned_unverified` | only claimed: listed skill or resume project use (`declared`, `resume_evidence`); nothing assessed it | `self_reported_use`, `missing_evidence` |
| `missing_evidence` | an assessment was ATTEMPTED (`profile.assessment_attempts`, or a low-confidence interview evaluation) but gave no usable evidence, and nothing assessed the skill | `missing_evidence` |
| `not_assessed` | not claimed, not assessed, no attempt. Unknown, **not** weakness | `unassessed` |

- A resume mention can never become `demonstrated` (assessed sources exclude `declared` and `resume_evidence`).
- Reviewed evidence outranks automated evidence for level and strength. If assessed records differ by >= `conflict_spread`
  (default 0.35) the skill is flagged `evidence_conflict` and confidence drops one step; the note says which source takes precedence.
- Freshness: pass `as_of` (ISO date). If the newest dated assessed record is older than `stale_after_days` (default 365) the skill is
  flagged `evidence_stale`, confidence drops one step and a note asks for re-assessment. Credit and state are NOT changed by staleness
  (documented choice: we flag, we do not silently discount). Without `as_of`, freshness is not evaluated (deterministic output).
  Records without `assessed_at` are reported as "date unknown", never as stale.
- The status -> state mapping is total and checked by tests and by `scripts/evaluate_evidence_review.py` (E1, E2, E3). A sweep test
  guards the thresholds against drifting from the readiness `met` rule.
- Consumers: skill-gap (`analyze_skill_gap`), roadmap (`milestones[].evidence_state`; sequences still keyed by status), tasks, mentors and
  opportunity matching all call the same summary code, so they agree by construction.
- Config: `EvidenceConfig(stale_after_days, conflict_spread)`; env `YOGYATA_EVIDENCE_STALE_DAYS`, `YOGYATA_EVIDENCE_CONFLICT_SPREAD`;
  per call `stale_after_days`, `conflict_spread`, `as_of` in the skill-gap / roadmap payloads.

## 2. Audit trail (`yogyata_ai.common.audit`)

`AuditLog` holds `AuditEvent`s: `seq`, `event_id`, `timestamp`, `subject_type` (`skill_evidence` | `interview_assessment` | `readiness_review`),
`subject_id` (skill name or review id), `previous` / `new` (`state`, `score`), `source`, `reason`, `actor` (`automatic` | `reviewer`),
`actor_id` (opaque reviewer id, required for reviewer events), `prev_hash`, `hash`.

- **Append-only and tamper-evident.** Events are SHA-256 hash-chained. Every operation verifies its input log and returns a new
  log that extends it; a log that was edited, truncated or reordered raises `AuditTamperError`. `merge_logs(stored, proposed)` accepts only
  a strict extension of the stored log. This detects overwrites; the backend must also forbid UPDATE/DELETE on audit rows.
- **Minimal data.** Opaque ids, states/scores, a source label and a reason (e-mails/phone numbers redacted, 300 characters max). No answer
  text, resume text, names or comments. For `readiness_review` events `score` is the 0-100 readiness; for skill events it is the 0-1 strength.
- `audit_evidence_additions(...)` logs automatic evidence changes (one event per skill whose state or score changed).

## 3. Review ledger and the per-review readiness cap (`yogyata_ai.skill_gap.review`)

`submit_review(payload, review, ledger=...)` applies ONE human review and returns the new `ledger` (reviews + audit log). Persist it and pass it back;
`analyze_skill_gap` / `generate_roadmap` / task and mentor recommenders accept it as `review_ledger`.

Cap rule (default **10.0 readiness points per review**, configurable via `max_readiness_increase=`, `ReviewConfig`, or
`YOGYATA_MAX_READINESS_INCREASE_PER_REVIEW`; 0-100):
1. Readiness (0-100) is computed before and after the review for EVERY role in the catalog; the largest increase is compared with the cap.
2. If it exceeds the cap, the applied strength is lowered (bisection, floored to 3 decimals) to the highest value that respects the cap.
3. Stored per review: `original_score` (reviewer's), `applied_score`, `applied_adjustment` (<= 0), `cap_applied`, `max_increase_used`, `reason`,
   `binding_role`, `readiness_before/after`, `reviewed_at`. The reviewer's judgement is never overwritten.
4. Only increases are capped; a review that lowers readiness is applied in full. Readiness stays in [0, 100].
5. A cap-limited score is **never** reported as a weakness: evidence carries `capped_from`, and a skill whose reviewer score was >= 0.4 stays
   `developing` instead of `demonstrated_weakness`.
6. The cap is evaluated at submission time. Reviews on different items can add up over time (each bounded). Revisions by the same reviewer
   are measured against the state before the whole revision chain, so repeated revisions cannot add more than one cap in total.

Duplicates: the same `review_id`, or the same reviewer + kind + item + skills + score under another id, returns `status: "duplicate"` and changes
nothing. Reusing a `review_id` with different content raises. A changed score by the same reviewer on the same item must name `supersedes`
(old review kept with status `superseded`; only the original reviewer may supersede; resending the same score is a duplicate). Other reviewers
may add independent reviews of the same item.

Validation: `score` finite number in [0, 1] (no bool/str), `reason` required (3-300 chars), skills must be taxonomy skills, ids 1-128 safe
characters, `reviewed_at` valid and not in the future. Optional allow-list: `authorized_reviewers=[...]` (or `YOGYATA_AUTHORIZED_REVIEWERS`).
The backend must still authenticate reviewers; the package trusts `reviewer_id`.

## 4. Interview reviewer override (`yogyata_ai.interview.review`)

`interview.review_evaluation({"evaluation", "override"})` returns an `InterviewReviewRecord`: `original` (automated overall, dimension scores,
assessment band, confidence, status `automated_unverified`) next to `reviewed` (human result), `status` (`human_confirmed` | `human_adjusted` |
`human_invalidated`), `reason`, `reviewer_id`, `reviewed_at`. Decisions: `confirm`, `adjust` (needs `reviewed_overall`; optional per-dimension
scores), `invalidate`. The automated evaluation is never edited.

`skill_gap.submit_interview_review(payload, evaluation, override, ledger=...)` stores that record AND applies it to readiness through the same
cap, duplicate protection and audit trail. Downstream skill-gap analysis then uses the human result (`interview_review`, verified) and does
NOT also count the automated result it replaced (matched by `attempt_id`; attempt-less evaluations and profile-level `interview_auto`
records are matched by `question_id`). The original automated score stays in the review record and the ledger
(`original_automated_score`). Only technical interviews map to skills.
`interview.final_interview_result({"evaluation", "review"})` returns the result downstream code should show, always with the automated original alongside.

## 5. Agent

`record_reviewed_result` now goes through the ledger: capped, deduplicated, audited, and the ledger is returned in `session.review_ledger`
(persist it with the session). The verifier checks that every `verified` skill is backed by reviewed evidence in the session OR the ledger and
that the ledger's audit chain is intact. The ledger in a session is trusted like any other session field: do not accept it from end users.

## 6. Compatibility changes (all intentional; everything else is additive)

- `EvidenceRecord` gained optional `assessed_at`, `capped_from`; `StudentProfile` gained `assessment_attempts`; `AnswerEvaluation` gained optional
  `attempt_id`, `assessed_at`. All optional, old payloads validate unchanged.
- New report fields: `SkillAssessment.evidence_*`, `GapReport.evidence_states`, `GapReport.as_of`; roadmap `milestones[].evidence_state`.
- **Behaviour change:** a technical interview evaluation with low confidence used to leave the skill `unassessed`; it now records an assessment attempt,
  so the status is `missing_evidence` / state `missing_evidence` (credit still 0, still not a weakness). The existing test was updated accordingly.
- **Behaviour change:** agent `reviewed_results` are capped by default (10 points). A single 0.9-rated task covering two skills no longer makes SQL
  "met"; set `YOGYATA_MAX_READINESS_INCREASE_PER_REVIEW=100` to disable. The existing agent test sets that variable; new tests cover the default.
- `MET_CREDIT` / `WEAK_STRENGTH` moved to `common.evidence` (still importable from `skill_gap.analysis`).
- `skill_gap.api.merge_evidence` now lives in `skill_gap/merge.py` and is re-exported; it takes an optional `ledger`.
