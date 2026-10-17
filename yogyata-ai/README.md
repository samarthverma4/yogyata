# yogyata-ai

The AI/ML and agentic layer for **Yogyata**, an AI career development, mentorship and employment platform. It is an
independent Python package: no frontend, authentication, payments, mentor-booking system or web app. A backend developer
imports a small set of JSON-in / JSON-out functions (see [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md)).

Everything runs **offline, deterministically, without an API key**. An LLM is optional and only ever wraps a deterministic
fallback. All bundled data are **synthetic demonstration data**, and all reported metrics are sanity checks on tiny
author-labelled sets, not estimates of real-world performance (see [docs/LIMITATIONS.md](docs/LIMITATIONS.md)).

## What is inside

| Module | Package | Purpose | Approach |
|---|---|---|---|
| A | `resume_intelligence` | Resume and LinkedIn-text parsing, quality score, skill/education/experience/project extraction, resume-vs-job comparison, profile building | **Rules** + TF-IDF similarity (optional pretrained embeddings) |
| B | `interview` | Question selection, answer evaluation, topic performance, practice plan | **Hybrid, deterministic**: concept coverage + similarity + misconception rules; optional **LLM** blend with verification |
| C | `opportunity_matching` | Jobs / internships / startup-task ranking with explanations | **Rules** (eligibility) + weighted scoring + TF-IDF (optional embeddings) |
| D | `skill_gap` | Evidence-based gap analysis for a target role | **Rules** |
| E | `roadmap` | Personalised, prerequisite- and time-aware roadmap, updates on new evidence | **Rules** planner over an activity catalog |
| F | `practical_tasks` | Task recommendation, task-description interpretation, preliminary feedback, reviewed results to evidence, portfolio documentation feedback | **Rules** |
| G | `mentor_recommendation` | Mentor ranking with budget/availability filters (no booking) | **Rules** + TF-IDF |
| H | `university_analytics` | Cohort analytics with small-cohort suppression | Aggregation + privacy rules |
| - | `agent` | One controlled Career Assistant: bounded workflow, typed tools, mock mode, optional LLM | Deterministic state machine; optional **LLM** planner/explainer, validated |
| - | `common` | Shared taxonomy, schemas, evidence model, similarity backends, LLM adapter, safety utilities | - |

No model is trained: there is no real labelled data, so there is no supervised training and no learned weights. No LLM is
trained, and none is required.

## Install and run

```bash
cd yogyata-ai
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"          # core: pydantic, pandas, numpy, scikit-learn, pytest
# optional pretrained embeddings (not required; untested in the reference run):
# pip install -e ".[embeddings]" && export YOGYATA_SIMILARITY_BACKEND=embeddings

pytest -q                                   # all tests
python scripts/demo_end_to_end.py           # full walkthrough, no API key
python scripts/run_all_evaluations.py       # every evaluation -> reports/*.json
python examples/backend_integration.py      # how a backend wraps the functions
```

## The evidence model (the idea everything shares)

A skill is never "known" because a student says so. Each skill has a level, computed from evidence records:

`none` (no information) → `declared` → `demonstrated` (resume use, automated interview/task feedback) → `verified`.

`verified` exists **only** when a human-review source (`task_review`, `interview_review`, `portfolio_review`) is present, and callers
cannot set it (`extra="forbid"`; it is a computed property). Automated results are labelled `automated_unverified`, and recommending
or submitting a task never changes a skill's status. "Unassessed" means unknown, never weak.

Each skill also gets one explicit **evidence state**: `demonstrated`, `partially_demonstrated`, `mentioned_unverified`, `not_assessed`, `missing_evidence`
(rules, freshness and conflict handling in [docs/EVIDENCE_AND_REVIEW.md](docs/EVIDENCE_AND_REVIEW.md)). Human reviews go through a ledger with a configurable
per-review readiness cap (default 10 points), duplicate protection and a tamper-evident audit trail; reviewers can override automated interview assessments
without erasing the original.

## Quick start (Python)

```python
from yogyata_ai import skill_gap, roadmap
from yogyata_ai.agent import run_agent

payload = {"role_id": "data_analyst",
           "profile": {"declared_skills": ["SQL"], "weekly_hours": 6, "timeline_weeks": 6}}
gap = skill_gap.analyze_skill_gap(payload)       # dict, JSON-serialisable
plan = roadmap.generate_roadmap(payload)

reply = run_agent({"target_role": "data_analyst", "user_message": "Give me a roadmap and apply to the best job for me"})
reply["refused_requests"]    # the assistant never applies, books or pays; it says so and explains
```

## Safety stance (summary; details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md))

- The agent has no tool that applies, books, pays, runs shell/SQL/code, or reaches the network. `propose_external_action` only records a proposal and always reports `executed: false`.
- Resumes, job descriptions, answers, mentor bios and any retrieved text are **data**. Injection detection is advisory; the real defence is architectural (untrusted text can never choose tools, change permissions or set scores).
- Verification step re-checks every response against tool results; fabricated ids, "verified" claims without review and claims of completed actions are caught.
- Analytics suppress small groups (k ≥ 5 enforced, default 10) with complementary suppression; "missing" is never reported as "poor".
- Contact details are not copied to profiles and are redacted from agent output.

## Evaluation results actually produced

Run `python scripts/run_all_evaluations.py`; full JSON in `reports/`. All data are synthetic and labelled by the author, so treat as sanity checks (details and circularity caveats in each report's `disclaimer`).

| Module | Result |
|---|---|
| A resume | skill extraction P/R/F1 = 1.0/1.0/1.0 (56 skills, 8 resumes; the author wrote both resumes and labels); quality score Spearman 0.945 vs bands; structure extraction exact-match 1.0; evidence-aware job comparison nDCG 0.995, top-1 1.0 vs baseline `match_job` 0.96 / 0.75 (the improvement targeted a known failure, so it is not independent evidence) |
| B interview | vs author ratings (n=25): MAE 6.8, Spearman 0.952, within ±15 = 92%; stuffed answers score 56-66 points below strong answers. Some tuning happened while viewing these samples |
| C matching | P@3 0.867 (ceiling given labels), nDCG@3 1.0 vs TF-IDF-only 0.953 and plain coverage 0.906; eligibility exact match 6/6; stuffing-resistance pairs 4/4 vs 2/4 for both baselines |
| D skill gap | 45/45 hand-specified scenario assertions; 4 consistency properties hold (order invariance, monotonic with verified evidence, unknown ≠ weakness, declared never "met") |
| E roadmap | 12 invariants hold on 54 profile × constraint roadmaps (weekly capacity never exceeded, allocations consistent, honest deadline conflicts, prerequisites, no repeats, determinism, update behaviour) |
| Evidence/review | 9 invariants hold (state/status consistency, cap never exceeded in any role, duplicates are no-ops, audit chain intact and append-only, capped scores never labelled weakness) over 225 review sweeps |
| F tasks | preliminary-feedback Spearman 0.926 vs author element-presence ratings (n=16); keyword-stuffed 3/3 and injection 2/2 handled; automated evidence always < 0.6 and flagged for human review |
| G mentors | nDCG@3 0.992 vs text-only 0.788 (6 cases, synthetic mentors; one label was corrected after a first run, disclosed in the label file); 0 hard-constraint violations in 24 recommendations |
| H analytics | planted gaps recovered 3/3; 5 privacy invariants hold on 200 random cohorts |
| Agent | 192/192 tool calls succeeded over 24 end-to-end runs; verification 24/24; 12/12 failure scenarios recovered; 36/36 injection cases held (nothing executed). Scripted mock LLMs only; advice quality is not measured |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - layout, evidence model, agent design, safety
- [docs/MODULES.md](docs/MODULES.md) - per-module reference (inputs, outputs, algorithm, classification)
- [docs/EVIDENCE_AND_REVIEW.md](docs/EVIDENCE_AND_REVIEW.md) - evidence states, review cap, audit trail, interview override
- [docs/INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md) - how the backend should call, persist, authorise and confirm
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md) - honest limits and what to do before production
- [docs/STATUS.md](docs/STATUS.md) - audit and completion checklist
- `docs/samples/*.json` - real request/response pairs generated by `scripts/generate_samples.py`
