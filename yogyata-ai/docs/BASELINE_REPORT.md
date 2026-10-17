# Baseline inspection report (Phase 1) - 2026-10-18

## Status of inputs
- **No real datasets were attached** (only the instruction file). No dataset inventory, training or real-data evaluation has been done, and nothing below claims otherwise.
- The project was inspected in place (`/home/claude/yogyata-ai`, version 0.2.0).

## Baseline (actually run today)
- `pytest -q`: **330 passed**, 0 failed, ~4.4 s.
- `python scripts/run_all_evaluations.py`: all 9 evaluations run (results in README; all on **synthetic, author-labelled** data).

## Existing functionality and what it is built on
| Module | Today | Real data? | Trained model? |
|---|---|---|---|
| Resume | rules + TF-IDF, 46-skill demo taxonomy | no (8 synthetic resumes) | no |
| Interview | lexical concept/rubric scorer, 24 demo questions, optional validated LLM blend (mock-tested only) | no (25 author-rated answers) | no |
| Matching | eligibility rules + weighted score + TF-IDF; embeddings implemented but never run | no (12 synthetic opportunities) | no |
| Skill gap | evidence states (met / developing / weakness / self-reported / declared-only / unassessed) | no | no |
| Roadmap | prerequisite- and budget-aware sequential planner | no | no |
| Tasks, mentors | rubric checks; rule + TF-IDF ranking | no (synthetic) | no |
| Analytics | k-suppression with complementary pooling | no (synthetic cohorts) | no |
| Agent | deterministic state machine, typed tools, verifier; LLM paths tested with mocks only | n/a | n/a |

No module contains a trained model, a data loader for external files, or a live-data connector.

## Gaps against the new brief (verified by inspection, not assumed)
1. **No data layer**: no CSV/Excel/JSON loaders, schema/config files, validation, inventory or raw/processed separation.
2. **No ingestion service**: `Opportunity` has `is_demo` but no `source_url`, `source_name`, `retrieved_at`, `last_verified_at`, `deadline`, status (open/closed), or live/cached/uploaded/synthetic provenance. No deduplication or expiry detection. No connector interface.
3. **Roadmap contract gap (reproduced today)**: with 8 h/week the planner never allocates more than 8 h in total per week (it lays work out cumulatively), but items only carry `start_week`/`end_week`, so activities overlap week ranges and a naive per-week sum shows **11.5 h in week 2** for a default data-analyst plan. There is no explicit per-week schedule, no target completion date or deadline conflict handling, no handling of changed availability or in-progress tasks, and no handling of missing/invalid durations (catalog validation only rejects ≤0). This is the exact failure mode in the brief and needs an explicit weekly schedule plus regression tests.
4. **Skill-gap states** use different names from the brief (e.g. no "partially demonstrated" / "last assessed date" / per-record timestamps; evidence records have no date). Evidence has no assessment date or reviewer audit history.
5. **Practical tasks**: reviewed results convert to evidence but there is no audit history of assessment changes and no cap on how much a single review can raise readiness.
6. **Interview**: no human override/correction flow and no per-dimension "automatic vs human-review-required" labelling beyond the overall status.
7. **Embeddings** (`sentence-transformers`) not installed; semantic matching has never been run or compared against TF-IDF.
8. **Agent**: tools wrap the modules but there is no retrieval tool for live opportunities, no limited-retry policy, and no tool for roadmap update on task completion.
9. **Models/artifacts**: no model registry, versioned artifacts, drift checks or training scripts (nothing to train yet).

## What datasets could support (needs your files to confirm)
| If you provide... | It could support | Minimum columns needed |
|---|---|---|
| Job/internship postings | opportunity ingestion, matching evaluation, skill-demand analytics, taxonomy expansion | title, description, required/preferred skills (or text to extract them), location, work mode, posted date, deadline/status, source URL |
| Postings **plus** relevance/click/apply labels for candidates | supervised ranking (LTR) | candidate id (pseudonymous), posting id, label or graded relevance, candidate skills |
| Resumes with human-annotated skills/sections | extraction F1 evaluation, possibly a supervised tagger | text, annotated spans or skill lists |
| Interview Q/A with human scores | supervised/calibrated scoring, MAE/agreement | question, answer, rater score(s) (ideally ≥2 raters), rubric dimensions |
| Skill / proficiency assessments | calibrated skill-gap model | candidate, skill, assessed level, date, assessor type |
| Mentor profiles | mentor ranking evaluation | expertise, languages, availability, price (only if real and authorized) |
| Aggregate student/placement data | analytics | group keys, counts, outcomes (aggregated or pseudonymous) |

A dataset of postings alone **cannot** train a supervised matcher (no outcome labels); it would be used for ingestion, TF-IDF/embedding retrieval, skill-demand statistics, and a small human-reviewed relevance set. I will say so rather than force a model.

## Recommended order
1. (needs data) Inventory + validation layer + dataset-to-module map.
2. Opportunity schema/provenance fields, ingestion service with connector interface (mockable), dedup, expiry; matching baseline vs embeddings on real postings.
3. Skill-gap states/timestamps/audit, interview dimension labelling and reviewer override.
4. **Roadmap weekly schedule + regression tests** (can start now, no data needed).
5. Agent wiring (live retrieval tool, retries, update-on-completion), then resume/mentor/task/analytics upgrades where data supports them.
6. Full regression, evaluations (real and synthetic reported separately), docs.


---

# Verified results after Priority 1 and Priority 2 (2026-10-18)

Everything in this section was run, not assumed. Commands are run from the package root.

## Priority 1 - roadmap weekly scheduling (done)

**Reproduced problem:** roadmap items exposed only start/end weeks and total hours, so the default data-analyst roadmap (8 h/week) could be read as an
11.5 h week 2. **Fix:** an explicit per-week allocation produced by a strict list scheduler (`roadmap/scheduler.py`) that cannot exceed a week's hours,
re-checked by an independent integrity checker (`check_schedule_integrity`; the planner raises if it ever fails).

What now holds (all tested):
- default data-analyst, 8 h/week, 8 weeks: weekly hours 8, 8, 8, 8, 8, 8, 8, 6 (62 h scheduled, 92 h unscheduled); `time_budget_conflict` with options; projected completion week 20.
- prerequisites (within a skill and across skills) are scheduled before dependents; a deferred prerequisite defers its dependents.
- target dates: `start_date` + `target_date` give the horizon (`ceil(days/7)` weeks, min with `timeline_weeks`); unmet deadlines produce a `deadline_conflict` with
  unscheduled hours, options and a projected finish date. Nothing is silently overloaded.
- per-week availability (including 0-hour weeks), completed and in-progress tasks, missing/invalid durations, cycles, unknown/duplicate/self dependencies,
  invalid dates/availability are handled; `update_roadmap` recomputes and reports `moved`, `newly_met_skills`, `schedule` deltas.
- Compatibility: old fields (`start_week`, `end_week`, `total_hours`, `weeks_used`, `deferred`) kept; new input fields are optional. A task whose in-progress
  hours already cover its duration is treated as complete and removed with a note.

Tests: `tests/roadmap/test_scheduling.py` (78 tests) including the 11.5 h regression, 21 budget combinations, prerequisite order, deadline conflicts, availability
changes, in-progress/completed, invalid inputs, tamper detection of the integrity checker and 300 randomised schedules.
`scripts/evaluate_roadmap.py`: 12 checks (C1-C9 existing + C10 weekly capacity, C11 allocation consistency, C12 honest deadline conflicts), all pass on 54 roadmaps.
Bug found by the tests and fixed: the integrity checker flagged a task whose prerequisite was complete through in-progress hours.

## Priority 2 - evidence states, audit, review controls, interview override (done)

Design, rules, defaults and compatibility notes: [EVIDENCE_AND_REVIEW.md](EVIDENCE_AND_REVIEW.md).

| Feature | Where | Tests |
|---|---|---|
| 5 evidence states + freshness + conflicts | `common/evidence.py`, `skill_gap/analysis.py` | `tests/common/test_evidence_states.py` (27) |
| Tamper-evident audit trail | `common/audit.py` | `tests/common/test_audit.py` (14) |
| Review ledger, cap, duplicates, supersession | `skill_gap/review.py` | `tests/skill_gap/test_review.py` (71) |
| Interview reviewer override | `interview/review.py`, `skill_gap.submit_interview_review` | `tests/interview/test_interview_review.py` (33) |
| Agent uses the ledger and verifies it | `agent/tools.py`, `agent/verify.py` | `tests/agent/test_agent.py` (+2) |
| Invariant evaluation | `scripts/evaluate_evidence_review.py` | 9 checks, all pass |

Problems found while building and how they were resolved:
1. The audit log rejected skill names with spaces/symbols ("Data Visualization") - found by the review tests; subject ids now allow printable text.
2. A capped review (0.9 capped to 0.39) made the skill look like a `demonstrated_weakness`, which is misleading - fixed with `EvidenceRecord.capped_from`; capped
   scores are never treated as weakness.
3. Repeated revisions by one reviewer could ramp readiness by one cap each time - fixed by measuring revisions against the pre-chain baseline; test added.
4. The agent verifier flagged "verified without reviewed evidence" once reviews moved into the ledger - verifier now also reads the ledger and checks its audit chain.
5. One existing test (`low_confidence_interview_evaluation_not_used_as_evidence`) and one agent test were updated for the two intentional behaviour changes listed in
   EVIDENCE_AND_REVIEW.md section 6. No test was deleted or weakened otherwise.

## Commands and actual results

| Command | Result |
|---|---|
| `python3 -m pytest -q -p no:cacheprovider tests` | **555 passed** (330 at start of this phase; 408 after Priority 1; 555 after Priority 2), 0 failed |
| per module: common 69, skill_gap 102, interview 79, roadmap 108, agent 55, practical_tasks 22, mentor_recommendation 15, opportunity_matching 23, university_analytics 16, resume_intelligence 66 | all passed (sum 555) |
| `python3 scripts/run_all_evaluations.py` | 10 evaluations ok (new: evidence_review); roadmap checks all pass; evidence/review checks all pass; skill_gap 45/45; agent tool success 1.0, recovery 12/12, injection 30/30 |
| `python3 scripts/evaluate_roadmap.py` | C1-C12 all pass (54 roadmaps) |
| `python3 scripts/evaluate_evidence_review.py` | E1-E9 all pass (225 review sweeps; 9 demo scenarios) |
| `python3 scripts/demo_end_to_end.py` | exit 0 |
| `python3 scripts/generate_samples.py` | exit 0 |

## Limitations (honest)
- The evidence-state thresholds, the 365-day staleness window, the 0.35 conflict spread and the 10-point review cap are documented defaults, not tuned or validated on real data.
- The cap is measured on the readiness indicator for the roles in the catalog; it limits rate of change, it does not make readiness more accurate.
- The audit log is tamper-EVIDENT, not tamper-proof: the backend database must enforce append-only storage and authenticate reviewers.
- Staleness is flagged, not discounted. Evidence from heavy capping can leave a skill `developing` until further reviews.
- Priorities 3 and 4 (data layer, opportunity connector, new agent tools) are not started; no real datasets have been supplied, so no model was trained.
