# Limitations

Read these before relying on any output.

## Evidence and evaluation
- All bundled data (resumes, questions, opportunities, mentors, tasks, activities, roles) are **synthetic, written by the project author**. Labels were assigned by the same author, usually before running the system, but a single rater on 5-25 items cannot estimate real-world performance. Some thresholds/rules were adjusted after looking at errors on the same samples (for example in interview scoring and in the evidence-aware comparison that fixed a known failure), so those results are optimistic.
- Metrics such as F1 = 1.0 mean the rules reproduce the author's expectations on the author's data, not that extraction is perfect.
- The agent evaluation uses scripted mock LLMs and tests control logic (bounds, allow-lists, no executed actions, verification), not advice quality or helpfulness.
- The embedding backend (`sentence-transformers`) is implemented but was **not installed or evaluated** in the reference environment.
- No model is trained. Nothing here predicts hiring, placement or success; scores are indicators for guidance.

## Module-specific
- **Taxonomy/roles:** 46 skills and three demo roles. Unrecognised skills are invisible; roles need expert review. "X or Y" alternatives in requirements are not modelled; synonyms outside the alias list are missed.
- **Resume:** English plain text; heuristics for sections, dates, degrees. Unusual layouts, tables, multi-column PDFs (after extraction) and non-English text will degrade results.
- **Interview:** lexical concept matching can under-score correct answers phrased very differently, and over-score a fluent answer that happens to hit the concept lists. Confidence is therefore never "high". Treat scores as practice feedback, not assessment. Only 24 demo questions.
- **Matching:** relies on declared requirements; unstated requirements and soft factors are not considered. Eligibility is only as good as the profile data (unknown stays unknown).
- **Skill gap:** statuses reflect available evidence, and thin evidence yields wide readiness bounds by design. Prerequisite graphs are simplified.
- **Roadmap:** the activity catalog is generic (no real courses or links) and the planner assumes sequential work; reviewer turnaround time is not modelled. Hours estimates are placeholders.
- **Tasks:** preliminary feedback checks the presence of expected elements; it cannot assess correctness, originality or authorship, and a determined student can still pad text with explanations that pass. Hence the 0.5 cap and mandatory human review. Portfolio links are not fetched or verified.
- **Mentors:** only declared expertise is used; no outcome data, so no learned quality signal. Availability is recurring weekly windows in one timezone supplied by the backend.
- **Analytics:** k-anonymity-style suppression and subtraction protection within one report. It does not defend against an adversary combining many differently-grouped reports or external data, and does not add noise (no differential privacy). Define who may query which groupings.
- **Agent:** one run is bounded and deterministic by default; the LLM path is optional and was exercised only with mocks. Injection detection is regex-based and incomplete by nature; the architecture, not detection, is the defence.

## Safety limits
- `reviewer_id` and `reviewed_results` are trusted inputs. If your backend lets users reach them, they can forge verified evidence. Gate them behind authenticated reviewer workflows.
- `confirm_action` must be tied to an authenticated user click.
- Redaction of e-mails/phones in agent output is best effort (regex).
- The package does not encrypt, store or expire data; session retention is the backend's decision.

- **Evidence states / review cap / audit:** thresholds (0.60/0.625 demonstrated bar, 365-day staleness, 0.35 conflict spread, 10-point cap) are documented defaults, not validated. Staleness is flagged, not discounted. The audit log is tamper-evident, not tamper-proof; the database must be append-only. The ledger inside an agent session is trusted like any session field.
- **Roadmap schedule:** whole-task allocation means a week can have unused hours when the next task does not fit; hours-per-task are catalog estimates, not measured effort.

## Not built (by design)
Frontend, authentication, payments, booking, task-posting, submission storage, a database, job scraping, multi-agent orchestration, model training.

## Suggested next steps
1. Expert review of taxonomy, roles, questions, activities and rubrics. 2. Collect consented, human-rated data (multiple raters, agreement statistics) and re-run all evaluations. 3. Evaluate the embedding backend and an LLM path on real data behind the existing validators. 4. Add reviewer calibration and appeal flows. 5. Add monitoring for score drift and group disparities. 6. Define analytics access policy and consider noise addition.
