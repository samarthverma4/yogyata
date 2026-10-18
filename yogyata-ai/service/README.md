# yogyata-ai service

HTTP interface for the `yogyata_ai` package, scoped to one signed-in Yogyata user per request.

The React app cannot call the package directly: the models are Python, and Supabase Edge
Functions run Deno. This service is the bridge. It is deployed separately from Supabase.

## Run it

```bash
pip install -r service/requirements.txt

export SUPABASE_URL=https://<project-ref>.supabase.co
export SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
export ALLOWED_ORIGINS=http://localhost:5173      # comma-separated

PYTHONPATH=src uvicorn service.app:app --reload --port 8000
```

Then set `VITE_AI_SERVICE_URL=http://localhost:8000` in the app's `.env.local`. Interactive
docs are at `/docs`. Tests: `PYTHONPATH="src;." pytest service/tests -q` (no network needed).

## Security boundary

**This service never mints evidence.** It does not call `record_review`, `submit_review`, or
any other path that produces verified evidence. Those already exist in Postgres as
`endorse_submission_skill` and `mentor_review_skill`, where RLS and the SQL tests in
`supabase/tests/` enforce that only a task's founder or an assigned mentor can promote a
skill. A second, weaker path to Verified would make the Skill Passport worthless, so this
service is read-only with respect to evidence and the app keeps writing through Postgres.

Three request fields are therefore overwritten with server-derived values on `/agent/run`,
because each is otherwise a route to forged evidence: `reviewed_results`, `session.profile`
(which carries its own evidence list) and `session.review_ledger`. There are tests for all
three vectors.

The service holds **no service-role key**. Every read is made with the caller's own access
token, so PostgREST applies the same row level security the browser gets — this service
cannot read anything the user could not read themselves. Tokens are verified by asking
Supabase `/auth/v1/user` (cached 60s), which avoids holding a JWT secret or tracking the
project's signing algorithm.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | no auth |
| GET | `/meta/roles` `/meta/tools` | catalog introspection |
| POST | `/me/profile` | the derived `StudentProfile` and what could not be mapped |
| POST | `/skill-gap` | readiness, per-skill status, priorities |
| POST | `/roadmap` | prerequisite-ordered plan fitted to weekly hours |
| POST | `/opportunities/match` | ranks open `job_postings` the caller may see |
| POST | `/mentors/recommend` | ranks `mentor_profiles`; books nothing |
| POST | `/resume/analyze` | pass `job_description` for an evidence-aware comparison |
| GET/POST | `/interview/questions` `/interview/next` `/interview/evaluate` | results are always `automated_unverified` |
| POST | `/tasks/recommend` `/tasks/evaluate` | evaluation is always `human_review_required` |
| POST | `/analytics/cohort` | recruiter accounts only; records supplied by the caller |
| POST | `/agent/run` `/agent/confirm` | confirmation is recorded here, executed by the app |

Errors: `401` unauthenticated, `403` wrong role, `404` no profile, `422` invalid input or
unsupported role, `400` domain error.

## Translation layer

`mapping.py` and `vocab.py` convert between the app's schema and the package's. Three
mismatches are resolved there, and each is a judgement call worth knowing about.

**Evidence strength.** The app stores a three-valued `passport_skills.level`; the package
needs a continuous `strength`. The package treats `>= 0.60` as "met", so:

| level | source | strength |
|---|---|---|
| `declared` | `declared` | 0.50 — deliberately below the bar |
| `assessed` | `portfolio_review` | 0.70 |
| `verified` | `task_review` | 0.90, or 0.75–0.95 scaled by the submission's 1–5 rating |

These numbers are the one place the gap is bridged. If you ever add a `strength` column to
`passport_skills`, it takes precedence automatically and these defaults stop being used.

**Roles.** The package has three reviewed role catalogs; onboarding offers a dozen labels.
`vocab.ROLE_ALIASES` maps what it can and everything else returns `422 unsupported_role`
naming the supported ids — scoring against the wrong catalog is worse than no score. Most
of your users currently pick an unsupported role, so widening this means adding entries to
`skill_gap/data/roles.json`, which needs expert review.

**Skills.** `passport_skills.skill_name` is free text; the taxonomy knows 46 canonical names
plus aliases. Unmapped names are returned in every response as `notes.unmapped_skills` so the
UI can tell a student which of their skills the model cannot see, rather than scoring as if
they did not exist.

**Profile fields.** `experience_years`, `graduation_year`, `degree`, `location` and the work
/opportunity preferences all come from `seeker_details.answers`, which onboarding already
collects — no migration needed. Two gaps remain: `cgpa` is never collected (so eligibility
reports "unknown", which the package handles properly), and `weekly_hours`/`timeline_weeks`
are planning inputs passed per request, defaulting to 6h/week × 8 weeks with
`notes.weekly_hours_supplied: false` so the UI can prompt for the real numbers.
