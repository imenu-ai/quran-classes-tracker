# متابعة تحفيظ القرآن (quran-classes-tracker)

An offline-first PWA for a Quran memorization teacher. He records attendance, evaluates each student's recitation, assigns the next homework and reviews monthly progress. Everything works without a connection and syncs when one is back.

- **Arabic-first and RTL.** The UI has no hard-coded direction, and English (LTR) is built in but hidden.
- **iPhone-first.** Also works on Android, iPad, Android tablets and laptops.
- **Multi-tenant.** Every record belongs to a tenant, and the server enforces that on every query.

The product brief is in [BRIEF.md](BRIEF.md). The full design (decisions, sync protocol, data model and phases) is in [PLAN.md](PLAN.md).

## Stack

| Area        | Choice                                                                                |
| ----------- | ------------------------------------------------------------------------------------- |
| App         | Next.js 15 (App Router), React 19, TypeScript (strict)                                |
| UI          | Tailwind CSS v4, shadcn/ui (Radix, `rtl: true`), next-themes, Recharts                |
| i18n        | next-intl without i18n routing: the locale comes from the user's account via a cookie |
| Local data  | Dexie (IndexedDB), one database per user                                              |
| Server data | MongoDB (local in development, Atlas in production)                                   |
| Auth        | Better Auth (username + password, argon2id, 400-day sessions)                         |
| Offline     | Serwist service worker                                                                |
| Tests       | Vitest (unit, jsdom, mongodb-memory-server), Playwright (E2E)                         |

Node 22 (see `.nvmrc`) and pnpm 10 (pinned in `package.json`; run `corepack enable` once).

## Local setup

1. **Install a local MongoDB** (Community Server) and start it. The default URI is `mongodb://localhost:27017`. No Docker needed.
2. **Install dependencies:**
   ```sh
   corepack enable
   pnpm install
   ```
3. **Create `.env.local`** from the example and set a real secret:
   ```sh
   cp .env.example .env.local
   # BETTER_AUTH_SECRET: 32+ random characters, e.g. `openssl rand -base64 32`
   ```
   | Variable             | Meaning                                                      |
   | -------------------- | ------------------------------------------------------------ |
   | `MONGODB_URI`        | Mongo connection string                                      |
   | `MONGODB_DB`         | Database name (default `quran_tracker`)                      |
   | `BETTER_AUTH_SECRET` | Signs sessions; at least 32 characters                       |
   | `BETTER_AUTH_URL`    | The URL the app is served from, e.g. `http://localhost:3000` |
   | `ENABLED_LOCALES`    | Locales users may use, comma-separated (default `ar`)        |
4. **Create the indexes** (idempotent, safe to rerun):
   ```sh
   pnpm db:indexes
   ```
5. **Create a teacher account.** There is no sign-up page: accounts are created with the CLI, which also creates the tenant if it doesn't exist.
   ```sh
   pnpm user:create --tenant "مركز التحفيظ" --username teacher --name "الأستاذ محمد"
   # optional: --password <p> (otherwise a hidden prompt), --locale ar, --timezone Asia/Hebron
   ```
6. **Optional sample data** (classes, students and a few months of lessons):
   ```sh
   pnpm dev:seed --username teacher
   ```
7. **Run it:**
   ```sh
   pnpm dev
   ```
   Open http://localhost:3000 and sign in.

The service worker is **off in development**. To try offline behaviour on your machine, use a production build: `pnpm build && pnpm start`.

## Scripts

| Script                              | What it does                                                             |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`                          | Development server                                                       |
| `pnpm build` / `pnpm start`         | Production build (with the service worker) / serve it                    |
| `pnpm lint`                         | ESLint, zero warnings allowed. Includes the logical-direction class rule |
| `pnpm typecheck`                    | Generates route types, then `tsc --noEmit`                               |
| `pnpm test` / `pnpm test:watch`     | Vitest unit and integration tests                                        |
| `pnpm test:e2e`                     | Playwright end-to-end tests (see below)                                  |
| `pnpm format` / `pnpm format:check` | Prettier                                                                 |
| `pnpm db:indexes`                   | Create or update MongoDB indexes                                         |
| `pnpm user:create`                  | Create a teacher account (and tenant)                                    |
| `pnpm dev:seed`                     | Fill a teacher's tenant with sample data                                 |

The CLI scripts read `.env.local` then `.env`; variables already set in the shell win. To run one against Atlas, set `MONGODB_URI` in the shell.

## Architecture in short

```
Device                                          Server (Next.js route handlers)
React UI ── reads ──▶ Dexie (IndexedDB)          /api/sync/push  ─▶ validate (shared Zod),
   │                    ▲                                            scope by tenant, LWW write
   └── writes ──▶ record + outbox (one tx)       /api/sync/pull  ◀─ changes since a version
                        │                        /api/auth/*        Better Auth
                  Sync engine ◀────────────────▶ MongoDB
Service worker: cached assets and page shells
```

- **Reads and writes are always local.** Screens read IndexedDB through live queries; a write saves the record and its outbox entry in one transaction. Online and offline behave the same.
- **Sync** pushes the outbox and pulls changes since the last server version. Conflicts resolve by last write wins on `updatedAt`. Triggers: app start, coming online, returning to the app, shortly after a write, and every 60 s.
- **Nothing is dropped silently.** Network failures retry with backoff. A server validation rejection lands in Settings → Sync, where the teacher can retry or discard it.
- **Deterministic IDs** for lessons (class + date) and attendance (lesson + student), so two devices offline create the same record instead of duplicates.
- **Routes use query parameters** (`/class?id=…`, `/student?id=…`, `/lesson?id=…`), so one cached page shell serves every class, student and lesson offline. Pages hold no data; only the API checks the session.
- **Code layout:**
  - `src/domain`: pure logic (sura map and validation, homework suggestion, monthly stats, dates).
  - `src/shared`: schemas and the sync protocol, used by client and server.
  - `src/server`: Mongo, auth, sync services.
  - `src/client`: Dexie, sync engine, PWA helpers.
  - `src/components`, `src/app`: UI and routes.

## i18n and direction rules

- All text lives in `messages/ar.json` (and `messages/en.json`). Domain and server code return error **codes**, never text.
- Use **logical** Tailwind classes only (`ms-`, `pe-`, `start-`, `text-start`, …). `pnpm lint` fails on physical ones (`ml-`, `right-`, `text-left`, …) and on literal `dir="rtl"` / `dir="ltr"`.
- Icons that point a direction (back, next) go through `DirectionalIcon`, which mirrors them in RTL.
- Numbers use Latin digits and dates the Gregorian calendar, via the locale tag `ar-u-ca-gregory-nu-latn`. Inputs accept Arabic-Indic digits too.
- To enable English for testing: add `en` to `ENABLED_LOCALES` and set the user's `locale` to `en` (the locale is copied into a cookie at sign-in).

## Tests

```sh
pnpm test        # unit + integration (mongodb-memory-server downloads a MongoDB binary the first time)
pnpm test:e2e    # end-to-end
```

`pnpm test:e2e` starts its own environment (`e2e/server.mts`). Your local database and dev server are not touched.

1. An in-memory MongoDB with fresh test accounts.
2. A production build in `.next-e2e`.
3. That build served on port 3100.

To reuse the last build: `SKIP_E2E_BUILD=1 pnpm test:e2e`.

| Spec        | Covers                                                                                     | Projects                                                                 |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `main-flow` | login → class → students → lesson → attendance → evaluate → homework → profile             | iPhone 15 (WebKit), Pixel 7, Desktop Chrome                              |
| `offline`   | go offline mid-lesson, keep working, reload, reconnect; a second fresh login sees the data | Chromium only (Playwright can't drive service workers offline in WebKit) |
| `ltr-smoke` | every main screen in English: `dir="ltr"` and no horizontal overflow at 360 px             | all three                                                                |

The first time, install the browsers with `pnpm exec playwright install`. Playwright's WebKit on Windows is close to iOS Safari but not identical, so check on a real iPhone before a release (next section).

## Testing on an iPhone

Service workers, installing to the home screen and offline mode all need **HTTPS**. `http://<your-PC-IP>:3000` will load, but none of the offline features will work. Two options:

- **An Amplify branch deployment** (closest to production).
- **A tunnel to a local production build.** For example, with Cloudflare's `cloudflared`:
  1. In one terminal: `cloudflared tunnel --url http://localhost:3000`. It prints a `https://….trycloudflare.com` URL.
  2. Set `BETTER_AUTH_URL` in `.env.local` to that URL. Otherwise sign-in is rejected as coming from an unknown origin.
  3. In another terminal: `pnpm build && pnpm start` (stop `pnpm dev` first; both use port 3000).

  A quick tunnel gets a new URL each time, so repeat step 2 after restarting it.

On the iPhone:

1. Open the URL in **Safari**, then Share → **Add to Home Screen**. The home page shows these steps too.
2. Open the app **from the home-screen icon** and sign in there. An installed web app on iOS has its own storage, separate from Safari: signing in inside Safari doesn't carry over.
3. Browse once online: home, a class, a student, a lesson, search and settings. The app also pre-caches every page in the background after sign-in.

**Manual offline check** (airplane mode):

- [ ] Turn on airplane mode and fully close the app (swipe it away).
- [ ] Reopen it from the home screen. The classes appear and the indicator shows "غير متصل".
- [ ] Open a class, start a new lesson, mark attendance, and evaluate a student (recite, scores, next homework).
- [ ] Open a student profile: the new scores are in the month summary.
- [ ] Close and reopen the app, still offline: everything is still there, and the pending count shows.
- [ ] Turn airplane mode off and return to the app. The indicator goes "جارٍ المزامنة" → "متصل".
- [ ] On another device (or a laptop), sign in: the lesson and scores are there.

## Deployment

Production runs on **AWS Amplify Hosting** (Next.js SSR) with **MongoDB Atlas**. Amplify supports SSR up to Next.js 15, which is why Next is pinned to 15. The build file, environment checklist and remaining open points are in [Deployment checklist](#deployment-checklist).

CI (GitHub Actions) runs lint and type-check on pushes and pull requests to `main`. Development happens on `dev`, and `dev` is merged into `main` through pull requests.

### Deployment checklist

Not deployed yet; this is the prepared setup to go through together.

**MongoDB Atlas**

- [ ] Create a cluster and a database user with read/write on the app database only.
- [ ] Network access: Amplify's compute has no fixed outbound IP, so allow `0.0.0.0/0` and rely on a strong, generated database password.
- [ ] From your machine, with `MONGODB_URI` set to the Atlas URI in the shell: `pnpm db:indexes`, then `pnpm user:create …` for the teacher.

**Amplify**

- [ ] Connect the GitHub repository and choose the `main` branch. Amplify detects Next.js SSR and uses [amplify.yml](amplify.yml).
- [ ] Environment variables (App settings → Environment variables): `MONGODB_URI`, `MONGODB_DB`, `BETTER_AUTH_SECRET` (new random value, not the local one), `BETTER_AUTH_URL` (the production `https://` URL, no trailing slash), `ENABLED_LOCALES=ar`.
      `amplify.yml` writes them into `.env.production` during the build, because Amplify doesn't pass them to the SSR runtime otherwise.
- [ ] After the first deploy, sign in once. It exercises the parts most likely to differ on Amplify: the native argon2 password hashing (`@node-rs/argon2`) and the packages installed with pnpm's hoisted layout.
- [ ] Install the app on the iPhone from the production URL and run the manual offline check above.
- [ ] Check the sign-in rate limit's client IP (below).
- [ ] Optional: a custom domain. Update `BETTER_AUTH_URL` and redeploy.

**Sign-in rate limit behind CloudFront.** Sign-in is limited to 5 attempts a minute per client IP, taken from `x-forwarded-for`. Behind Amplify that header may carry a chain of IPs (`client, proxy`). Better Auth then finds no IP, and every user shares one bucket. That fails safe, but one person mistyping could briefly lock everyone out. After the first deploy:

1. Log the request headers once and check what `x-forwarded-for` looks like.
2. Set `advanced.ipAddress` in `src/server/auth/auth.ts` accordingly, e.g. `trustedProxies`, or a CloudFront client-IP header.
