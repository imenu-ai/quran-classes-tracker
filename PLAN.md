# Implementation Plan: Quran Memorization Tracker (متابعة تحفيظ القرآن)

Status: **Approved 2026-10-05, Phase 1 in progress** · Brief: [BRIEF.md](BRIEF.md) · Last updated: 2026-10-05

Legend: `[ ]` to do · `[x]` done · `[~]` changed (see the change log at the bottom)

---

## 0. Decisions from the Q&A (2026-10-05)

| # | Topic | Decision |
|---|---|---|
| 1 | Naming | The lesson entity is **`Lesson`** in code and in the DB (`lessons`). The Arabic label stays الدرس. This avoids a clash with auth "sessions". |
| 2 | Past lessons | Lessons can be created for past dates, and a lesson's date can be changed. Max one lesson per class per day. |
| 3 | Partial recitation | The range can be edited while evaluating. The suggestion then continues from `toAyah + 1`. |
| 4 | Direction | Per-student setting `memorizationDirection: forward \| backward`, default `forward`. |
| 5 | New vs. revision | No separation, no `kind` field. |
| 6 | Unmarked students | No attendance record until tapped. Unmarked students aren't counted. Evaluating one marks them present. |
| 7 | One score only | Allowed. Averages use only non-null scores. |
| 8 | Archiving a class | Blocked while it has active students. The teacher moves or archives them first ("archive all" shortcut). Lessons, homework and attendance can be soft-deleted after a confirmation. |
| 9 | Chart | Last 12 months that have data. |
| 10 | Locale | No locale in the URL. Read `user.locale` → copied to the `NEXT_LOCALE` cookie at login → default `ar`. |
| 11 | Wording | Neutral wording where possible, masculine default. |
| 12 | Branding | Name "متابعة تحفيظ القرآن", calm green/teal theme, simple generated icon. |
| 13 | Auth | Better Auth + username plugin (details in §4). |
| 14 | Session length | Maximum practical: **400 days**, renewed daily while used. 400 days is the browser cap on cookie lifetime. |
| 15 | Devices | **Multiple devices expected** (iPhone first; also Android, iPad, Android tablets, laptops). |
| 16 | Logout | Warn on unsynced changes and offer "sync now". A forced logout wipes that device's local DB. The local DB is per user. |
| 17 | Backups | Out of scope for now. |
| 18 | Time zone | Stored on the tenant (default `Asia/Hebron`) and used for "today". |
| 19 | Hosting | **AWS Amplify Hosting + MongoDB Atlas**, set up later. |
| 20 | Local DB | Local MongoDB, no Docker. Tests use `mongodb-memory-server`, so they need no setup. |
| 21 | CI | GitHub Actions: **lint + type-check only**, on `main` only. Unit/E2E tests are still written and run locally. |
| 22 | Branches | `dev` for development, PR `dev` → `main` for production. |
| 23 | Commits | Conventional Commits, with a Claude co-author trailer. |
| 24 | Docs location | `BRIEF.md` and `PLAN.md` at the repo root, committed on `dev`. |

### Resolved open items
- **O1:** Keep a hidden `en.json`, the key-parity test and the LTR Playwright smoke test. Only `ar` is enabled (`ENABLED_LOCALES=ar`).
- **O2:** The user pushes `dev` himself. Claude only commits locally.

---

## 1. Key constraints found while researching

1. **Amplify supports Next.js SSR only up to v15.** Its docs list Next.js 12–15, and Next 16 is still listed as unsupported. Next 16.3 is the latest release, but **we pin Next.js 15.5.x** (latest: 15.5.27). We can upgrade once Amplify supports 16. Amplify also does **not** support Next.js streaming or edge middleware. The design avoids both: there's no middleware, and data comes from IndexedDB, not server streaming.
2. **Better Auth requires an email** on every user, even with the username plugin. We store a hidden, unique placeholder (`<uuid>@users.invalid`, using the reserved `.invalid` TLD) that is never shown. The email sign-in and sign-up endpoints are disabled.
3. **iPhone PWA specifics** (iPhone is the main device):
   - Safari clears storage for sites that haven't been used for 7 days, but **home-screen apps are exempt**. So the app shows an iOS "Add to Home Screen" guide, and we call `navigator.storage.persist()`.
   - Home-screen apps can have a cookie jar separate from Safari, so he may need to log in once inside the installed app. The README will say so.
   - iOS has no Background Sync API and no `beforeinstallprompt`. Sync therefore runs on app open, on `visibilitychange`, on `online`, after writes and on a timer.
   - UI rules: inputs ≥ 16px (stops iOS zoom-on-focus), `viewport-fit=cover` + safe-area insets, `100dvh`, `inputmode="numeric"`, touch targets ≥ 44px.
   - Playwright runs a **WebKit iPhone profile** as well as Chromium.
4. **shadcn/ui has native RTL support** (Jan 2026). With `rtl: true` in `components.json`, the CLI writes logical classes and adds `rtl:rotate-180` to icons. Radix primitives get direction from `DirectionProvider`.
5. **`eslint-plugin-better-tailwindcss`** has a rule, `enforce-logical-properties`, that supports Tailwind v4 and `cn()`/`cva()`, so we don't need a custom lint rule for physical classes. `dir="rtl"`/`"ltr"` literals in JSX are blocked separately with `no-restricted-syntax`.
6. **Better Auth rate limiting** keeps limits in memory by default, which doesn't persist on serverless. We use `storage: "database"`.

---

## 2. Architecture overview

```
┌──────────────────────── Device (iPhone PWA / browser) ────────────────────────┐
│  React UI (Next.js App Router, client components)                             │
│     │  reads: useLiveQuery()            writes: localRepo.*()                 │
│     ▼                                      │  (one Dexie transaction)          │
│  Dexie DB  "qct-<userId>"  ◄───────────────┘  record + outbox entry           │
│   classes · students · lessons · attendance · homework                        │
│   outbox · rejected · meta (cursor, user snapshot, tenant tz)                 │
│     ▲ apply pulled changes (LWW)        │ push outbox (batched)               │
│  Sync engine (single-flight via Web Locks, backoff, triggers)                 │
│  Service worker (Serwist): precached assets + cached page shells              │
└───────────────┬────────────────────────────────────▲──────────────────────────┘
                │ POST /api/sync/push                │ GET /api/sync/pull?since=N
┌───────────────▼────────────────────────────────────┴──────────────────────────┐
│  Next.js route handlers (Node runtime, Amplify compute)                       │
│   requireTenantContext() → Better Auth session → { userId, tenantId }         │
│   Zod validation (shared schemas incl. sura/ayah) → SyncService               │
│   TenantRepository (every query scoped by tenantId)                           │
└───────────────┬───────────────────────────────────────────────────────────────┘
                ▼
        MongoDB (Atlas / local): tenants, users, auth_*, rate_limits, counters,
        classes, students, lessons, attendance, homework
```

### 2.1 Reads and writes are always local
- Every screen reads Dexie through `useLiveQuery`. Online and offline behave the same.
- Every write goes through `localRepo` (`create`, `update`, `softDelete`). In **one Dexie transaction**, it writes the record and upserts an outbox entry, so the record and its outbox entry are saved together or not at all.
- `updatedAt` is the device clock in epoch ms, kept increasing on each device (`max(now, lastUpdatedAt + 1)`).

### 2.2 IDs
- Most records use **UUIDv7**, generated on the client.
- **Deviation from the brief, for multi-device:** two kinds of record use deterministic **UUIDv5** IDs, so two devices that create "the same thing" offline produce the same ID and merge by last-write-wins instead of duplicating:
  - `Lesson.id = uuidv5("<classId>:<date at creation>")`. If the date later changes, the ID stays, because IDs are opaque. If the derived ID is already taken by a soft-deleted lesson, that lesson is revived. If it's taken by a live lesson that was moved to another date, a UUIDv7 is used instead. In that rare cross-device race, the class's lesson list could show two lessons on one day, and the teacher can delete one.
  - `Attendance.id = uuidv5("<lessonId>:<studentId>")`. There is exactly one record per student per lesson, by construction.

### 2.3 Outbox
- `outbox` is keyed by `recordId`. Each entry holds `{ table, recordId, rev, enqueuedAt, attempts, lastError }`.
- **Coalescing:** repeated edits to one record bump `rev`, and a push always sends the record's latest full snapshot.
- After the server acknowledges a push, the entry is removed **only if `rev` hasn't changed** since it was sent. An edit made during a push is therefore never lost.
- Failures (network or 5xx) keep the entry, increase `attempts` and back off. **Nothing is ever dropped.**
- Server *validation* rejections (for example an invalid ayah range) move the entry to a `rejected` store, which shows in Settings → Sync with the reason (localized from the code) and actions *retry* / *discard*. Discarding is the only way a mutation leaves the device unsynced, and only the user can do it.

### 2.4 Push: `POST /api/sync/push`
Request: `{ mutations: [{ table, record }] }`, max 200 per batch.

For each mutation, the server:
1. Validates `record` with the table's shared Zod schema (including `validateAyahRange` for homework). Failure returns `rejected` with codes.
2. Forces `tenantId` from the session. A client-supplied `tenantId` is ignored.
3. Checks references within the tenant: `student.classId`, `lesson.classId`, `attendance.lessonId/studentId`, `homework.studentId/assignedLessonId/evaluatedLessonId`. They must exist in this tenant, either already or earlier in the same batch. Failure returns `rejected: REFERENCE_NOT_FOUND`.
4. Clamps `updatedAt` to at most `serverNow + 2 min`, to protect against a wrong device clock.
5. Allocates a `serverVersion` and writes with a **conditional upsert**:
   `updateOne({ _id, tenantId, $or: [{ updatedAt: { $lt: u } }, { updatedAt: u, _lwwTie: { $lt: tie } }] }, { $set: … }, { upsert: true })`.
   - A duplicate-key error means the stored copy is newer, so the result is `stale`. The client gets the winner on the next pull.
   - If the `_id` exists **under another tenant**, the result is `rejected: FORBIDDEN`, and nothing is read or changed.

Response: `{ results: [{ id, status: 'applied' | 'stale' | 'rejected', code?, params?, serverVersion? }] }`.

### 2.5 Version counter and pull watermark
- `counters` has one document per tenant: `{ _id: tenantId, seq, inFlight: [{ v, at }] }`.
- Allocation is a single `findOneAndUpdate({ $inc: { seq: n }, $push: { inFlight } })`. After the records are written, the versions are `$pull`ed from `inFlight`.
- **Why the watermark:** without it, a pull could advance its cursor past a version that was allocated but not yet written, and miss that record forever. A pull never returns a cursor at or above the lowest in-flight version. Entries older than 30 s are treated as abandoned.

### 2.6 Pull: `GET /api/sync/pull?since=N&limit=500`
- Queries each collection for `serverVersion > since` (index `tenantId + serverVersion`).
- Merge-sorts the results and caps them at `min(limit, watermark)`.
- Returns `{ changes: { classes: [], … }, cursor, hasMore }`. Soft-deleted records are included.

**Applying a pull on the client (LWW):**
- A pulled record replaces the local one **unless** an outbox entry exists for it and the local `updatedAt` is newer.
- Then `meta.cursor` is saved.
- The first login does a full pull (`since=0`) and loops while `hasMore`.

### 2.7 Sync engine
- **Triggers:**
  - app start
  - `online`
  - `visibilitychange → visible` (important on iOS)
  - 1.5 s debounce after local writes
  - every 60 s while visible and online
- **Single-flight:** `navigator.locks.request('qct-sync')`, so several tabs never sync at once.
- **Backoff:** exponential from 2 s up to 5 min, with jitter. It resets after a success.
- **401:** state becomes `needsLogin`. The outbox is untouched, a banner asks him to log in again, and sync resumes after login.
- **Indicator states:** متصل / غير متصل / جارٍ المزامنة / "X تغييرات بانتظار المزامنة" / يلزم تسجيل الدخول / rejected count.

### 2.8 Auth and offline
- Better Auth issues an httpOnly session cookie (400 days, renewed daily), stored in Mongo.
- After login, the client saves a **user snapshot** in Dexie `meta`: `userId, tenantId, name, username, locale` and the tenant time zone.
- **Pages are not gated on the server.** They contain no data, and gating them would break the cached offline shell. The client checks the local snapshot: if there is none, it redirects to `/login`. All **API** routes enforce the session.
- Login itself needs the network. Offline with no snapshot, the login page shows "first login needs internet".

### 2.9 Routing (offline-friendly)
- Routes have **no dynamic path segments**:
  - `/`, `/login`, `/search`, `/settings`
  - `/class?id=…`, `/student?id=…`, `/lesson?id=…&step=attendance|evaluate`
- The service worker matches navigations with `ignoreSearch`. After one online visit, each page shell works offline for **any** class, student or lesson. With `/student/[id]`, only the exact URLs already visited would work offline.
- After login, the SW warms the cache by fetching every page shell, so the whole app is available offline after a single online visit.

### 2.10 i18n and direction
- Uses next-intl **without i18n routing**.
- `src/i18n/request.ts` resolves the locale as: `NEXT_LOCALE` cookie → kept only if in `ENABLED_LOCALES` → otherwise `DEFAULT_LOCALE` (`ar`).
- The root layout sets `<html lang={locale} dir={getDirection(locale)}>`, picks the font from the locale, and wraps the app in `DirectionProvider` (Radix) and `NextIntlClientProvider`.
- Formats: `ar` uses `numberingSystem: 'latn'` and the Gregorian calendar. Weekday and month names come from `Intl`.
- Domain functions return codes. `t('errors.<CODE>', params)` turns them into text.

---

## 3. Folder structure

```
.
├── BRIEF.md · PLAN.md · README.md · LICENSE
├── messages/            ar.json · en.json
├── scripts/             user-create.ts · db-indexes.ts
├── e2e/                 main-flow.spec.ts · offline.spec.ts · ltr-smoke.spec.ts · fixtures/
├── .github/workflows/   ci.yml           (lint + typecheck, main only)
├── public/              icons/ · apple-touch-icon.png
└── src/
    ├── app/
    │   ├── layout.tsx                  html lang/dir, fonts, providers
    │   ├── manifest.ts · sw.ts         PWA manifest + Serwist service worker
    │   ├── login/page.tsx
    │   ├── (app)/                      client-gated shell (header, sync indicator, nav)
    │   │   ├── page.tsx                home: classes
    │   │   ├── class/page.tsx · student/page.tsx · lesson/page.tsx
    │   │   ├── search/page.tsx · settings/page.tsx
    │   └── api/
    │       ├── auth/[...all]/route.ts
    │       └── sync/push/route.ts · sync/pull/route.ts
    ├── domain/                         PURE, no React/DB/text
    │   ├── quran/      surahs.ts · validation.ts · search.ts (normalizeArabic)
    │   ├── homework/   suggestion.ts · progress.ts
    │   ├── stats/      monthly.ts
    │   └── dates/      local-date.ts (today in tz, weekday, month key, age)
    ├── shared/                         used by client AND server
    │   ├── schemas/    base.ts · class.ts · student.ts · lesson.ts · attendance.ts · homework.ts
    │   └── sync/       protocol.ts (push/pull DTOs) · lww.ts (pure merge rules)
    ├── i18n/           config.ts · direction.ts · request.ts · formats.ts · error-message.ts
    ├── server/
    │   ├── env.ts · db.ts (cached MongoClient) · indexes.ts
    │   ├── auth/       auth.ts (Better Auth) · password.ts (argon2id) · tenant-context.ts
    │   ├── repositories/ tenant-repository.ts · <entity>.ts
    │   └── sync/       versions.ts · push.ts · pull.ts
    ├── client/
    │   ├── db/         dexie.ts (schema per user) · local-repo.ts · outbox.ts
    │   ├── sync/       engine.ts · apply-pull.ts · triggers.ts · backoff.ts
    │   ├── auth/       session-snapshot.ts · auth-client.ts
    │   └── pwa/        install-prompt.ts · persist-storage.ts
    ├── components/
    │   ├── ui/         shadcn (rtl: true)
    │   ├── directional-icon.tsx · sync-indicator.tsx · score-picker.tsx
    │   ├── surah-picker.tsx · ayah-range-input.tsx · …feature components
    └── test/           setup files, fake-indexeddb, mongo-memory helpers
```

Tests sit next to the code as `*.test.ts`. Server integration tests are `*.int.test.ts` and use `mongodb-memory-server`.

---

## 4. Data model

### Common fields on every syncable record (`classes`, `students`, `lessons`, `attendance`, `homework`)

| Field | Type | Notes |
|---|---|---|
| `_id` / `id` | string (UUID) | Generated on the client. Stored as Mongo `_id`; the DTO calls it `id`. |
| `tenantId` | string | Set by the server from the session. |
| `createdAt` | number (epoch ms) | |
| `updatedAt` | number (epoch ms) | The LWW key. |
| `deletedAt` | number \| null | Soft delete. |
| `serverVersion` | number | Assigned by the server; `0` locally until synced. |

### Entities

**`tenants`** (server only)
- `_id`, `name`, `timezone` (default `Asia/Hebron`), `createdAt`

**`users`** (Better Auth `user` model, renamed)
- `_id`, `name` (display name), `username` (unique, lowercase), `displayUsername`
- `email`: hidden placeholder, unique
- `emailVerified`, `tenantId` (`input: false`), `locale` (default `ar`), `createdAt`, `updatedAt`

**`auth_sessions`, `auth_accounts`, `auth_verifications`, `rate_limits`**
- Better Auth models, renamed. The argon2id password hash lives in `auth_accounts`.

**`counters`**
- `_id: tenantId`, `seq`, `inFlight[]`

**`classes`**
- `name`, `archivedAt: number | null`

**`students`**
- `classId`, `fullName`, `birthYear` (int, 1900–current year), `note`
- `memorizationDirection: 'forward' | 'backward'` *(new)*
- `archivedAt`

**`lessons`** *(was `sessions`)*
- `classId`, `date` (`YYYY-MM-DD`, tenant tz), `note`

**`attendance`**
- `lessonId` *(was `sessionId`)*, `studentId`
- `status: 'present' | 'absent' | 'excused'`
- `excuseNote` (only meaningful when `excused`)

**`homework`**
- `studentId`
- `surah` (1–114), `fromAyah`, `toAyah`: validated by `validateAyahRange`
- `note`
- `assignedLessonId | null`, `evaluatedLessonId | null`
- `memorizationRate`, `behaviorRate`: int 1–10 or null
- Pending = `evaluatedLessonId == null`.

### Derived rules (computed, never stored)

**Monthly stats.** The month is taken from `lessons[evaluatedLessonId].date`.
- Averages ignore nulls and are rounded to 1 decimal; "—" when there is no data.
- Attendance counts come from attendance records in lessons of that month.
- Soft-deleted records, and children of deleted lessons, are excluded.

**"تم تقييم X من Y".**
- Y = present students.
- A student counts toward X when at least one homework item was evaluated in this lesson and every such item has both scores.
- Pending items the student didn't recite today don't block the count. This clarifies Q7 so that unrecited homework doesn't make a student look unfinished.

**Next-homework suggestion** *(refined)*
- It starts from the student's **most recent item, pending or evaluated**, not only the last evaluated one. This way, assigning homework after a pending item continues after it.
- The new item has the same size as the previous one and continues at `toAyah + 1`, clamped to the end of the sura.
- When the sura is finished, it moves to the next sura (`+1` forward, `−1` backward) starting at ayah 1.
- It returns `null` after sura 114 (forward) or sura 1 (backward).
- With no history at all, it suggests nothing, or sura 114 if the student is set to backward.

### Indexes (`scripts/db-indexes.ts`, idempotent; also run in setup docs)

| Collection | Index |
|---|---|
| users | `{ username: 1 }` unique · `{ email: 1 }` unique · `{ tenantId: 1 }` |
| auth_sessions | `{ token: 1 }` unique · `{ userId: 1 }` · `{ expiresAt: 1 }` TTL |
| auth_accounts | `{ userId: 1 }` · `{ providerId: 1, accountId: 1 }` |
| rate_limits | `{ key: 1 }` unique |
| tenants | `{ name: 1 }` unique |
| classes | `{ tenantId: 1, serverVersion: 1 }` |
| students | `{ tenantId: 1, serverVersion: 1 }` · `{ tenantId: 1, classId: 1 }` |
| lessons | `{ tenantId: 1, serverVersion: 1 }` · `{ tenantId: 1, classId: 1, date: 1 }` |
| attendance | `{ tenantId: 1, serverVersion: 1 }` · `{ tenantId: 1, lessonId: 1 }` · `{ tenantId: 1, studentId: 1 }` |
| homework | `{ tenantId: 1, serverVersion: 1 }` · `{ tenantId: 1, studentId: 1 }` · `{ tenantId: 1, evaluatedLessonId: 1 }` |

**Dexie (client) indexes**
- `classes`: `id, updatedAt`
- `students`: `id, classId, fullName`
- `lessons`: `id, classId, [classId+date], date`
- `attendance`: `id, lessonId, studentId`
- `homework`: `id, studentId, assignedLessonId, evaluatedLessonId`
- `outbox`: `recordId, enqueuedAt`
- `rejected`: `recordId`
- `meta`: `key`

---

## 5. Libraries (versions checked on npm, 2026-10-05)

| Library | Version | Why |
|---|---|---|
| next | **15.5.x** (15.5.27) | Latest version Amplify supports for SSR (see §1.1). |
| react / react-dom | 19.x (as required by Next 15.5) | |
| typescript | **5.9.3** | TS 7 (the native port) is too new for Next 15's tooling. 5.9 is the safe, strict choice. |
| next-intl | 4.14.x | Officially supports App Router setups without i18n routing; ICU messages and `Intl` formatters. |
| better-auth | 1.7.7 (+ built-in Mongo adapter) | Username plugin, built-in DB-backed rate limiting, cookie sessions. Recommended successor to Auth.js. |
| @node-rs/argon2 | 2.2.x | argon2id hashing (prebuilt native binaries; added to `serverExternalPackages`), plugged into Better Auth via `password.hash/verify`. |
| mongodb (driver) | 7.7.x | **Chosen over Mongoose:** Zod is already the single schema, so Mongoose would duplicate it. Conditional LWW upserts and `$inc` counters are clearer with the raw driver, and cold starts are lighter on serverless. |
| zod | 4.6.x | Shared client/server schemas. Custom issues carry codes, not text. |
| dexie / dexie-react-hooks | 4.4.x / 4.4.0 | IndexedDB with transactions and `useLiveQuery`. |
| uuid | 14.x | v7 and v5. |
| @serwist/next + serwist | 9.5.x | Service worker for Next. Next 15 builds with webpack, which `@serwist/next` supports. |
| tailwindcss | 4.3.x | |
| shadcn (CLI) | 4.21.x, `rtl: true` | Writes logical classes into the components. |
| radix (via shadcn), vaul (drawer), cmdk 1.1.x, sonner 2.x, lucide-react, next-themes 0.4.6 | | Sheets and drawers, the searchable sura picker, toasts, icons, light/dark mode. |
| recharts | 3.x (via shadcn `chart`) | Monthly chart. The axis is reversed in RTL. |
| eslint | **9.39.x** | `eslint-config-next@15` supports ESLint ≤ 9. |
| eslint-plugin-better-tailwindcss | 4.8.x | `enforce-logical-properties` as an **error**. |
| prettier + prettier-plugin-tailwindcss | 3.9.x | |
| vitest | 5.0.x | Unit and integration tests (Node ≥ 22.12; you have 22.18). |
| fake-indexeddb | latest | Dexie in unit tests. |
| mongodb-memory-server | 11.x | Server integration tests and E2E without a local DB. |
| @playwright/test | 1.63.x | E2E with projects: iPhone (WebKit), Pixel (Chromium), Desktop (Chromium). |
| tsx | latest | Runs the TS CLI scripts. |

Fonts: IBM Plex Sans Arabic (`ar`) and IBM Plex Sans (`en`) via `next/font/google`, chosen in the layout from the locale. They're self-hosted, so they work offline.

Node: 22 LTS (`.nvmrc`, `engines`). Amplify supports Node 20, 22 and 24.

---

## 6. Phases and steps

Every step ends with: `pnpm lint && pnpm typecheck && <relevant tests>`, then one Conventional Commit on `dev`, then a tick in this file.

### Phase 1: Scaffold, tooling, i18n and direction, theme, sura map, auth, tenants, CLI

- [x] **1.1 Scaffold.** Next 15.5 App Router, TS strict (plus `noUncheckedIndexedAccess`), `src/`, pnpm, `.nvmrc`, `engines`, scripts (`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `format`), `.gitignore`. Existing README and LICENSE are kept.
  *Done when* `pnpm build` and `pnpm typecheck` pass.
- [x] **1.2 Lint and format.** ESLint 9 flat config (next core-web-vitals + TS), Prettier + tailwind plugin, `better-tailwindcss/enforce-logical-properties: error`, and `no-restricted-syntax` blocking `dir="rtl"|"ltr"` literals.
  *Done when* a temporary fixture using `ml-2`, `text-left` and `dir="rtl"` fails lint (shown in the commit message), the fixture is removed, and lint is clean.
- [x] **1.3 Vitest setup.** Node and jsdom environments, path aliases.
  *Done when* `pnpm test` runs a smoke test.
- [x] **1.4 Sura map.** `SURAHS`, `SURAH_MAP`, `getSurah`, `getSurahName` (falls back to `ar`), `getAyahCount`, `isValidSurah` (from the brief's table, verbatim).
  *Done when* the tests pass: 114 entries, 1..114 in order with no gaps, total 6236, spot checks, non-empty names, locale fallback.
- [x] **1.5 Ayah validation and Arabic search.** `validateAyahRange` returns codes and params. `normalizeArabic` strips tashkeel and tatweel and folds أإآ→ا, ة→ه, ى→ي. `searchSurahs(query, locale)` matches by number, the localized name, and always Arabic.
  *Done when* the tests for every rule and edge case pass (first and last ayah, 0, negative, above the count, from > to, non-integer, sura 0 and 115; "الاسراء" finds 17).
- [x] **1.6 i18n core.** `i18n/config.ts` (`ENABLED_LOCALES`, `DEFAULT_LOCALE`), `getDirection`, `request.ts` (cookie → enabled → default), formats (`latn`, Gregorian), `ar.json` + `en.json` (glossary values, validation errors), key-parity test, direction test.
  *Done when* the tests pass and a page renders `<html lang="ar" dir="rtl">`. With `ENABLED_LOCALES=ar,en` and cookie `en`, it renders `lang="en" dir="ltr"`.
- [ ] **1.7 Theme and UI base.** Tailwind v4 tokens (green/teal, light and dark), `next-themes` (system default), locale-based fonts, `shadcn init --rtl`, base components (button, input, card, drawer, sheet, dropdown, sonner, badge, skeleton), Radix `DirectionProvider`, `<DirectionalIcon>`.
  *Done when* a temporary kitchen-sink page looks right in RTL, LTR, light and dark at 360 px (screenshots in the summary), and it is removed before the commit.
- [ ] **1.8 Shared Zod schemas.** Base syncable schema plus the entity schemas. The homework schema calls `validateAyahRange` and emits custom issues with `{ code, params }`. Plus a `useErrorMessage()` helper that maps codes through i18n.
  *Done when* the tests show each invalid case yields the right code and valid records parse.
- [ ] **1.9 Server env and DB.** `server/env.ts` (Zod-validated env), cached `MongoClient`, `.env.example`, `pnpm db:indexes` (idempotent).
  *Done when* the script runs twice against local Mongo with no error, and an integration test on the memory server checks the indexes exist.
- [ ] **1.10 Better Auth.**
  - Mongo adapter; models renamed to `users` / `auth_sessions` / `auth_accounts` / `auth_verifications`.
  - Username plugin; email sign-in and sign-up paths disabled.
  - argon2id hashing; 400-day session with `updateAge` of 1 day.
  - DB rate limiting, enabled in all environments, with a stricter rule on `/sign-in/username`; IP taken from `x-forwarded-for`.
  - `additionalFields`: `tenantId` (`input: false`), `locale`.
  - `/api/auth/[...all]` route.

  *Done when* integration tests show: correct password → session cookie; wrong password → 401; the (N+1)th attempt → 429.
- [ ] **1.11 Tenant context and repository layer.** `requireTenantContext()` (session → `{ userId, tenantId }` or a 401 response) and a `TenantRepository` that injects `tenantId` into every filter and write.
  *Done when* a test shows a repository read for tenant A never returns tenant B's documents, even when queried by `_id`.
- [ ] **1.12 CLI `pnpm user:create`.**
  - Arguments: `--tenant --username --password? --name [--locale ar] [--timezone Asia/Hebron]`.
  - Creates the tenant if missing, then the user, account and argon2 hash, with a placeholder email.
  - Prompts for the password if it's omitted; checks the username rules; refuses duplicates.

  *Done when* running it locally creates an account that can log in (integration test plus manual check).
- [ ] **1.13 Login and logout.** `/login` page with username and password, localized errors including rate limiting. On success it sets `NEXT_LOCALE` from `user.locale`. Logout. A placeholder home page shows the display name.
  *Done when* the manual flow works in dev, in Arabic RTL, at 360 px.
- [ ] **1.14 CI.** `.github/workflows/ci.yml`: on `push` and `pull_request` to `main`, pnpm install → lint → typecheck.
  *Done when* the YAML is valid (actionlint run locally via npx). It runs for real on the first PR to `main`.
- [ ] **1.15 Phase wrap-up.** Update PLAN.md and write the summary. **Stop for go-ahead.**

### Phase 2: Local DB, outbox, sync API, sync engine

- [ ] **2.1 Dexie schema.** Per-user DB (`qct-<userId>`) with the tables and indexes in §4, plus `outbox`, `rejected`, `meta`.
  *Done when* the fake-indexeddb tests can open, write and read every table.
- [ ] **2.2 `localRepo` and outbox.** `create` / `update` / `softDelete` write the record and the outbox entry in one transaction, with a strictly increasing `updatedAt`, coalescing and `rev`.
  *Done when* the tests show atomicity (a failed write leaves no outbox entry), coalescing, and that a `rev` change during push keeps the entry.
- [ ] **2.3 Pure LWW rules** (`shared/sync/lww.ts`): `shouldApplyIncoming(local, incoming, hasPendingOutbox)` and the server's `isNewer(stored, incoming)` with a tie-break.
  *Done when* the tests cover newer, older, equal plus tie, and deleted versus edited.
- [ ] **2.4 Version allocation.** `allocateVersions(tenantId, n)` with `inFlight`, `release()`, `watermark()`.
  *Done when* integration tests show concurrent allocations never collide, and the watermark stays below unreleased versions (stale entries > 30 s are ignored).
- [ ] **2.5 Push service.** Zod validation per table, forced `tenantId`, reference checks (including earlier in the same batch), `updatedAt` clamp, conditional upsert, statuses `applied` / `stale` / `rejected` with codes.
  *Done when* integration tests cover:
  - LWW both ways, plus the tie
  - soft delete applied, and a later edit after a delete winning or losing by `updatedAt`
  - **tenant isolation**: a cross-tenant `_id` collision → `FORBIDDEN`, and a reference to another tenant's student → `REFERENCE_NOT_FOUND`
  - **an invalid ayah range** → `rejected` with `AYAH_OUT_OF_RANGE`
- [ ] **2.6 Pull service.** Cross-collection, paginated, capped by the watermark, includes deleted records.
  *Done when* the tests cover pagination order, `hasMore`, deleted records included, tenant-scoped results, and the watermark cap.
- [ ] **2.7 Sync routes.** `POST /api/sync/push` and `GET /api/sync/pull`: auth → 401 JSON, body limits, max 200 mutations.
  *Done when* the route-handler tests cover 401, a 400 on a malformed body, and the happy path.
- [ ] **2.8 Client sync engine.** Push → pull loop, Web Locks single-flight, triggers, backoff with jitter, `needsLogin` on 401 (outbox kept), rejected → dead-letter, apply pull with LWW, cursor saved.
  *Done when* tests with mocked fetch and fake-indexeddb cover: an offline write syncs later, 401 keeps the outbox, the backoff schedule, a rejection moving to `rejected`, a pulled newer record replacing a local one, and a pulled older record not overwriting a pending local edit.
- [ ] **2.9 Session bootstrap.** After login, save the user and tenant snapshot, run a full pull, and add the client gate in `(app)/layout`. A dev seed command (`pnpm dev:seed`) creates sample data for a user.
  *Done when*, manually: log in → data pulled → offline reload still shows the user (the shell is cached by the browser in dev; full SW comes in Phase 6).
- [ ] **2.10 Sync indicator** in the header, covering all states.
  *Done when* each state is verified manually by toggling offline in DevTools and blocking the API.
- [ ] **2.11 Phase wrap-up. Stop.**

### Phase 3: Classes and students

- [ ] **3.1 App shell.** Header (title, sync indicator, search), bottom navigation within thumb reach, safe areas, query-param routes, loading skeletons, empty states.
  *Done when* the shell is navigable on 360 px and on tablet and desktop widths (two-column at ≥ md).
- [ ] **3.2 Home.** Class cards via `useLiveQuery` (student count, "lesson today" badge), empty state with "create class".
  *Done when* creating a class offline appears instantly and syncs once back online.
- [ ] **3.3 Class management.** Create, rename, archive. Archiving is blocked with active students, with "move students" or "archive all" options.
  *Done when* every path works and is reflected after a sync on a second browser profile.
- [ ] **3.4 Students.** Add and edit (full name `dir="auto"`, birth year, note, memorization direction, class pre-selected), move to another class, archive or unarchive. List of archived students per class.
  *Done when* Zod validation messages are localized and a move to another class syncs.
- [ ] **3.5 Global student search** with Arabic normalization (reuses `normalizeArabic`).
  *Done when* "محمد" matches "مُحَمَّد" and partial names match.
- [ ] **3.6 Phase wrap-up. Stop.**

### Phase 4: Lessons (attendance and evaluation)

- [ ] **4.1 Date domain.** `todayInTz(tz)`, `weekdayOf(date)`, `monthKey(date)`, `ageFrom(birthYear, today)`.
  *Done when* the tests cover the Hebron date line around midnight and DST changes.
- [ ] **4.2 Start or open a lesson.** "درس جديد" uses the deterministic lesson ID and opens today's lesson if it exists. A date picker allows past dates. The date can be changed, but not to a date that already has a lesson.
  *Done when* a double tap or a second device never creates a duplicate (the same ID merges) and the tests on ID derivation pass.
- [ ] **4.3 Attendance step.** Three-state segmented toggle per student, "تحديد الكل حاضر", excuse note shown for `excused`, unmark (soft delete).
  *Done when* marking 20 students takes ≤ 1 tap each and changes are autosaved.
- [ ] **4.4 Sura picker and ayah range.** Bottom drawer with cmdk; normalized search; rows like "2 · البقرة · 286 آية"; ayah inputs show "من 1 إلى 286", limit input to the range, and show localized errors live.
  *Done when* the rules from §5 of the brief hold in the UI (manual check plus component test).
- [ ] **4.5 Next-homework suggestion** (pure).
  *Done when* the tests cover forward and backward, continuing in the same sura, the end of a sura (next or previous sura), sura 114 and sura 1 boundaries, partial recitation, an existing pending item, and no history.
- [ ] **4.6 Evaluation step.**
  - One card per present student, with unmarked students in a collapsed section.
  - Pending items, each with two 5×2 score grids (≥ 44 px targets) and an editable range.
  - "إضافة واجب للدرس القادم" (with the suggestion pre-filled) and "تسميع الآن".
  - Progress "تم تقييم X من Y".

  *Done when* evaluating a student takes ≤ 3 taps when a pending item exists, and the progress tests pass.
- [ ] **4.7 Lesson history per class.** List of lessons; a lesson's note; soft delete after a confirmation.
  *Done when* an old lesson can be reopened and edited.
- [ ] **4.8 Phase wrap-up. Stop.**

### Phase 5: Student profile, monthly stats, chart

- [ ] **5.1 Monthly stats** (pure).
  *Done when* the tests cover: month taken from the evaluating lesson's date, nulls ignored, 1-decimal rounding, "no data", attendance counts, deleted items excluded, and an item moving month when its lesson's date changes.
- [ ] **5.2 Profile header.** Name, class, age, note, direction, current pending homework.
- [ ] **5.3 Month summaries,** newest first.
- [ ] **5.4 Chart.** Last 12 months with data, memorization and behavior lines, axis reversed in RTL, dark mode, accessible table fallback.
- [ ] **5.5 Month history.** Evaluated rows (date, weekday, sura, from–to, both scores) plus absences with excuse notes. Tapping a row edits it in a sheet.
  *Done when* edits recompute the stats live.
- [ ] **5.6 Phase wrap-up. Stop.**

### Phase 6: PWA and offline hardening, settings, E2E, README, deployment

- [ ] **6.1 Serwist.**
  - Precache the build assets and fonts.
  - Navigations: NetworkFirst with a 3 s timeout and `ignoreSearch`, falling back to an offline page.
  - Warm the page-shell cache after login.
  - Manifest, icons (maskable plus `apple-touch-icon`), iOS meta tags, `viewport-fit=cover`.

  *Done when*, in a production build: visit once online → in DevTools, go offline → every page opens for any ID.
- [ ] **6.2 Install and persistence.** iOS "Add to Home Screen" guide (shown in Safari only, dismissible), install button on Chromium, `navigator.storage.persist()`.
- [ ] **6.3 Settings.**
  - Display name, username (unique, validated) and password (current password required).
  - Theme toggle.
  - Sync details: pending count, last sync, rejected list with retry/discard, "sync now".
  - Logout with an unsynced-changes warning and a local wipe.
- [ ] **6.4 Playwright.** Memory-server Mongo plus a production build; projects: iPhone 15 (WebKit), Pixel 7 (Chromium), Desktop.
  - Main flow: login → class → students → lesson → attendance → evaluate → assign homework → profile.
  - **Offline run:** go offline mid-lesson, keep working, reconnect, then check that the server has the data, using a second browser context that logs in fresh.
  - **LTR smoke:** cookie `en` with `ENABLED_LOCALES=ar,en`; `dir=ltr` on the main screens, and no horizontal overflow at 360 px.
- [ ] **6.5 README.** Local setup (local MongoDB, `.env`, `pnpm db:indexes`, `pnpm user:create`), scripts, architecture summary, testing on an iPhone (needs HTTPS, so an Amplify branch or a tunnel), and deployment.
- [ ] **6.6 Deployment prep (to be discussed).**
  - `amplify.yml`: Node 22, `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm build`.
  - SSR env vars written to `.env.production` at build time (an Amplify requirement).
  - Atlas network access, the `BETTER_AUTH_URL` and secret, and an env checklist.
- [ ] **6.7 Final wrap-up. Stop.**

---

## 7. Change log
- 2026-10-05: Initial plan.
  - Changes against the brief:
    - `Session` → `Lesson`
    - UUIDv5 for lessons and attendance
    - Next 15.5 instead of latest, for Amplify
    - Query-param routes
    - No server-side page gating
    - The suggestion starts from the most recent item, pending or evaluated
    - Progress definition clarified
    - `Student.memorizationDirection` and `Tenant.timezone` added
    - CI runs lint and typecheck only
    - Docs live at the repo root
- 2026-10-05 (step 1.5):
  - `validateAyahRange` returns `params: { surah, ayahCount }` for `AYAH_OUT_OF_RANGE` instead of `{ surahName, ayahCount }`. The i18n layer resolves `surahName` from the number in the active locale, which keeps the domain locale-free.
  - Every error also carries `field` (`surah` / `fromAyah` / `toAyah`), so the form can show it under the right input.
  - The normalizer is `normalizeForSearch` (Arabic and Latin), not `normalizeArabic`. It also handles ٱ, Arabic-Indic digits and punctuation.
