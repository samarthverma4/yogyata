# Architecture

## Layout

```
src/yogyata_ai/
  common/                 taxonomy (46 demo skills), schemas, evidence model, similarity backends, LLM adapter, safety, config
  resume_intelligence/    A   interview/            B   opportunity_matching/  C   skill_gap/       D
  roadmap/                E   practical_tasks/      F   mentor_recommendation/ G   university_analytics/ H
  agent/                  one controlled assistant (state machine + typed tools + verifier)
data/demo/                synthetic demo data + author labels      scripts/   evaluations, demo, sample generator
reports/                  evaluation outputs (real runs)           tests/     mirrors src/
examples/                 backend integration example              docs/      this documentation
```

Each module has a thin `api.py` (dict in, dict out, Pydantic-validated at the boundary) and keeps logic in plain functions.
Data (taxonomy, roles, activities, tasks, question bank) is JSON, validated on load, and replaceable.

## Shared contracts

- **Taxonomy** (`common/taxonomy.py`): canonical skill names, aliases, word-boundary matching. Override with `YOGYATA_TAXONOMY_PATH`.
- **StudentProfile / EvidenceRecord** (`common/schemas.py`): the only student representation passed between modules. Input models forbid unknown fields.
- **Evidence levels** (`common/evidence.py`): none / declared / demonstrated / verified; `verified` is computed from reviewed sources and cannot be set by callers.
- **Roles** (`skill_gap/roles.py`): required skills with importance 1-5 and validated prerequisite graphs (no cycles, canonical skills only).

## Component classification

| Component | Rules | Trained ML | Pretrained model | LLM |
|---|---|---|---|---|
| Resume parsing/scoring/extraction | yes | no | optional embeddings for similarity | no |
| Interview evaluation | yes (concepts, misconceptions, STAR) | no | optional embeddings | optional blend, verified |
| Opportunity matching | yes (eligibility, weights) | no | optional embeddings | no |
| Skill gap, roadmap, tasks, mentors | yes | no | TF-IDF only (mentors) | no |
| University analytics | aggregation + suppression | no | no | no |
| Agent | state machine, allow-lists, verifier | no | no | optional planner/summary, validated |

TF-IDF is a statistical text representation fitted per call; nothing is trained or persisted. "Trained ML: no" is deliberate: there
is no real labelled outcome data, and fabricating training data would produce meaningless models.

## The agent

One agent, no swarm. A fixed workflow with bounded steps:

`INTAKE (sanitise, flag, parse) → PROFILE (resume) → ASSESS (interview, reviewed results) → GAP → MATCH (opportunities, mentors, tasks) → ROADMAP → VERIFY → RESPOND`

- **Planner** picks which stages run, by deterministic keyword routing or an optional LLM. An LLM plan is accepted only if every action is in the allow-list and the output validates against a strict schema; otherwise routing falls back.
- **Tools** (`agent/tools.py`) are typed (`extra=forbid` argument models), allow-listed, and pure computations over supplied data. Per-run limits: tool-call budget (default 14, max 40) and a wall-clock deadline (default 30 s). Errors are recorded in the trace and surfaced, never hidden, and the run continues degraded rather than inventing results.
- **No consequential tools exist.** `propose_external_action` records `apply_to_opportunity`, `book_mentor_session`, `make_payment`, `submit_task_for_review` as `suggested_for_user` (never performed by the assistant, even when "confirmed") and `save_roadmap` / `export_report` as `awaiting_user_confirmation`. Every proposal has `executed: false` by schema.
- **Confirmation** is `confirm_action(...)`, called by your backend after an explicit user click. It is not a tool, so neither the planner nor any text can reach it. Even then the package only returns a hand-off for your code to execute.
- **Verification** re-derives facts from tool results: ids exist in supplied data, no executed actions, no "verified" skill without reviewed evidence, roadmap respects completed activities and budget, no claims of completed actions or invented numbers in the summary. An LLM summary that fails is discarded for the deterministic template.
- **State** lives in `AgentSession`, owned by your backend (the agent is stateless). It holds the profile, evidence, interview history, completed tasks and pending proposals, and no contact details.

## Safety design

| Risk | Control |
|---|---|
| Prompt injection via resume, JD, answers, mentor/opportunity text, chat | Text is data only; it cannot select tools or change permissions; advisory regex flags are reported in `security_notes`; LLM prompts wrap untrusted text in delimiters and spoofed delimiters are stripped |
| LLM misbehaviour | Strict JSON schema, allow-list for plans, number and claim checks for summaries, outage/timeouts fall back to deterministic output |
| Unauthorised actions | No tool can act externally; consequential kinds are suggestions or confirmation-gated hand-offs |
| Fabrication | Only supplied opportunities/mentors are recommended; "no data supplied" is reported, not filled; verifier checks ids |
| Over-claiming competence | `verified` only from reviewed sources; automated task evidence capped below the "met" threshold; submission or recommendation never changes status |
| Privacy | Contacts not copied into profiles; e-mails/phones redacted from agent output; trace stores argument sizes, not text; analytics suppress small groups and never return rows; only pseudonymous fields accepted |
| Secrets | The package never reads or logs API keys; the LLM client is injected by the integrator |
