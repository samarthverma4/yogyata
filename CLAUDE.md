# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Note: `~/Downloads/CLAUDE.md` (the parent directory) describes an unrelated project ("CardioMap"). It is loaded as project instructions but does **not** apply here — ignore it when working in this repo.

## Commands

Web app (repo root):

```bash
npm install
npm run dev        # Vite dev server (5173), proxies /ai -> localhost:8787
npm run build      # tsc -b && vite build  (typecheck is part of build)
npm run lint       # oxlint (.oxlintrc.json)
npm run preview
```

Needs `.env.local` (copy `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. `src/lib/supabase.ts` throws at import time if either is missing. Optional `VITE_AI_URL` points the AI client somewhere other than the Vite proxy.

AI service (`yogyata-ai/`, FastAPI + the `yogyata_ai` package):

```bash
npm run ai:setup   # uv venv .venv (py 3.12) + pip install -e ".[dev]" -r server/requirements.txt
npm run ai         # uvicorn server.app:app --port 8787 --reload; docs at /ai/docs
```

Python tests and evaluations run from `yogyata-ai/` with that venv:

```bash
cd yogyata-ai
.venv/bin/pytest -q                                   # all tests
.venv/bin/pytest tests/skill_gap/test_skill_gap.py -q # one file
.venv/bin/pytest tests/agent/test_agent.py::test_name -q
.venv/bin/python scripts/demo_end_to_end.py           # offline walkthrough, no API key
.venv/bin/python scripts/run_all_evaluations.py       # regenerates reports/*.json
```

Database rules (RLS, approval gate, one email per role) are tested in Postgres, not in JS: paste `supabase/tests/role_rules_test.sql` or `workspace_rules_test.sql` into the Supabase SQL editor. Each ends by raising an error starting with `RESULT:` listing `ok<n>`/`FAIL<n>`; the error rolls the whole test back.

There is no frontend test runner.

## Architecture

### Routing and role dispatch

`src/App.tsx` has four routes: `/` (role picker), `/auth/:role`, `/auth/reset`, `/app/:area?`. `src/pages/RoleHome.tsx` is the hub for everything signed in and encodes the access rules:

- the role comes from `public.profiles.role` in Supabase, never from the URL; `area !== profile.role` redirects to the user's own area;
- `mentor` and `recruiter` are gated (`src/lib/authRules.ts`) — they see a waiting/not-approved screen until `profile.approval === 'approved'`;
- a login started from another role's page signs the user back out and returns them there (`src/lib/intendedRole.ts`);
- each role's onboarding and workspace is `React.lazy`-loaded; whether onboarding is still needed is decided by whether that role's detail row exists (`seeker_details`, `mentor_profiles`, `recruiter_profiles`).

`src/lib/auth.tsx` (`AuthProvider`) owns session + profile. Profiles are stored with the `userId` they were fetched for, so a profile belonging to a previous account reads as `undefined` ("loading") rather than leaking across a sign-out. It calls `setStorageOwner()` during render, before children read browser storage.

### Supabase data layer

All Supabase access lives in `src/lib/*Data.ts` (`seekerData`, `seekerGrowth`, `mentorData`, `recruiterData`, `talentData`, `reviewData`, `postingData`, `founderReview`, `founderSync`); screens import those functions instead of the client. Each returns `{ error?: string }` and runs messages through a local `friendly()` that turns RLS/constraint errors into user-facing sentences. Keep that shape when adding calls.

Anything privileged is a Postgres function called via `supabase.rpc(...)`, so the rule is enforced in the database: `endorse_submission_skill`, `mentor_review_skill`, `respond_mentorship_request`, `search_talent`, `submit_assessment`, `current_user_role`. Do not reimplement these checks client-side.

The schema itself is **not** in this repo (no migrations directory) — it lives in the Supabase project. `src/lib/database.types.ts` is the generated types, hand-compacted (`Update = Partial<Insert>`, shared `Table`/`Rel` helpers) with app-facing aliases (`Profile`, `TaskRow`, `PassportSkill`, …) at the bottom. Regenerate with `npx supabase gen types typescript --project-id uusdczvfaklszlkxqpgs` and re-apply the compaction.

Skill levels are the core domain model: `declared` → `assessed` → `verified`, where `verified` only comes from a founder endorsement or a mentor review (via the RPCs above).

### Workspace state pattern

The mentor, recruiter, seeker and founder screens came from the `deepak` branch and work on one large in-memory state object (`<role>-workspace/types.ts`). The adaptation to Supabase is:

- **mentor / recruiter**: `loadMentorWorkspace(userId, email)` / `loadRecruiterWorkspace(userId)` build that object from Supabase; edits go through per-action functions, and `syncMentorWorkspace(userId, prev, next)` diffs the object and writes back.
- **seeker**: no state object — `SeekerWorkspace` fetches per-tab data directly through `seekerData`/`reviewData`/`talentData`.
- **founder**: localStorage-first. `founder-workspace/storage.ts` is the source of truth; `<FounderWorkspace cloudSync />` additionally mirrors tasks into Supabase via `syncFounderTasks` (upsert on `founder_id,client_id`, workspace ids kept in `client_id`) and reads submissions from the cloud.

Two conventions to preserve: every browser-storage key goes through `scopedKey()` in `src/lib/storageScope.ts` (keys are per account, so a shared browser never mixes two users' drafts), and `ours/` subfolders inside a workspace hold components added in this repo on top of the upstream screens.

### AI layer

`yogyata-ai/` is an independent Python package (`src/yogyata_ai/`: `resume_intelligence`, `interview`, `opportunity_matching`, `skill_gap`, `roadmap`, `practical_tasks`, `mentor_recommendation`, `university_analytics`, `agent`, `common`). It is deterministic, offline, JSON-in/JSON-out, needs no API key, and trains nothing; an LLM is optional and only ever wraps a deterministic fallback. Its public interface is what each package's `__init__.py` exports — see `yogyata-ai/docs/MODULES.md` and `INTEGRATION_GUIDE.md`; everything else is internal.

`yogyata-ai/server/app.py` is the only bridge and holds the security model:

- reads `VITE_SUPABASE_*` from the repo-root `.env.local` so both sides share one config; there is **no service-role key**;
- the `caller` dependency verifies the browser's Supabase access token against `/auth/v1/user`, loads `role`/`approval`, and rejects unapproved accounts; `seeker_only` / `founder_only` gate each endpoint;
- every Supabase read is made *with the caller's token*, so RLS decides visibility;
- it never writes to Supabase, applies, books or pays. Results are advice the user then acts on in the normal screens. Keep it that way when adding endpoints.
- package `ValidationError`/`ValueError`/`KeyError` become 400s through the `_call` helper.

The frontend talks to it only through `src/lib/aiClient.ts`, which attaches the access token, prefixes `/ai`, and throws `AiError` (including the "not running — start it with `npm run ai`" case) so screens degrade gracefully when the service is down. Consumers: `seeker-workspace/tabs/AiCoachTab.tsx` and `founder-workspace/TaskAiCheck.tsx`.

## Styling

Plain CSS, no framework: `src/index.css` (bulk of the app), `src/yogyata.css` (brand tokens — `--brand`, `--ink`, Anek Devanagari/Hind — plus the public pages), and per-workspace `workspace.css` files (the mentor, recruiter and seeker workspaces all import `founder-workspace/workspace.css` as the base). Icons come from `lucide-react`; brand assets from `src/brand/`.

## Git

Default branch for PRs is `deepak` (not `main`). `origin/Riddhima` is where the `yogyata-ai` package came from; current work branch is `yogyata-style`.
