# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> `~/Downloads/CLAUDE.md` (the parent directory) describes an unrelated project ("CardioMap"). It is loaded as project instructions but does **not** apply here — ignore it when working in this repo.

## What this is

Yogyata (योग्यता) — a skills marketplace where students prove what they can do. Four roles share one Supabase backend:

- **Entrepreneur**: posts real startup tasks, reviews submissions, endorses skills as Verified.
- **Seeker**: builds a Skill Passport (Declared, Assessed, Verified), takes server-graded assessments, solves founder tasks, applies to jobs, works with mentors, follows a career roadmap.
- **Mentor** (approved accounts only): answers mentorship requests, runs sessions, gives feedback, assesses declared skills.
- **Recruiter** (approved accounts only): searches opted-in talent, publishes job postings, runs a pipeline, interviews and scorecards.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check (`tsc -b`) then production build
- `npm run lint` — run Oxlint
- `npm run preview` — preview the production build

- `npm run ai:setup` — once, to build the AI service venv (needs [uv](https://docs.astral.sh/uv/); Python 3.10+)
- `npm run ai` — run the AI bridge on port 8787 (`npm run dev` proxies `/ai` there); OpenAPI docs at `/ai/docs`

There is no frontend test script. The Python side has one, run from `yogyata-ai/` with the venv that `npm run ai:setup` created:

```bash
cd yogyata-ai
.venv/bin/pytest -q                                   # package tests + server/tests
.venv/bin/pytest server/tests/test_api.py -q           # one file
.venv/bin/pytest server/tests/test_api.py::test_name -q  # one test
.venv/bin/python scripts/demo_end_to_end.py            # offline walkthrough, no API key
.venv/bin/python scripts/run_all_evaluations.py        # regenerates reports/ (gitignored)
```

`pyproject.toml` sets `testpaths = ["tests", "server/tests"]`, so a bare `pytest` covers both the package and the HTTP bridge; `server/tests/test_api.py` stubs Supabase, so it never touches the network. Database rules are verified separately with the SQL scripts in `supabase/tests/` (see below).

### Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase project (Project Settings > API Keys). `src/lib/supabase.ts` throws at startup if either is missing. The AI bridge reads the same `.env.local` from the repo root, so both sides share one config.

## Architecture

### Auth and routing gate

- `src/lib/auth.tsx` (`AuthProvider`) holds the Supabase `session` and the matching row from `public.profiles`. `session` is `undefined` while unresolved, `null` when signed out. `profile` mirrors that three-state pattern per-user: it reads as `undefined` ("loading") whenever the loaded profile doesn't yet match the current `userId`, which also covers account switches.
- `src/App.tsx` has exactly four routes: `/` (role picker), `/auth/:role` (sign in/up), `/auth/reset` (password reset — deliberately not gated behind `PublicOnly`, since the reset link signs the user in), and `/app/:area?` which renders `RoleHome`.
- `src/pages/RoleHome.tsx` is the single dispatcher after login: it reads `profile.role` from Supabase (never from the URL) and renders that role's onboarding-or-workspace. It also enforces that a profile's real role matches the role the user attempted to log in as (tracked via `src/lib/intendedRole.ts` through `sessionStorage`, compared after sign-in, signs out on mismatch). Every role goes straight to its workspace — see the note on the approval gate below.
- Each role's screens are `React.lazy`-loaded from `RoleHome`, so a seeker never pulls down founder/mentor/recruiter bundles.
- Per-role flow is **onboarding-once, then workspace**: `RoleHome` checks whether the role's onboarding data already exists (founder: `loadFounderWorkspace()` from localStorage; seeker/mentor/recruiter: a Supabase lookup) and renders the matching `*Onboarding` or `*Workspace` component accordingly.

### Per-account browser storage

`src/lib/storageScope.ts` namespaces every localStorage/sessionStorage key to the signed-in user's id (`setStorageOwner` is called once per render pass, before any storage read, in `AuthProvider`). This exists so two people sharing a browser never see each other's founder drafts. Any new code reading/writing browser storage for account data must go through `scopedKey()` rather than touching `localStorage`/`sessionStorage` directly.

### Workspace shape (per role)

Each of `founder-workspace/`, `seeker-workspace/`, `mentor-workspace/`, `recruiter-workspace/` follows the same shape: a top-level `*Workspace.tsx` holding current-tab state, a `tabs/` directory with one component per nav section, and a sidebar. Mentor and recruiter workspaces share the generic `src/workspace-shell/WorkspaceShell.tsx` (sidebar + mobile drawer + header); founder and seeker workspaces have their own bespoke sidebars (`founder-workspace/Sidebar.tsx`, `seeker-workspace/SeekerSidebar.tsx`).

Components added in this repo on top of the upstream screens live in an `ours/` subfolder (`mentor-workspace/ours/`, `recruiter-workspace/ours/`), which keeps them separable from the code that came from the `deepak` branch.

### How each workspace gets its data

The upstream screens were written against one large in-memory state object per role (`<role>-workspace/types.ts`), and each role bridges that to Supabase differently — worth knowing before adding a feature to one of them:

- **mentor / recruiter**: `loadMentorWorkspace(userId, email)` / `loadRecruiterWorkspace(userId)` build the whole state object from Supabase; edits go through per-action functions, and `syncMentorWorkspace(userId, prev, next)` diffs the object and writes back only what changed.
- **seeker**: no state object at all — `SeekerWorkspace` fetches per-tab through `seekerData`/`reviewData`/`talentData`.
- **founder**: localStorage-first, and the exception to the rule above. `founder-workspace/storage.ts` is the source of truth; `<FounderWorkspace cloudSync />` additionally mirrors tasks into Supabase via `syncFounderTasks` (upsert on `founder_id,client_id`, so workspace-local ids survive in `client_id`) and reads submissions from the cloud.

Each role also has a matching `*-onboarding/` directory (`onboarding/` for seeker, `founder-onboarding/`, `mentor-onboarding/`, `recruiter-onboarding/`) with its own `steps/` subdirectory — a multi-step wizard pattern, each step as its own component, driven by a shared layout/progress component in that directory.

### Data access layer

`src/lib/*Data.ts` (`seekerData.ts`, `mentorData.ts`, `recruiterData.ts`, `talentData.ts`, `postingData.ts`, `reviewData.ts`, `founderSync.ts`, `founderReview.ts`, `seekerGrowth.ts`) are the only places that should call `supabase.from(...)` for their respective domain — workspace/tab components call into these rather than querying Supabase directly. Anything privileged is a Postgres function called through `supabase.rpc(...)`, so the rule is enforced in the database and not in the client: `endorse_submission_skill`, `mentor_review_skill`, `respond_mentorship_request`, `search_talent`, `submit_assessment`, `current_user_role`. Don't reimplement these checks client-side.

Skill levels are the core domain model: `declared` → `assessed` → `verified`, where `verified` only ever comes from a founder endorsement or a mentor review via those RPCs.

`src/lib/database.types.ts` holds the generated Supabase schema types (`Database`, `Profile`, `UserRole`, etc.) and is the source of truth for table/column shapes; regenerate it from the Supabase schema rather than hand-editing when the schema changes.

### The AI layer (`yogyata-ai/`)

`yogyata-ai/` is an independent Python package (9 modules: skill gap, roadmap, opportunity and mentor matching, resume and interview analysis, practical tasks, cohort analytics, and an agent). It is deterministic and rule-based — no model is trained — and its `docs/LIMITATIONS.md` is the honest account of what the scores do and do not mean. Run its tests with `pytest` from `yogyata-ai/`.

The React app cannot call it directly, because the models are Python and Supabase Edge Functions run Deno. `yogyata-ai/server/app.py` is the HTTP bridge (`npm run ai`, port 8787; `npm run ai:setup` once first), and `src/lib/aiClient.ts` is the typed client consumed by `AiCoachTab` and `TaskAiCheck`. `npm run dev` proxies `/ai` to the bridge, so `VITE_AI_URL` is only needed when it runs elsewhere.

Two invariants hold the trust model together, and both have tests:

- **The bridge never mints evidence.** Verified skills come only from `endorse_submission_skill` and `mentor_review_skill` in Postgres, where RLS decides who may promote a skill. The agent's `session` is therefore not a trust boundary: `session.profile`, `session.evidence` and `session.review_ledger` are re-derived server-side on every call, because each would otherwise let a caller grant themselves a Verified skill.
- **The bridge holds no service-role key.** Every read uses the caller's own access token, so it can never see more than that user could.

Translation between the two schemas lives in `server/app.py` and `server/vocab.py`: `passport_skills.level` becomes an evidence source plus a strength, app role labels map onto the three scored role catalogs (unmapped roles return `422 unsupported_role` rather than being scored against the wrong one), and free-text skill names are canonicalised against the 46-skill taxonomy with anything unrecognised returned as `unmapped_skills` so the UI can say which skills the model cannot see.

## Database rules live in Supabase, not in this repo

Row-level security, the mentor/recruiter approval gate, the one-email-per-role rule, skill endorsement/verification logic, and similar invariants are enforced by Postgres policies and functions in the Supabase project itself — there are no migration files in this repo. `supabase/tests/role_rules_test.sql` and `supabase/tests/workspace_rules_test.sql` are rolled-back scripts that exercise those rules: paste one into the Supabase SQL editor and run it; each ends by deliberately raising an error whose message starts with `RESULT:` and lists `ok<n>`/`FAIL<n>` per check, so the transaction rolls back and no test rows are left behind. When changing anything role/permission/verification-related, check these scripts for the behavior they assume and update them if the Supabase-side rules change.

Mentor and recruiter signup previously required a work email, enforced in two places: an `isFreeEmail` check in `src/lib/authRules.ts` and `private.is_free_email` in the database. Both have been disabled — the client check was deleted, and the database function was redefined to always return `false` (it keeps its name, with a `COMMENT` saying so). Personal addresses like Gmail are now accepted for every role.

The **admin approval gate has also been removed**. Mentor and recruiter accounts previously landed on a "Waiting for approval" screen until `profiles.approval` became `'approved'`, but nothing ever set it: no code path writes that column, and `src/components/AdminSignInModal.tsx` is unused dead code (its `onSubmit` is typed `() => void` and discards the credentials it collects), so approval was an unimplemented promise that blocked those two roles permanently. `RoleHome` no longer checks it and `GATED_ROLES`/`isGatedRole` are gone. The database still defaults new mentor/recruiter rows to `approval = 'pending'` and the `approval_status` enum still exists — the column is simply no longer read for gating. Reinstating a gate means building the admin side too, not just restoring the check.

When a signup rule in the trigger rejects a user, the browser only ever sees the generic `Database error saving new user`, which `friendlyAuthError` in `src/pages/AuthPage.tsx` maps to the "already has a Yogyata account" message. A trigger-side rejection therefore looks exactly like a duplicate email — when debugging signup, test the same role against a second email domain before trusting that message.

## Styling

Plain CSS, no framework. `src/index.css` carries the bulk of the app, `src/yogyata.css` the brand tokens (`--brand`, `--ink`, Anek Devanagari/Hind) and the public pages, and each workspace has a `workspace.css` — the mentor, recruiter and seeker workspaces all import `founder-workspace/workspace.css` as their base, so a change there is felt in all four. Icons come from `lucide-react`; brand assets from `src/brand/`.

## Git

PRs are based on `deepak`, not `main` (`origin/main` and `origin/deepak` are both active and have diverged). `origin/Riddhima` is where the `yogyata-ai` package came from.
