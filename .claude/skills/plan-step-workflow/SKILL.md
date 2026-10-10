---
name: plan-step-workflow
description: How work is planned, verified, committed and reported in the quran-classes-tracker repo (PLAN.md phases and steps, lint/type-check/tests, Conventional Commits on dev, never pushing). Use it whenever you implement a feature, fix a bug, start or finish a phase or step, change PLAN.md, commit, or run the app or its tests to check a change, even if the user only says "implement phase N", "fix this", "commit it" or "check it works".
---

# Working on a plan step

This repo is built in phases. `PLAN.md` at the root is the source of truth: decisions (§0), architecture (§2), data model (§4), phases and steps (§6), and a dated change log (§7). `BRIEF.md` is the original product brief; read the relevant sections when a step touches product behaviour.

The user reviews the work phase by phase, so the plan and the git history must always tell the truth about what's done.

## Before starting

1. Read the step in `PLAN.md` §6 and any section it refers to.
2. If the step is ambiguous, or the code disagrees with the plan, ask. The brief says "ask instead of guessing", and the user prefers a question to a wrong assumption.
3. For a new phase or a change of direction (as with Phase 7), write the phase into `PLAN.md` first and get it approved.

## Doing a step

Work one step at a time. After each step:

1. **Verify**, chained with `&&` so a failure stops the chain:
   ```sh
   pnpm lint && pnpm typecheck && pnpm test
   ```
   - `pnpm typecheck` runs `next typegen` then a non-incremental `tsc`. Don't trust an incremental tsc cache: it once let a missing import get committed.
   - Run `pnpm format:check` when you touch Markdown, YAML or JSON. Prettier formats those too.
   - Run `pnpm build` before work goes to `main`, and whenever you add or change a route file (`page.tsx`, `route.ts`, `layout.tsx`). Some errors only `next build` reports. For example, a route file may export only its handlers and route settings (`runtime`, `dynamic`…); any other export fails the Amplify build, but `pnpm typecheck` doesn't see it. Put shared constants in a module under `src/server` or `src/shared` instead.
   - For UI changes, also look at the real app (see "Checking in a browser" below). Tests alone have missed real bugs here, such as overflow at 360 px and blocked pointer events.
2. **Update `PLAN.md`:**
   - Tick the step: `- [ ]` → `- [x]`. Mark a step whose plan changed as `[~]`.
   - At the end of a phase, tick the phase heading (`### [x] Phase N`) and its row in the progress table.
   - Add a dated change-log entry (§7) for anything a future reader would otherwise wonder about: a deviation from the plan, a bug found and how it was fixed, a measured number, a trade-off.
3. **Commit** (rules below).

At the end of a phase: stop, summarize what was done and what's open, and wait for the user's go-ahead before starting the next phase.

## Commits

- Commit only on `dev`. Production is `main`; it changes only through a pull request from `dev` that the user opens.
- **Never push**, never open PRs and never deploy unless the user asks in that conversation. The user pushes.
- One focused commit per step, in Conventional Commit form: `feat(lessons): …`, `fix(profile): …`, `test(e2e): …`, `docs(plan): …`, `chore: …`, `ci: …`, `perf(…): …`.
- Stage explicit paths (`git add <files>`), never `git add -A` or `git add .`. A throwaway check script once got committed and sat in the repo for six phases.
- End every commit message with the attribution line from the session instructions, e.g. `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Checking in a browser

- **Port 3000 belongs to the user's `pnpm dev`.** Don't stop or reuse it.
- For your own server, use another port and dist directory, so the two never share `.next`:
  ```sh
  NEXT_DIST_DIR=.next-check pnpm exec next dev -p 3001
  ```
  For offline or service-worker behaviour you need a production build: `next build` and then `next start` with the same `NEXT_DIST_DIR`. The service worker is disabled in development.
- **Local login:** center code + `demo` / `demo-password-123`.
  - If it's missing, create it: `pnpm center:create --center "Dev Center" --name "…" --email demo@example.test --username demo --password demo-password-123`. The command prints the code.
  - Fill it with sample data: `pnpm dev:seed --center <code>`.
- **Sign-in is rate-limited** to 5 attempts a minute per IP. If checks get locked out, wait 60 s.
- **Throwaway Playwright scripts** go in the session scratchpad, never the repo root. Delete them afterwards.
- **The dev build's Fast Refresh can reload a page mid-navigation.** Retry a step once before calling it a bug, or check against a production build.

## End-to-end tests

`pnpm test:e2e` starts its own world (`e2e/server.mts`):

1. An in-memory MongoDB with fresh accounts.
2. A production build in `.next-e2e`.
3. `next start` on port 3100.

Notes:

- **Run it in the background.** A full run, build included, takes about 3–5 minutes.
- **`SKIP_E2E_BUILD=1`** reuses the last build when only `e2e/` changed. Rebuild after any app change.
- **Projects:** iPhone 15 (WebKit), Pixel 7 and Desktop Chrome. The offline spec runs on Chromium only.
- **Accounts:** one per spec and project (`e2e/accounts.ts`). Each browser context gets its own `x-forwarded-for`, so sign-ins don't share a rate-limit bucket.
- **Arabic text in specs** comes from `messages/ar.json` via the `ar` export in `e2e/fixtures.ts`. Never hard-code UI strings.

## Windows shell quirks

The development machine is Windows, using Git Bash and PowerShell.

- **Backslashes can get mangled** when a file's contents pass through a shell command or heredoc. `\\` has come out as `\`, and `ؐ` as a literal character.
  - For content with backslashes, write the file with the Write tool. Or write it from Python using `chr(92)`.
  - Afterwards, grep the file to confirm the backslashes survived.
- **`VAR=x cmd` is bash-only.** In PowerShell use `$env:VAR = "x"; cmd`.
- **Long commands:** the tool timeout is 10 minutes. Run anything longer, such as the E2E suite, in the background and wait for the notification.
