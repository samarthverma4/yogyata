# Yogyata (योग्यता)

A skills marketplace where students prove what they can do. Four roles share one Supabase backend:

- **Entrepreneur**: posts real startup tasks, reviews submissions, endorses skills as Verified.
- **Seeker**: builds a Skill Passport (Declared, Assessed, Verified), takes server-graded assessments, solves founder tasks, applies to jobs, works with mentors, follows a career roadmap.
- **Mentor** (approved accounts only): answers mentorship requests, runs sessions, gives feedback, assesses declared skills.
- **Recruiter** (approved accounts only): searches opted-in talent, publishes job postings, runs a pipeline, interviews and scorecards.

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
3. `npm run dev`

### AI coach (optional)

`yogyata-ai/` is the AI package from the `Riddhima` branch: resume check, skill-gap readiness, roadmap planning, opportunity and mentor matching, mock interviews, task-description checks and an assistant. `yogyata-ai/server/` wraps it in a small FastAPI service that reads Supabase as the signed-in user (no service key) and only gives advice; anything consequential needs a click in the app.

1. `npm run ai:setup` (needs [uv](https://docs.astral.sh/uv/); Python 3.10 or newer)
2. `npm run ai` (port 8787; Vite proxies `/ai` to it)

Seekers get an **AI Coach** tab; founders get **Check with AI** on the task form. Without the service the rest of the app works and those screens say how to start it.

Database rules (row-level security, approval gate, one email per role) live in Supabase. Rolled-back test scripts for them are in `supabase/tests/`: paste one into the SQL editor; it ends with a `RESULT:` line.

## AI assistance

Parts of this project were built with AI help, using Claude Code (Anthropic):
the Yogyata restyle, the Supabase schema, security rules and tests, authentication,
the rebuild of the mentor, recruiter and seeker workspaces on Supabase,
and the integration of the `yogyata-ai` package (its service wrapper, AI Coach tab and task check).
Every change was reviewed and directed by the project owner.

---

## Template notes (React + TypeScript + Vite)

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
