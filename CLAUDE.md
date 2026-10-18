# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

There is no test script; database rules are verified with the SQL scripts in `supabase/tests/` (see below). No single-test runner exists for the frontend.

### Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase project (Project Settings > API Keys). `src/lib/supabase.ts` throws at startup if either is missing.

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

Each role also has a matching `*-onboarding/` directory (`onboarding/` for seeker, `founder-onboarding/`, `mentor-onboarding/`, `recruiter-onboarding/`) with its own `steps/` subdirectory — a multi-step wizard pattern, each step as its own component, driven by a shared layout/progress component in that directory.

### Data access layer

`src/lib/*Data.ts` (`seekerData.ts`, `mentorData.ts`, `recruiterData.ts`, `talentData.ts`, `postingData.ts`, `reviewData.ts`, `founderSync.ts`, `founderReview.ts`, `seekerGrowth.ts`) are the only places that should call `supabase.from(...)` for their respective domain — workspace/tab components call into these rather than querying Supabase directly. `src/lib/database.types.ts` holds the generated Supabase schema types (`Database`, `Profile`, `UserRole`, etc.) and is the source of truth for table/column shapes; regenerate it from the Supabase schema rather than hand-editing when the schema changes.

### Database rules live in Supabase, not in this repo

Row-level security, the mentor/recruiter approval gate, the one-email-per-role rule, skill endorsement/verification logic, and similar invariants are enforced by Postgres policies and functions in the Supabase project itself — there are no migration files in this repo. `supabase/tests/role_rules_test.sql` and `supabase/tests/workspace_rules_test.sql` are rolled-back scripts that exercise those rules: paste one into the Supabase SQL editor and run it; each ends by deliberately raising an error whose message starts with `RESULT:` and lists `ok<n>`/`FAIL<n>` per check, so the transaction rolls back and no test rows are left behind. When changing anything role/permission/verification-related, check these scripts for the behavior they assume and update them if the Supabase-side rules change.

Mentor and recruiter signup previously required a work email, enforced in two places: an `isFreeEmail` check in `src/lib/authRules.ts` and `private.is_free_email` in the database. Both have been disabled — the client check was deleted, and the database function was redefined to always return `false` (it keeps its name, with a `COMMENT` saying so). Personal addresses like Gmail are now accepted for every role.

The **admin approval gate has also been removed**. Mentor and recruiter accounts previously landed on a "Waiting for approval" screen until `profiles.approval` became `'approved'`, but nothing ever set it: no code path writes that column, and `src/components/AdminSignInModal.tsx` is unused dead code (its `onSubmit` is typed `() => void` and discards the credentials it collects), so approval was an unimplemented promise that blocked those two roles permanently. `RoleHome` no longer checks it and `GATED_ROLES`/`isGatedRole` are gone. The database still defaults new mentor/recruiter rows to `approval = 'pending'` and the `approval_status` enum still exists — the column is simply no longer read for gating. Reinstating a gate means building the admin side too, not just restoring the check.

When a signup rule in the trigger rejects a user, the browser only ever sees the generic `Database error saving new user`, which `friendlyAuthError` in `src/pages/AuthPage.tsx` maps to the "already has a Yogyata account" message. A trigger-side rejection therefore looks exactly like a duplicate email — when debugging signup, test the same role against a second email domain before trusting that message.
