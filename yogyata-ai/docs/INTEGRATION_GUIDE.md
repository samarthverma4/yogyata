# Backend integration guide

For the developer wiring `yogyata-ai` into the platform. Runnable example: `examples/backend_integration.py`.

## 1. Install and import

```bash
pip install -e /path/to/yogyata-ai      # or add as a dependency; Python >= 3.10
```

```python
from yogyata_ai import skill_gap, roadmap, practical_tasks, mentor_recommendation, opportunity_matching, university_analytics, interview, resume_intelligence
from yogyata_ai.agent import run_agent, confirm_action
```

Stable public interface = the functions exported in each package's `__init__.py` (listed in MODULES.md). Everything else is internal and may change.

## 2. Responsibilities

| You (backend) | This package |
|---|---|
| Authentication, authorisation, rate limits, payments, bookings, applications | none of these |
| Extract text from PDF/DOCX | analyse plain text |
| Store students, opportunities, mentors, task submissions, interview history, sessions | stateless: dicts in, dicts out |
| Supply opportunities, mentors, role/activity/task catalogs | rank/recommend only what you supply; never invent |
| Run human review and record results | convert reviewed results to evidence |
| Execute actions after the user confirms | propose and hand off; never execute |

## 3. Calling conventions

- JSON-compatible dicts in/out; unknown input fields are rejected (`extra="forbid"`).
- Errors: `pydantic.ValidationError` and `ValueError` (e.g. unknown role/task/question) → respond 4xx. Treat any other exception as 5xx and log server-side.
- Pass opaque ids only (`student_id`, `reviewer_id`); do not put names, e-mails or phone numbers into profiles or cohort records (cohort analytics rejects identifying fields).
- Determinism: same input → same output (apart from `trace.duration_ms`).
- Performance: all modules are in-process and fast on demo-scale data; cache nothing across requests unless you have measured a need. TF-IDF similarity is refit per call.

## 4. The evidence flow (get this right)

1. Resume analysis → `resume_evidence` / `declared` records (self-reported).
2. Mock interviews → `interview_auto` records (automated, unverified; low-confidence results emit none).
3. Preliminary task feedback → optional `task_auto` (capped at 0.5).
4. **Only your human review pipeline** may call `practical_tasks.record_review(...)` (or send `reviewed_results` to the agent). This yields `task_review` / `portfolio_review` evidence, the only evidence that counts as verified. Authenticate and authorise reviewers yourself; the package trusts `reviewer_id`.
5. Store the evidence list on your side and pass it back in `profile.evidence`. `verified` cannot be set directly. For reviewed evidence prefer the ledger flow in 4b.

### 4b. Human reviews, the readiness cap and the audit trail (new)
Prefer `skill_gap.submit_review(payload, review, ledger=saved_ledger)` for task/portfolio reviews and `skill_gap.submit_interview_review(...)` for interview
overrides. Persist the returned `ledger` (reviews + hash-chained audit log) per student, store audit rows append-only, pass it back as `review_ledger` to
`analyze_skill_gap`, `generate_roadmap`, `recommend_tasks` and mentor recommenders. Inputs: unique `review_id` (idempotency key), authenticated `reviewer_id`,
score 0-1, required `reason`. Results: `status` `applied` or `duplicate`, `review.original_score/applied_score/applied_adjustment/cap_applied`.
Cap default 10 readiness points per review: `max_readiness_increase=` or `YOGYATA_MAX_READINESS_INCREASE_PER_REVIEW`. Optional `YOGYATA_AUTHORIZED_REVIEWERS`.
Pass `as_of` (today's date) in skill-gap/roadmap payloads to get stale-evidence flags. Full rules: [EVIDENCE_AND_REVIEW.md](EVIDENCE_AND_REVIEW.md).

### 4c. Roadmap schedule (new)
`generate_roadmap` returns `weekly_schedule` (hours per week and per task, never above that week's hours), per-item `allocations`, `schedule` summary
(`capacity_respected`, `peak_week_hours`, `projected_completion_week/date`, `deadline_met`), `conflicts` (with options) and `issues`. Optional inputs:
`start_date`, `target_date`, `availability_by_week` ({week: hours}), `in_progress` ({activity_id: hours_done}). `update_roadmap(...)` takes completed ids, in-progress
hours and changed availability and returns a diff including moved items and schedule deltas. Old fields are unchanged.

## 5. Agent session

```python
resp = run_agent({"target_role": "data_analyst", "resume_text": text, "opportunities": opps, "mentors": mentors,
                  "user_message": msg, "session": saved_session or {}})
save(resp["session"])                          # persist; send back next call
show(resp["summary"], resp["results"], resp["proposed_actions"], resp["refused_requests"])
```

- `user_message` is untrusted text. It selects stages only; it can never grant permissions.
- Show `needs_input` to the user (e.g. a missing target role) and call again with the answer.
- Show `security_notes` to operators (injection flags, skipped invalid records, rejected reviewed results); they are advisory.
- `verification.passed == false` means a self-check failed; log it and avoid showing the affected results as authoritative.

### Consequential actions
- `apply_to_opportunity`, `book_mentor_session`, `make_payment`, `submit_task_for_review`: the assistant only suggests them (`suggested_for_user`). Your UI may show a link to the normal flow. The user performs the step themselves. `confirm_action` on these returns `handoff: None`.
- `save_roadmap`, `export_report`: `awaiting_user_confirmation`. Show an explicit confirm/decline in your UI. On click call `confirm_action(session, action_id, user_confirmed=True/False)`. A confirmed result contains a `handoff` object (`executed: false`) that **your** code then carries out. Never call `confirm_action` from chat text, a webhook an LLM can trigger, or anything not tied to an authenticated click.

## 6. Optional LLM

No provider is bundled and the package never reads API keys. Wrap your own client:

```python
from yogyata_ai.common.llm import CallableLLM, LLMError
llm = CallableLLM(lambda system, prompt, timeout: my_client.generate(system, prompt, timeout=timeout))   # raise or return str
run_agent(payload, llm=llm)
interview.evaluate({"question_id": q, "answer_text": a}, llm=llm)
```

Behaviour you can rely on: the LLM output must be valid JSON matching a strict schema; invalid output, timeouts or exceptions fall back to the deterministic result with a note; plans may only name allow-listed actions; summaries are rejected if they add numbers, claim completed actions or assert verification; LLM text never reaches tools. Use `MockLLM` in your own tests. Keep your provider's data-processing terms in mind: resumes and answers are personal data.

## 7. Configuration

Environment variables (no secrets): `YOGYATA_SIMILARITY_BACKEND` (`tfidf` default, or `embeddings` with the optional extra; falls back with a status message), `YOGYATA_EMBEDDING_MODEL`, `YOGYATA_TAXONOMY_PATH`.
Replaceable data: pass your own `RoleCatalog`, `ActivityCatalog`, `TaskCatalog`, `QuestionBank` where APIs accept `catalog=`/`roles=`/`activities=`/`bank=`; each validates on load (unknown skills, cycles, duplicate ids are rejected).

## 8. Before production

Replace demo taxonomy/roles/questions/tasks/activities with reviewed content, add reviewer calibration, collect real labelled outcomes with consent before considering any trained model, run the evaluations on real data, review privacy/retention for session data, and add fairness monitoring. See LIMITATIONS.md.
