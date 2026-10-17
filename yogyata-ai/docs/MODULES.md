# Module reference

All functions take and return JSON-compatible dicts. Pydantic validation errors (`pydantic.ValidationError`) and domain errors
(`ValueError`, e.g. unknown role) are the only exceptions callers should expect. Real request/response samples are in `docs/samples/`.
Import paths: `from yogyata_ai import <package>`.

## A. `resume_intelligence`

Input is plain text (PDF/DOCX extraction is the backend's job).

| Function | Input → output |
|---|---|
| `analyze({"resume_text"})` | `ResumeAnalysis`: parsed contact/sections/skills (with `support`: declared_only / mentioned / evidenced), education, experience, projects, certifications, achievements; `overall_score`, `components`, `suggestions`, `information_gaps`, `warnings` |
| `match({"resume_text","job_description"})` | original coverage + similarity score (**kept for compatibility; rewards listed skills**) |
| `compare_job({...})` | evidence-aware comparison: skills only listed on the resume earn partial credit |
| `analyze_linkedin({"resume_text": <pasted LinkedIn text>})`, `check_linkedin_consistency({"linkedin_text","resume_text"})` | profile completeness feedback; resume/LinkedIn discrepancies |
| `build_profile({"resume_text","target_role"?})` | shared `StudentProfile` (declared skills + `resume_evidence` records; no contact details) |

Approach: rules (section splitting, regex extraction, action-verb and quantification checks) + TF-IDF similarity. Keyword stuffing
(many listed skills, little supporting evidence) caps the skills score and warns. Limits: English resumes in plain text; 46-skill demo taxonomy;
"X or Y" alternatives in job descriptions are not modelled.

## B. `interview`

`list_questions`, `next_question({"role","interview_type","history"})`, `evaluate({"question_id","answer_text"}, llm=None)`,
`topic_performance`, `practice_plan`, `evidence_from_evaluations`. The caller stores the returned `history_item`; nothing is persisted here.
Student-facing views never include reference answers.

Technical answers are scored on concept coverage (bare list items earn partial credit), similarity to a reference answer, misconception
penalties, reasoning markers and completeness, with a cap when an answer is a keyword list. HR answers are scored on STAR structure,
examples, clarity and relevance. Results are `status: automated_unverified`, confidence is never "high", and low-confidence results
produce no skill evidence. With an `llm`, the LLM's JSON must validate, quoted evidence must appear verbatim in the answer, scores are
averaged with the deterministic score, large disagreement lowers confidence, and any failure falls back to deterministic output.
The bundled bank has 24 demo questions (18 technical, 6 HR); replace it with a reviewed bank.

## C. `opportunity_matching`

`match_opportunities({"profile","opportunities","weights"?,"top_k"?,"include_ineligible"?})`, `check_opportunity_eligibility`.
Opportunities (jobs, internships, startup tasks) are supplied by the backend, and invalid records are skipped with a warning. Eligibility
rules (graduation year, CGPA, experience, degree, location) give pass / fail / **unknown** and are separate from ranking; unknown eligibility
is shown, not treated as a pass or fail. Score = configurable weights (required coverage 0.45, preferred 0.15, text similarity 0.25,
preference fit 0.15) where skill credit depends on evidence level (declared 0.5; demonstrated/verified scale with strength). The score
is a **fit indicator, not a hiring probability**.

## D. `skill_gap`

`analyze_skill_gap({"profile","role_id"?,"interview_evaluations"?,"extra_evidence"?,"top_n"?})`, `reassess(payload, new_evidence)`, `list_roles()`.
Roles (`ml_engineer`, `data_analyst`, `full_stack_developer`, demo-only) list skills with importance and prerequisites. Per-skill status:
`met`, `developing`, `demonstrated_weakness`, `self_reported_use` (resume-only, credit capped), `missing_evidence` (declared only),
`unassessed` (no information - explicitly not a weakness). Output includes readiness with lower/upper bounds, `evidence_sufficiency`
(low/medium/high), priority (importance × severity × prerequisite unlocks), `blocked_by`, and plain-language explanations.
The score is an evidence-based progress indicator, not a measure of employability.

## E. `roadmap`

`generate_roadmap(payload)` (same payload as D, plus `include_projects`, `max_items`), `update_roadmap(payload, new_evidence=..., completed_activity_ids=...)`.
The planner orders gap skills by priority but never before their unmet prerequisites; chooses an activity path by evidence status
(a resume-only skill gets a reviewed task, not a course; an unassessed skill gets a diagnostic first); skips completed activities
(a persistent weakness after the full path escalates to a mentor suggestion instead of repeating); lays steps out against `weekly_hours × timeline_weeks`;
and lists anything that does not fit under `deferred` with reasons. Each item has objective, reason, expected evidence and completion criteria.
Mentor sessions are suggestions only (no cost or availability here), and zero session budget removes paid suggestions. Missing constraints are defaulted (6 h/week, 8 weeks) and flagged.
The activity catalog is generic and synthetic (no real course names or URLs).

## F. `practical_tasks`

`list_tasks`, `recommend(payload)`, `evaluate(task_id_or_task, submission_text, emit_evidence=False)`, `interpret(text)`, `record_review(result)`, `portfolio_feedback(text)`.
- `recommend` targets open gaps, respects prerequisites assessed as weak, time budget and completed tasks, and explains why each task is not recommended.
- `evaluate` checks rubric elements (concepts, sections, length). It **cannot judge correctness**; criteria of type `human` are marked `needs_human`. Output is always `preliminary_unverified` with `human_review_required: true`. Optional evidence is `task_auto`, strength ≤ 0.5 (below the 0.6 "met" threshold), withheld for keyword lists, injections and very short text.
- `record_review` is the **only** path to verified task/portfolio evidence. Call it only from your authenticated reviewer workflow.
- `interpret` drafts skills, difficulty, hours and acceptance criteria from a free-text task, flags risks (fees, credential requests, injection) and requires human confirmation.
- `portfolio_feedback` reports documentation completeness (problem, approach, stack, results, limitations, how to run), over-claims, and unverified links. It is not an assessment of quality or authorship.
No task-posting, submission storage, payment or booking exists in this package.

## G. `mentor_recommendation`

`recommend_mentors({"profile","role_id"?,"mentors","availability"?,"languages"?,"session_minutes"?,"limit"?})`. Mentors are supplied by the backend (the bundled 10 are labelled synthetic).
Hard filters: not accepting students, price above budget (when known), no availability overlap of the session length (when known). **Unknown price/availability is flagged, not guessed or excluded.**
Score: gap fit (priority-weighted mentor depth) 0.55, text similarity 0.15, role 0.10, rating 0.10 (shrunk toward a neutral prior so few reviews carry little weight; omitted if absent), language 0.05, experience 0.05, renormalised over known signals. No protected attributes are in the schema. `booking_performed` is always `false`.

## H. `university_analytics`

`cohort_analytics(records, group_by="department", k=10, default_role_id=None)`. Records are pseudonymous (`department`, `program`, `graduation_year`, `target_role`, `profile`, `placed`); identifying fields are rejected.
Groups with fewer than `k` students (k ≥ 5 enforced) are pooled; if the pool is still below `k` a larger group is absorbed so counts cannot be recovered by subtraction; if nothing can be released, only an explanatory note is returned. Skill rates require ≥ `k` assessed students; placement rates require ≥ `k` known outcomes.
"Unassessed" is reported separately and never counted as weak; unknown placement is not "not placed". Output never contains individual rows or ids, and carries interpretation caveats (no predictions or guarantees).

## Agent (`agent`)

`run_agent(payload, llm=None)`, `confirm_action(session, action_id, user_confirmed=)`, `list_tools()`. See ARCHITECTURE.md and the integration guide.
Request fields: `session`, `target_role`, `goals`, `resume_text`, `interview_answers`, `reviewed_results` (from your review pipeline only), `opportunities`, `mentors`, `availability`, `user_message`, `options`.
Response: `summary`, `results` (full module outputs), `stages_run`, `stages_skipped` (with reasons), `needs_input`, `proposed_actions`, `refused_requests`, `security_notes`, `verification`, `trace`, updated `session`, `limitations`.
