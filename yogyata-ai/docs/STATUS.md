# Implementation status

Legend: [x] done and tested.

## Baseline audit (before the full build)
Present and working: Resume Intelligence (rule-based parser, taxonomy skill extraction, heuristic quality score, TF-IDF job match), demo resumes with hand labels, evaluation script, README (37 tests).
Findings that drove the work: only Module A existed; taxonomy was private to A; `match_job` rewarded merely-listed skills (keyword stuffing); education/experience/projects were only detected as section presence; no LinkedIn analysis, LLM adapter, shared schemas or injection handling; `EmbeddingSimilarity` untested.
Preserved: `resume_intelligence.analyze`, `.match`, `match_job`, `analyze_resume`, `parse_resume`; all original tests still pass unchanged.

## Checklist
- [x] Shared foundation: taxonomy (46 skills), schemas, evidence model, similarity backends with graceful fallback, LLM adapter + mock, safety utilities, PII redaction
- [x] A. Resume and career-profile intelligence (+ LinkedIn text, evidence-aware job comparison, profile builder)
- [x] B. Mock interview engine (24 demo questions, hybrid deterministic evaluator, optional verified LLM blend, selection, practice plan, evidence)
- [x] C. Opportunity matching (eligibility separate from ranking, evidence-weighted skill credit, explanations)
- [x] D. Skill-gap analysis (statuses, confidence, bounds, prerequisites, reassessment)
- [x] E. Career roadmap (catalog, planner, constraints, updates with diff)
- [x] F. Practical tasks and portfolio (recommend, interpret, preliminary feedback, reviewed results to evidence)
- [x] G. Mentor recommendations (filters, unknown handling, synthetic labelled mentors, no booking)
- [x] H. University analytics (suppression, complementary suppression, missing != poor)
- [x] Agent (state machine, typed tools, budgets, injection handling, verification, optional validated LLM, confirmation hand-off)
- [x] End-to-end demo (`scripts/demo_end_to_end.py`), integration example, docs, real samples, evaluations, run-all script
- [ ] Not done / out of scope: embedding-backend evaluation (dependency not installed here), real LLM provider integration, evaluation on real labelled data, expert-reviewed content

## Verification record
Final test and evaluation outputs are in the session report and `reports/*.json`. Re-run with `pytest -q` and `python scripts/run_all_evaluations.py`.
