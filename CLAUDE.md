# quran-classes-tracker

An offline-first PWA for a Quran memorization teacher. It's Arabic-first and RTL (with a hidden English version), iPhone-first, and multi-tenant. Built with Next.js 15, MongoDB, Dexie, Better Auth and Serwist. Deployed on AWS Amplify (eu-central-1) through a CloudFormation stack.

- `BRIEF.md`: the product brief.
- `PLAN.md`: decisions, architecture, data model, phases with checkboxes, and a dated change log. It's the source of truth for what's done.
- `README.md`: setup, scripts, testing, deployment.

## Always

- **Plan:** work step by step from `PLAN.md`. Ask instead of guessing. Stop at the end of each phase and wait for the go-ahead.
- **After each step:** run `pnpm lint && pnpm typecheck && pnpm test`, make one Conventional Commit, and tick the step in `PLAN.md` (with phase headings and the progress table at phase ends, plus a change-log note when something deviated).
- **Git:** commit only on `dev`. Never push, open PRs or deploy unless asked; the user pushes and merges `dev` → `main`. Stage explicit paths; never `git add -A`.
- **Port 3000** is the user's `pnpm dev`. Use another port and `NEXT_DIST_DIR` (e.g. `.next-check`) for your own server.
- **Windows:** shell commands and heredocs can mangle backslashes. Write files that contain `\` with the Write tool (or Python `chr(92)`) and grep to confirm. `VAR=x cmd` doesn't work in PowerShell.
- **Throwaway scripts** go in the session scratchpad, never the repo.

## Skills (in `.claude/skills/`)

- `plan-step-workflow`: planning, verifying, committing, browser and E2E checks.
- `offline-sync-data`: any change to synced data (schemas, Dexie, LocalStore, push/pull, tenants, indexes).
- `rtl-i18n-ui`: any UI or user-facing text (messages, RTL/LTR, formats, 360 px layouts).
