# Implementation Plan: Quran Memorization (تحفيظ القرآن)

Status: **Phase 1 done (the PWA, deployed on Amplify). Phase 2 (React Native app) in progress: 2.1–2.5 done.** · Brief: [BRIEF.md](BRIEF.md) · Last updated: 2026-10-24

Legend: `[ ]` to do · `[x]` done · `[~]` changed (see the change log at the bottom)

---

## 0. Decisions

Agreed with the user from 2026-10-05 on; the date marks when a group was added.

| # | Topic | Decision |
|---|---|---|
| 1 | Naming | The lesson entity is **`Lesson`** in code and in the DB (`lessons`). The Arabic label stays الدرس. This avoids a clash with auth "sessions". |
| 2 | Past lessons | Lessons can be created for past dates, and a lesson's date can be changed. Max one lesson per class per day. |
| 3 | Partial recitation | The range can be edited while evaluating. The suggestion then continues from `toAyah + 1`. |
| 4 | Direction | Per-student setting `memorizationDirection: forward \| backward`, default `forward`. |
| 5 | New vs. revision | No separation, no `kind` field for it (exams use `kind`, #42). |
| 6 | Unmarked students | No attendance record until tapped. Unmarked students aren't counted. Evaluating one marks them present. |
| 7 | One score only | Allowed. Averages use only non-null scores. |
| 8 | Archiving a class | Blocked while it has active students. The teacher moves or archives them first ("archive all" shortcut). Lessons, homework and attendance can be soft-deleted after a confirmation. |
| 9 | Locale | No locale in the URL. Read `user.locale` → copied to the `NEXT_LOCALE` cookie at login → default `ar`. Only `ar` is enabled; `en.json`, the key-parity test and the LTR smoke test are kept (`ENABLED_LOCALES=ar`). |
| 10 | Wording | Neutral wording where possible, masculine default. |
| 11 | Branding | Name "تحفيظ القرآن" (was "متابعة تحفيظ القرآن" until 2.1, #46), calm green/teal theme, simple generated icon. |
| 12 | Auth | Better Auth + username plugin; argon2id hashes. |
| 13 | Session length | **400 days** (the browser cap on cookie lifetime), renewed daily while used. |
| 14 | Devices | **Multiple devices expected** (iPhone first; also Android, iPad, Android tablets, laptops). |
| 15 | Logout | Warn on unsynced changes and offer "sync now". A forced logout wipes that device's local DB. The local DB is per user. |
| 16 | Backups | Out of scope for now. |
| 17 | Time zone | Stored on the center (default `Asia/Hebron`) and used for "today". |
| 18 | Local DB | Local MongoDB, no Docker. Tests use `mongodb-memory-server`, so they need no setup. |
| 19 | CI | GitHub Actions: **lint + type-check only**, on pull requests to `main`. Unit and E2E tests are run locally. |
| 20 | Git | `dev` for development, PR `dev` → `main` for production. Conventional Commits with a Claude co-author trailer. Claude commits locally; the user pushes. `BRIEF.md` and `PLAN.md` live at the repo root. |
| 21 | Hosting (2026-10-06) | **AWS Amplify Hosting + MongoDB Atlas**, eu-central-1. The Amplify app (service role, app, `main` branch) is a **CloudFormation stack**. A GitHub Actions workflow deploys it with an **OIDC role**, only when the stack file changes. The app's env vars live in **one Secrets Manager JSON secret** created manually; its ARN is the app env var `APP_SECRET_ARN`, and the build writes the secret into `.env`. Amplify auto-builds `main` on merge. The build spec lives in the stack (pnpm). |
| 22 | Centers and roles (2026-10-10) | Role-based app. A **center admin** registers the center (public `/register`), creates the users and sets each one's access. Roles: `admin` (everything, all classes, user management) and `teacher` (assigned classes + permissions). |
| 23 | Access | Per teacher: **assigned classes** + on/off **permissions** (`classes.manage`, `students.manage`, `lessons.run`, `reports.view`). Enforced on the server (push and pull); the client only hides what's not allowed. |
| 24 | Center code | A generated **6-digit code** per center. Sign-in for everyone (admin too) is **center code + username + password**. Usernames are unique inside a center only. |
| 25 | Admin email | The admin registers with an email, used only for **password reset by email via AWS SES**. Teachers have no email; their admin resets their password. |
| 26 | First login | A teacher must replace the password the admin set before using the app. |
| 27 | Own profile | A user can edit his display name, username, phone (optional) and password. |
| 28 | Student-centred screens (2026-10-10) | Opening a class shows only its students. The student's page shows his month in a table, and his homework with the marks and "add homework for the next day". There are no lesson screens; lessons still exist in the data, and today's lesson is created automatically on the first thing recorded for a student today. |
| 29 | Postponed recitation | "تأجيل التسميع": when a student isn't ready, the teacher postpones instead of giving a bad mark. The homework stays pending for the next day, the day shows "مؤجل", the student counts as present, and averages aren't affected. It can be undone the same day. |
| 30 | Absence | Marked on the student's page for today (present / absent / excused, with the excuse note). |
| 31 | Past days | Marking applies to today; a past day is corrected by tapping its row in the month table. |
| 32 | Mark input (2026-10-11) | A mark (1–10) is chosen with the phone's own number wheel (a native select). |
| 33 | Homework list | On the student page, each due homework item is a collapsible section showing its sura and ayat (and its marks or "مؤجل" when closed). All start closed, except an item just added with "recite now". |
| 34 | Class statistics (2026-10-11) | A "الإحصائيات" button next to "إضافة طالب" opens the class's statistics: its attendance rate (present / absent / excused) and average marks, then its students ranked best first. All time by default; a year, or a year and a month, narrows it. |
| 35 | Ranking | 1) attendance rate, where an excused absence counts as attended (in the ranking only); 2) average memorization mark; 3) average behavior mark; then name. |
| 36 | Attendance rate | Attended days (present + excused) out of the class's lesson days in the period since the student joined. A lesson day with no record for him counts as not attended. |
| 37 | Exams (2026-10-12) | On the student page, "إضافة اختبار" records an exam: a sura and ayah range with one mark (1–10), added and marked on the spot. Exams are left out of every average and of the next-homework suggestion; recording one marks the student present. An exam row is violet with an "اختبار" badge. |
| 38 | Printing (2026-10-13) | A student's month prints as one A4 sheet: center, class, student and the user who printed it; the month table (oldest day first) with its averages; counts of days present, absent, excused, homework recited, exams and postponements. The browser prints it (no PDF library: Arabic shaping stays exact, it works offline). Entry points: "طباعة الشهر" on the student page, and "طباعة كشوف الطلاب" on the statistics page (a month, "تحديد الكل", one page per student). Needs `reports.view`. |
| 39 | Parent link (2026-10-13) | Each student has a link for his parent, `/parent?s=<studentId>`, showing what the printed sheet shows for a month. No account: it's protected by the parent's ID number (`Student.parentId`, digits only, 5–20 long, stored as entered; the same number may be on siblings). |
| 40 | Remembered parent | After the right ID number, the phone is remembered for 30 days (an HttpOnly cookie, an HMAC of the student and the ID). Changing the parent ID ends it; "خروج من هذا الجهاز" forgets it. |
| 41 | Brute force | Wrong ID numbers are limited per IP (10 per 15 minutes) and per student (30 per day); all parent requests per IP (60 per 15 minutes). An unknown, deleted or unset student gives the same "not valid" answer. |
| 42 | QR on printed sheets | Every printed sheet carries a QR code of the student's parent link. The student menu has "رابط ولي الأمر": the link, copy, share and its QR. |
| 43 | Mobile app (2026-10-22) | A **React Native app (Expo)** for iOS and Android, phones and tablets. **Strict feature parity** with the PWA first: no new features in Phase 2. |
| 44 | Native components | **Native navigation** (Expo Router native stack and native tabs) and **native controls** wherever one exists: picker wheel for marks, system date picker, form sheets, menus, alerts, header search bar, share sheet. Content screens (cards, lists, the month table) use React Native core components in the shared green/teal design, the same on both platforms. |
| 45 | The PWA stays | Kept for laptops and as a fallback, on Amplify as today. The parent page and the password-reset page stay web-only; the app shares and links to them. |
| 46 | Name and identity | **"تحفيظ القرآن"** everywhere (app stores, PWA, titles, printed sheets); English "Quran Memorization". Bundle ID and Android package: **`ai.imenu.quran`** (permanent after the first upload). |
| 47 | Repo | A pnpm monorepo: `apps/web` (the Next.js app), `apps/mobile` (Expo), `packages/core` (React-free TypeScript: domain, shared schemas and sync rules, messages, the data layer). Amplify builds `apps/web`. |
| 48 | One data layer | `LocalStore`, the outbox, the sync engine and the per-entity actions move to `packages/core`, written against a small storage interface. The web keeps Dexie; the app uses **SQLite (expo-sqlite)**. Same rules, same tests, one place. |
| 49 | Mobile auth | Better Auth's **Expo plugin**; the session token lives in the device's secure storage (SecureStore). Same 400-day session, same center code + username + password sign-in. |
| 50 | Registration and deletion | Centers can register in the app. Apple requires in-app account deletion for that, so deletion is the step before store submission (2.15); its details are agreed before that step. |
| 51 | Builds and stores | **EAS Build** in the cloud (iOS builds from Windows) and **EAS Submit**; **EAS Update** for JS-only fixes. App Store first (account exists); Google Play when its developer account is created. |
| 52 | Older app versions | Installed apps update slowly, so the API stays backward-compatible with every released app version: new fields are optional with server-side defaults (as in §4), and endpoints aren't renamed or removed. |
| 53 | Direction on mobile | React Native sets direction when the app starts (`I18nManager`), not per screen. The app starts in RTL (only `ar` is enabled); a language change reloads the app. Styles use `start`/`end` only. |

---

## 1. Key constraints

1. **Amplify supports Next.js SSR only up to v15**, and not streaming or edge middleware. We pin **Next.js 15.5.x** and use neither: there's no middleware, and data comes from IndexedDB.
2. **Better Auth requires an email** on every user. Teachers get a hidden, unique placeholder (`<uuid>@users.invalid`). The email sign-in and sign-up endpoints are disabled.
3. **iPhone PWA specifics** (the main device):
   - Safari clears storage for sites unused for 7 days, but **home-screen apps are exempt**. The app shows an "Add to Home Screen" guide and calls `navigator.storage.persist()`.
   - The home-screen app can have its own cookie jar, so one sign-in inside it may be needed.
   - No Background Sync and no `beforeinstallprompt`. Sync runs on app open, `visibilitychange`, `online`, after writes and on a timer.
   - UI rules: inputs ≥ 16px, `viewport-fit=cover` + safe-area insets, `100dvh`, `inputmode="numeric"`, touch targets ≥ 44px.
4. **RTL tooling:** shadcn/ui with `rtl: true` writes logical classes; Radix gets direction from `DirectionProvider`. `eslint-plugin-better-tailwindcss` (`enforce-logical-properties`) blocks physical classes, and `no-restricted-syntax` blocks `dir="rtl"`/`"ltr"` literals.
5. **Better Auth rate limits** use `storage: "database"`, since in-memory limits don't survive serverless.
6. **Route files** may export only handlers and route settings. Only `next build` catches other exports, so run it before work goes to `main`.

---

## 2. Architecture

```
┌──────────────────────── Device (iPhone PWA / browser) ────────────────────────┐
│  React UI (Next.js App Router, client components)                             │
│     │  reads: useLiveQuery()            writes: LocalStore                    │
│     ▼                                      │  (one Dexie transaction)          │
│  Dexie DB  "qct-<userId>"  ◄───────────────┘  record + outbox entry           │
│   classes · students · lessons · attendance · homework                        │
│   outbox · rejected · meta (cursor, accessVersion)                            │
│     ▲ apply pulled changes (LWW)        │ push outbox (batched)               │
│  Sync engine (single-flight via Web Locks, backoff, triggers)                 │
│  Service worker (Serwist): precached assets + cached page shells              │
└───────────────┬────────────────────────────────────▲──────────────────────────┘
                │ POST /api/sync/push                │ GET /api/sync/pull?since=N
┌───────────────▼────────────────────────────────────┴──────────────────────────┐
│  Next.js route handlers (Node runtime, Amplify compute)                       │
│   withTenant → Better Auth session + member (role, permissions, classes)      │
│   Zod validation (shared schemas incl. sura/ayah) → push / pull services      │
│   TenantRepository (every query scoped by tenantId)                           │
└───────────────┬───────────────────────────────────────────────────────────────┘
                ▼
        MongoDB (Atlas / local): tenants, users, members, auth_*, rate_limits,
        counters, classes, students, lessons, attendance, homework
```

### 2.1 Reads and writes are always local
- Every screen reads Dexie through `useLiveQuery`. Online and offline behave the same.
- Every write goes through `LocalStore` (`create`, `update`, `upsert`, `softDelete`). In **one Dexie transaction**, it writes the record and upserts an outbox entry.
- `updatedAt` is the device clock in epoch ms, kept increasing on each device. `updatedBy` is the device id (stored in the device-level `qct-app` DB); last-write-wins compares `updatedAt`, then `updatedBy`, the same way on server and client.
- Pages with no saved session redirect to `/login`. A small navigation guard holds in-app link clicks (up to 2 s) until pending IndexedDB writes finish, since an offline full page load would abort them.

### 2.2 IDs
- Most records use **UUIDv7**, generated on the client.
- Two use deterministic **UUIDv5** IDs, so two devices creating "the same thing" offline merge instead of duplicating:
  - `Lesson.id = uuidv5("<classId>:<date at creation>")`. If the date later changes, the ID stays. A soft-deleted lesson with the derived ID is revived; a live one moved to another date forces a UUIDv7.
  - `Attendance.id = uuidv5("<lessonId>:<studentId>")`: one record per student per lesson.
- Today's lesson is created only on the first write for that day (`startLesson`); before that, screens use its derived id without creating it.

### 2.3 Outbox
- Keyed by `recordId`: `{ table, recordId, rev, enqueuedAt, attempts, lastError }`. Repeated edits bump `rev`; a push sends the latest full snapshot.
- After the server acknowledges a push, the entry is removed **only if `rev` hasn't changed**, so an edit made during a push is never lost.
- Network or 5xx failures keep the entry and back off. **Nothing is ever dropped.**
- Validation rejections move the entry to `rejected`, shown in Settings → Sync with the localized reason and *retry* / *discard*.
- Pushes go in table order (classes, students, lessons, attendance, homework), then oldest first; the server writes each batch in that order, so a record never arrives before what it references.

### 2.4 Push: `POST /api/sync/push`
Request: `{ mutations: [{ table, record }] }`, max 200 per batch. For each mutation, in order:
1. Validate with the table's shared Zod schema (including `validateAyahRange`). Failure → `rejected` with codes.
2. Force `tenantId` from the session. An `_id` that exists under another tenant → `rejected: FORBIDDEN`.
3. Check references inside the tenant (already stored or earlier in the batch) → else `REFERENCE_NOT_FOUND`.
4. Consistency (everyone): attendance belongs to its lesson's class; lessons and attendance never change class.
5. Access (teachers): the table's permission (classes → `classes.manage`, students → `students.manage`, lessons/attendance/homework → `lessons.run`) and every class the write touches. A new class is added to its creator's classes at once.
6. Clamp `updatedAt` to at most `serverNow + 2 min`, allocate a `serverVersion`, and write with a **conditional upsert** (newer `updatedAt`, or equal with a greater `updatedBy`). A duplicate-key error means the stored copy is newer → `stale`.

Response: `{ results: [{ id, status: 'applied' | 'stale' | 'rejected', code?, params?, serverVersion? }], accessVersion }`.

### 2.5 Version counter and pull watermark
- `counters` holds one document per tenant: `{ _id: tenantId, seq, inFlight: [{ v, at }] }`. Allocation is one `findOneAndUpdate` (`$inc` + `$push`); written versions are `$pull`ed.
- A pull never returns a cursor at or above the lowest in-flight version, so it can't skip a version allocated but not yet written. Entries older than 30 s are treated as abandoned.

### 2.6 Pull: `GET /api/sync/pull?since=N&limit=500`
- Queries each collection for `serverVersion > since`, merge-sorts, caps at `min(limit, watermark)`, and returns `{ changes, cursor, hasMore, accessVersion }`. Soft-deleted records are included.
- A teacher only receives his classes, their students, lessons and attendance (`classId` in scope) and those students' homework. Admins are unfiltered.
- On the client, a pulled record replaces the local one **unless** it has an outbox entry and the local copy is newer. Then the cursor is saved. The first sign-in pulls from 0 while `hasMore`.

### 2.7 Sync engine
- **Triggers:** app start, `online`, `visibilitychange → visible`, 1.5 s after local writes, every 60 s while visible and online.
- **Single-flight:** `navigator.locks.request('qct-sync')`.
- **Backoff:** exponential from 2 s to 5 min with jitter; reset after a success.
- **401:** `needsLogin`; the outbox is kept, a banner asks to sign in again.
- **Scope changes:** changing a member's classes or permissions bumps his `accessVersion`. A device that sees a new value deletes every local record the server has confirmed (keeping pending and rejected ones) and pulls from 0. A student moving class re-versions his homework and bumps `accessVersion` for teachers who lose sight of him.
- **Indicator:** online / offline / syncing / "X changes waiting" / sign-in needed / rejected count.

### 2.8 Auth, centers and offline
- Better Auth issues an httpOnly session cookie (400 days, renewed daily), stored in Mongo. `withTenant` forwards the renewed cookie.
- The stored `username` is `<code>:<local>` (e.g. `482913:ahmad`), so Better Auth's global uniqueness gives per-center uniqueness; `displayUsername` holds `<local>`. The login form builds it from the center-code and username fields; the code is remembered on the device.
- Access lives in a server-only `members` document per user (`role`, `permissions`, `classIds`, `disabled`, `mustChangePassword`, `accessVersion`), loaded on every API request, so changes apply at once. Disabled → 401; `mustChangePassword` → 403.
- Better Auth's `/update-user` is disabled; profile changes go through `PATCH /api/account`. Admin user management goes through `withAdmin` routes under `/api/center`.
- After sign-in, the device saves a **session snapshot** (user, role, permissions, classes, center name, code and time zone) from `GET /api/me`. Pages aren't gated on the server; the client checks the snapshot.
- Sign-in, registration, user management, profile changes and password resets need a connection. Daily work doesn't.

### 2.9 Routing (offline-friendly)
- **No dynamic path segments:** `/`, `/class?id=…`, `/student?id=…`, `/class-stats?id=…&year=&month=`, `/print?class=…&month=…&students=…`, `/search`, `/settings`, `/users`, plus `/login`, `/register`, `/change-password`, `/forgot-password`, `/reset-password` and `/parent?s=…`.
- The service worker caches page shells by path (ignoring the query) and warms every shell after it becomes ready, so the whole app works offline after one online visit. Next.js page-data requests (`RSC: 1`) are network-only; offline, Next falls back to a full page load served from the shell cache.

### 2.10 i18n and direction
- next-intl **without i18n routing**. `src/i18n/request.ts`: `NEXT_LOCALE` cookie → kept if in `ENABLED_LOCALES` → else `DEFAULT_LOCALE` (`ar`).
- The root layout sets `<html lang dir>`, the locale's font, `DirectionProvider` and `NextIntlClientProvider`.
- Formats: `ar` uses `numberingSystem: 'latn'` and the Gregorian calendar.
- Domain functions return codes; `t('errors.<CODE>', params)` turns them into text. User text inside a translated sentence is wrapped in `<bdi>`.

### 2.11 Printing
- `/print` lives in its own route group: the sign-in gate and local data, without the app shell; cached for offline like the other pages.
- Print CSS: `@page` A4, one sheet per student, always light. On paper a sheet is only as tall as its content (iOS prints on its own paper size and margins). Long months switch to denser rows by row count.

### 2.12 The parent page
- The one page that reads from the server instead of the device: parents have no account and no local data. `/parent?s=<studentId>` calls `POST /api/parent { studentId, parentId?, month? }`; `DELETE /api/parent?s=…` forgets the phone.
- The server finds the student in any center, checks the parent ID or the remembered-phone cookie (`qct_parent_<studentId>`, path `/api/parent`), and builds the month with the same pure builders as the screens and the printout (`src/domain/stats/month-sheet.ts`). The response has names, rows, averages and counts; no internal ids or notes.

### 2.13 The mobile app (Phase 2, planned)
- **Same server, same protocol.** The app calls the existing `/api/*` routes on Amplify (base URL from `EXPO_PUBLIC_API_URL`). Better Auth's Expo plugin sends the session cookie from SecureStore; the app's own API calls add it too and save a renewed one from `withTenant`.
- **Local data:** one SQLite file per user (`qct-<userId>.db`) and a device-level one (`qct-app.db`: session snapshot, device id, center code). Each syncable table stores the record as JSON plus the columns the Dexie indexes use today (§4). Screens subscribe to the tables they read; `LocalStore` notifies them after each committed transaction, which replaces `useLiveQuery` (§2.14).
- **SQLite rules (measured in the 2026-10-24 spike):**
  - Writes only go through one in-app write queue, and transactions only through `withExclusiveTransactionAsync`, with `PRAGMA busy_timeout` as a safety net. `withTransactionAsync` doesn't isolate: a write made elsewhere during it joins it and is rolled back with it. Without `busy_timeout`, a write during an exclusive transaction fails with "database is locked".
  - SQLite's own change listener isn't used: it fires once per row, mid-transaction, and even for rolled-back writes.
  - Bulk writes insert up to 100 rows per statement: 5,000 records took 0.55 s, against 4.6 s one row at a time.
- **Hermes gaps:** Hermes has no `Intl.PluralRules`, `Intl.Locale`, `Intl.RelativeTimeFormat`, `Intl.supportedValuesOf` or `crypto.getRandomValues`.
  - Without them, plural messages render their key, `getDirection` falls back to `ltr` for Arabic, and `uuid` throws.
  - The app loads FormatJS polyfills (with `ar` and `en` data) and `expo-crypto`'s `getRandomValues` before anything else. With them, every probed format matched Node.
  - `DateTimeFormat` (including Asia/Hebron daylight saving) and `NumberFormat` are native and already match.
- **Sync engine:** the shared engine from `packages/core` with mobile triggers: app start, `AppState → active`, NetInfo back online, 1.5 s after writes, every 60 s while active. Single-flight is an in-process lock (one JS runtime). Logout and a forced logout delete the user's database file.
- **Not carried over:** the service worker, page-shell cache, install guide, `storage.persist()` and the navigation guard (native navigation doesn't abort pending writes).
- **Printing:** the shared month-sheet builders produce an HTML sheet (embedded font, QR as SVG); `expo-print` opens the system print dialog or saves a PDF to share.

### 2.14 One data layer (Phase 2, step 2.4, planned)
`LocalStore`, the outbox, apply-pull, the sync engine and the per-entity actions and queries move into `packages/core` and talk to a small **storage interface**. Each app supplies an **adapter**: Dexie on the web (2.4), SQLite on mobile (2.7).

- **Async.** Every operation returns a Promise. IndexedDB is async-only, and expo-sqlite's async API keeps queries off the UI thread. The synchronous `node:sqlite` is wrapped for tests.
- **A small set of operations** per table, the only ones shared code may use:
  - `get`, `bulkGet`, `put`, `bulkPut`, `delete`, `bulkDelete`;
  - `query(table, index, …)` with `equals`, `between` or `anyOf`, on the indexes of §4's Dexie list (including `[classId+date]`).

  Sorting, filtering and statistics stay in plain TypeScript after the fetch, as today. Each operation maps directly to Dexie, and to SQL on indexed columns.
- **Transactions pass an explicit handle.** `store.transaction(async (tx) => { … })`. The callback can only reach `tx`, which has the reads above and the `LocalStore` writes (`create`, `update`, `upsert`, `softDelete`, `restore`). That makes it all or nothing on both platforms. Dexie's implicit transaction zone has no SQLite equivalent.
  - Web: one Dexie read-write transaction over every data table, so actions no longer list their tables (`writableTables` goes away).
  - Mobile: §2.13's write queue and exclusive transaction.
- **Change notifications after commit.** `LocalStore`, and apply-pull for synced records, announce the set of tables a committed transaction changed.
  - The mobile screen hook re-runs a query when a table it read changed.
  - The web ignores the announcements: `useLiveQuery` already sees Dexie's writes, so web screens don't change.
- **Shared queries.** The per-entity read functions (a class's students, a student's month…) live in core and take a reader, either the store or `tx`.
  - The web's hooks wrap them in `useLiveQuery`; Dexie tracks reads made through its adapter.
  - Mobile's hooks wrap them in the subscription hook.
- **One contract test suite** runs against every adapter: Dexie on `fake-indexeddb` in 2.4, SQLite on `node:sqlite` in 2.7. The existing `LocalStore`, action and sync tests then run unchanged on top of each.
- **Injected platform pieces.** The sync engine gets its lock, triggers, `fetch`, clock and online check from the app. The web passes Web Locks and the browser events it uses today.

---

## 3. Folder structure

A pnpm workspace since 2.2 (`pnpm-workspace.yaml`, `.npmrc` with `node-linker=hoisted`). Root scripts pass through to the packages.

```
.
├── BRIEF.md · PLAN.md · README.md · CLAUDE.md · LICENSE
├── package.json         root scripts (pass-through) · Prettier
├── infra/               amplify-stack.yml · github-deploy-role.yml
├── .github/workflows/   ci.yml (lint + typecheck on PRs) · deploy-stack.yml
├── packages/core/       React-free shared code, package @qct/core (TypeScript source; the
│   │                    importing app compiles it: Next's transpilePackages)
│   ├── messages/            ar.json · en.json
│   └── src/
│       ├── domain/          PURE: quran (sura map, validation, search) · homework (suggestion,
│       │                    progress) · stats (monthly, class, month-sheet) · dates · text
│       ├── shared/          client + server: schemas · sync (protocol, lww, tables) · access ·
│       │                    ids · session · parent
│       ├── data/            storage interface · LocalDatabase · memory adapter · LocalStore ·
│       │                    outbox · sync (engine, apply-pull, rejected, backoff, indicator) ·
│       │                    entities (actions and queries) · testing (suites for every adapter)
│       ├── i18n/            config · direction · formats · error messages
│       └── test/            record builders
├── apps/mobile/         the Expo app, package @qct/mobile (EAS project @imenu/quran-classes-tracker)
│   ├── index.ts             entry: polyfills first, then Expo Router
│   ├── app.json · eas.json  ai.imenu.quran · RTL at start · fonts · splash · build profiles
│   └── src/
│       ├── app/             routes: (tabs) with native tabs, a stack per tab
│       ├── components/      Text · Screen · EmptyState · stack options · the dev Intl check
│       ├── i18n/            locale · use-intl provider · message types
│       ├── theme/           colors (the web's tokens) · fonts · useTheme
│       └── polyfills.ts     Intl and crypto for Hermes
└── apps/web/            the Next.js app, package @qct/web
    ├── scripts/             center-create.ts · db-indexes.ts · dev-seed.ts
    ├── e2e/                 main-flow · offline · roles · parent · ltr-smoke specs; server.mts
    └── src/
        ├── app/
        │   ├── layout.tsx · manifest.ts · sw.ts      html lang/dir, providers, PWA
        │   ├── login · register · change-password · forgot-password · reset-password
        │   ├── (app)/       home · class · class-stats · student · search · settings · users
        │   ├── (print)/     print
        │   ├── parent/      the parent page
        │   └── api/         auth · sync/push · sync/pull · me · account · centers · center · parent
        ├── i18n/            request (next-intl) · message types · useErrorMessage
        ├── server/          env · db · indexes · auth · repositories · sync · centers · members ·
        │                    parent · email (SES) · rate-limit
        ├── client/          db (Dexie schema and adapter) · data (live-query hooks) ·
        │                    sync (triggers, Web Locks) · session · auth · pwa
        ├── components/      ui (shadcn, rtl) · shell · classes · students · homework · lessons ·
        │                    print · parent · users · settings · auth · quran
        └── test/            setup, fake-indexeddb, mongo-memory helpers
```

Tests sit next to the code as `*.test.ts(x)`; each package runs its own with Vitest. Server integration tests are `*.int.test.ts` and use `mongodb-memory-server`.

---

## 4. Data model

### Common fields on every syncable record (`classes`, `students`, `lessons`, `attendance`, `homework`)

| Field | Type | Notes |
|---|---|---|
| `_id` / `id` | string (UUID) | Generated on the client. Stored as Mongo `_id`; the DTO calls it `id`. |
| `tenantId` | string | Set by the server from the session. |
| `createdAt` | number (epoch ms) | |
| `updatedAt` | number (epoch ms) | The LWW key. |
| `updatedBy` | string | The device that made the last change; the LWW tie-break. |
| `deletedAt` | number \| null | Soft delete. |
| `serverVersion` | number | Assigned by the server; `0` locally until synced. |

### Entities

**`tenants`** (server only; a tenant is a **center**)
- `_id`, `name`, `code` (6 digits, unique), `timezone` (default `Asia/Hebron`), `createdAt`

**`users`** (Better Auth `user` model, renamed)
- `_id`, `name`, `username` (`<code>:<local>`, unique, lowercase), `displayUsername` (`<local>`)
- `email`: the admin's real email; for teachers a hidden placeholder. Unique.
- `phone` (optional), `emailVerified`, `tenantId` (`input: false`), `locale` (default `ar`), `createdAt`, `updatedAt`

**`members`** (server only)
- `_id` (= user id), `tenantId`, `role: 'admin' | 'teacher'`, `permissions: string[]`, `classIds: string[]`
- `disabled`, `mustChangePassword`, `accessVersion`

**`auth_sessions`, `auth_accounts`, `auth_verifications`, `rate_limits`**: Better Auth models, renamed. The argon2id hash lives in `auth_accounts`.

**`counters`**: `_id: tenantId`, `seq`, `inFlight[]`

**`classes`**: `name`, `archivedAt: number | null`

**`students`**
- `classId`, `fullName`, `birthYear` (int, 1900–current year), `note`
- `memorizationDirection: 'forward' | 'backward'`
- `parentId: string` (default `''`): the parent's ID number, `''` or 5–20 digits (Arabic-Indic and Persian digits converted, spaces and dashes removed)
- `archivedAt`

**`lessons`**: `classId`, `date` (`YYYY-MM-DD`, center time zone), `note`

**`attendance`**
- `lessonId`, `studentId`, `classId` (always the lesson's class, so pulls can be scoped)
- `status: 'present' | 'absent' | 'excused'`, `excuseNote` (only for `excused`)

**`homework`**
- `studentId`, `surah` (1–114), `fromAyah`, `toAyah` (validated by `validateAyahRange`), `note`
- `assignedLessonId | null`, `evaluatedLessonId | null`; pending = `evaluatedLessonId == null`
- `memorizationRate`, `behaviorRate`: int 1–10 or null
- `postponedLessonIds: string[]` (default `[]`): lessons in which the recitation was postponed
- `kind: 'homework' | 'exam'` (default `'homework'`). An exam's mark is in `memorizationRate`; its `behaviorRate` stays null.

Records pulled from the server aren't re-validated on the device, so newer fields are read through helpers that supply the default (`postponedLessonsOf()`, `kindOf()`); the server fills defaults when an older device pushes without them.

### Derived rules (computed, never stored)

**Monthly stats.** The month comes from `lessons[evaluatedLessonId].date`. Averages ignore nulls, postponements and exams, rounded to 1 decimal ("—" with no data). Attendance counts come from that month's lessons. Soft-deleted records and children of deleted lessons are excluded.

**Month table and sheet** (`src/domain/stats/month-sheet.ts`). One row per recorded thing (a mark, a postponement, an exam, an absence), not per calendar day; averages and counts in the footer. Shared by the student page, the printout and the parent page.

**Class statistics** (`src/domain/stats/class.ts`). A student's possible days are the class's lesson days since he joined plus any day he has a record for, so the rate never exceeds 100%. Ranking per decision #35.

**Next-homework suggestion**
- Starts from the student's **most recent homework item, pending or evaluated** (exams ignored).
- Same size as the previous item, continuing at `toAyah + 1`, clamped to the end of the sura.
- At the end of a sura, moves to the next one (`+1` forward, `−1` backward) from ayah 1; `null` after sura 114 (forward) or 1 (backward).
- With no history: nothing, or sura 114 if the student is set to backward.

**Lesson deletion.** Deletes its attendance and the homework assigned in it; homework evaluated in it goes back to pending; homework assigned in it but evaluated later keeps its history with `assignedLessonId` cleared.

**Attendance and postponing.** Marking absent or excused cancels that lesson's postponements; postponing or scoring marks the student present; scoring removes a postponement for that lesson.

### Indexes (`pnpm db:indexes`, idempotent)

| Collection | Index |
|---|---|
| users | `{ username: 1 }` unique · `{ email: 1 }` unique · `{ tenantId: 1 }` |
| members | `{ tenantId: 1 }` |
| auth_sessions | `{ token: 1 }` unique · `{ userId: 1 }` · `{ expiresAt: 1 }` TTL |
| auth_accounts | `{ userId: 1 }` · `{ providerId: 1, accountId: 1 }` |
| rate_limits | `{ key: 1 }` unique |
| tenants | `{ code: 1 }` unique |
| classes | `{ tenantId: 1, serverVersion: 1 }` |
| students | `{ tenantId: 1, serverVersion: 1 }` · `{ tenantId: 1, classId: 1 }` |
| lessons | `{ tenantId: 1, serverVersion: 1 }` · `{ tenantId: 1, classId: 1, date: 1 }` |
| attendance | `{ tenantId: 1, serverVersion: 1 }` · `{ tenantId: 1, lessonId: 1 }` · `{ tenantId: 1, classId: 1 }` · `{ tenantId: 1, studentId: 1 }` |
| homework | `{ tenantId: 1, serverVersion: 1 }` · `{ tenantId: 1, studentId: 1 }` · `{ tenantId: 1, evaluatedLessonId: 1 }` |

`src/server/indexes.ts` is the exact list.

**Dexie (client) indexes:** `classes: id, updatedAt` · `students: id, classId, fullName` · `lessons: id, classId, [classId+date], date` · `attendance: id, lessonId, studentId` · `homework: id, studentId, assignedLessonId, evaluatedLessonId` · `outbox: recordId, enqueuedAt` · `rejected: recordId` · `meta: key`.

---

## 5. Libraries

| Library | Version | Why |
|---|---|---|
| next | **15.5.x** | Latest version Amplify supports for SSR (§1.1). |
| react / react-dom | 19.x | |
| typescript | **5.9.3** | Strict, plus `noUncheckedIndexedAccess`. |
| next-intl | 4.14.x | App Router without i18n routing; ICU messages and `Intl` formatters. |
| better-auth | 1.7.7 (+ Mongo adapter) | Username plugin, DB-backed rate limiting, cookie sessions, password reset. |
| @node-rs/argon2 | 2.2.x | argon2id hashing (in `serverExternalPackages`). |
| mongodb (driver) | 7.7.x | Chosen over Mongoose: Zod is the single schema; conditional upserts and `$inc` counters are clearer with the raw driver. |
| zod | 4.6.x | Shared client/server schemas; issues carry codes, not text. |
| dexie / dexie-react-hooks | 4.4.x | IndexedDB with transactions and `useLiveQuery`. |
| uuid | 14.x | v7 and v5. |
| @serwist/next + serwist | 9.5.x | Service worker. |
| @aws-sdk/client-sesv2 | 3.x | Password-reset email. |
| qrcode | 1.5.x | Parent-link QR codes, drawn as SVG from its matrix (offline). |
| tailwindcss / shadcn | 4.3.x / 4.21.x (`rtl: true`) | Logical classes. Radix, vaul, cmdk, sonner, lucide-react, next-themes. |
| eslint / eslint-plugin-better-tailwindcss | 9.39.x / 4.8.x | `enforce-logical-properties` as an error. |
| prettier + prettier-plugin-tailwindcss | 3.9.x | |
| vitest / fake-indexeddb / mongodb-memory-server / Testing Library | 5.0.x / latest / 11.x | Unit, component and integration tests. |
| @playwright/test | 1.63.x | E2E: iPhone 15 (WebKit), Pixel 7, Desktop Chrome. |
| tsx | latest | Runs the TS CLI scripts. |

Fonts: IBM Plex Sans Arabic (`ar`) and IBM Plex Sans (`en`) via `next/font/google`, self-hosted. Node 22 LTS (`.nvmrc`, `engines`).

**Mobile (Phase 2; versions pinned in `apps/mobile/package.json` since 2.5: Expo 58.0.19, Expo Router 58.0.26, React Native 0.88.0, React 19.3.0, use-intl 4.14.9, jest-expo 58.0.12)**

| Library | Why |
|---|---|
| expo **SDK 58** (React Native 0.88, React 19.3; current on 2026-10-24) + dev client | New Architecture, config plugins, dev builds (Expo Go can't load our native modules). |
| expo-router | File routes, native stack, native tabs, form sheets, header search. |
| expo-sqlite | The local database (#48, §2.13 SQLite rules). |
| better-auth + @better-auth/expo (same version as the server), expo-secure-store, expo-network, expo-linking, expo-constants, expo-web-browser | Sign-in and the stored session (#49). The plugin replaces `:` in SecureStore keys and splits large values itself. The last four are its required peers. |
| @formatjs/intl-getcanonicallocales, -locale, -pluralrules, -relativetimeformat, -enumerator; expo-crypto | Hermes's missing `Intl` APIs and `crypto.getRandomValues` (§2.13). |
| use-intl | The core of next-intl: same ICU messages and `useTranslations` API. |
| @react-native-picker/picker, @react-native-community/datetimepicker | The mark wheel (#32) and the system date picker. |
| @react-native-community/netinfo | Online/offline trigger. |
| expo-print, expo-sharing, expo-font, expo-localization, react-native-svg | Printing and PDF, sharing, fonts, RTL config, QR codes and icons. |
| eas-cli | Cloud builds, store submission, OTA updates. |
| jest-expo + @testing-library/react-native | Component tests (Metro/RN don't run under Vitest; `packages/core` stays on Vitest). |
| Maestro | Mobile E2E flows (Android emulator locally). |

---

## 6. Phases

**Progress**

| Phase | Status |
|---|---|
| 1. The PWA: offline-first web app for centers, teachers and parents | [x] Done |
| 2. React Native app: iOS and Android, phones and tablets | [ ] In progress |

Every step ends with `pnpm lint && pnpm typecheck && pnpm test`, then one Conventional Commit on `dev`, then a tick in this file. Stop at the end of each phase for the go-ahead.

### [x] Phase 1: The PWA

Built in 14 parts, in this order. Each part was planned, verified (unit, integration, E2E and browser checks at 360 px in RTL) and committed step by step; the git history has the detail.

- [x] **1.1 Foundations.** Next.js 15.5 scaffold, strict TypeScript, ESLint with the logical-properties rule, Prettier, Vitest. The 114-sura map, ayah-range validation with codes, and Arabic-aware search (tashkeel, tatweel and alef/ya/ta-marbuta folding). next-intl with `ar`/`en` parity and direction, the green/teal theme (light and dark), shadcn in RTL with `DirectionalIcon`. Shared Zod schemas, Zod-validated env, cached Mongo client, indexes script. Better Auth (username, argon2id, 400-day sessions, DB rate limits), tenant context and the tenant-scoped repository. Login and logout; CI.
- [x] **1.2 Offline sync.** The per-user Dexie DB, `LocalStore` with the atomic outbox, pure LWW rules, version allocation with the in-flight watermark, the push and pull services and routes, the client sync engine (Web Locks, triggers, backoff, rejected store), the session snapshot and `pnpm dev:seed`, and the sync indicator (§2).
- [x] **1.3 Classes and students.** The app shell (header, bottom navigation, safe areas, skeletons, empty states, two columns from `md`). Class cards; create, rename and archive (blocked with active students). Students: add, edit, move, archive. Global search with Arabic normalization.
- [x] **1.4 Lessons.** Date helpers in the center's time zone; deterministic lesson ids; attendance marking; the searchable sura drawer and ayah inputs with live errors; the next-homework suggestion; evaluation with progress; lesson deletion. (The lesson screens were later folded into the student page, 1.9.)
- [x] **1.5 Student profile and monthly stats.** Pure monthly statistics and the student's page. (The chart and month cards were later replaced by the month table, 1.9.)
- [x] **1.6 PWA and offline hardening.** Serwist (precache, page-shell cache, offline page), manifest and icons, the iOS install guide and persistent storage. Settings: profile, theme, sync details with retry/discard, logout with the unsynced warning. Playwright E2E (main flow, offline, LTR smoke) on its own memory-server world. README.
- [x] **1.7 Deployment.** The Amplify CloudFormation stack (service role, app, build spec, `main` branch), the OIDC deploy role and workflow, CI on pull requests, README deployment guide (§0 #21).
- [x] **1.8 Centers, roles and permissions.** Public registration with a 6-digit center code; sign-in with code + username + password; the forced first password change; server-side access in push and pull with `accessVersion` resyncs; access in the client (hidden or read-only actions); user management for admins; own profile and center settings; password reset by email via SES; `pnpm center:create`; the `roles` E2E spec (§0 #22–27, §2.8).
- [x] **1.9 Student-centred screens and postponing.** `postponedLessonIds`, postpone and undo. The student page's today card (attendance, due homework, recite now, next-day homework) and the month table with its edit sheet. The class page became the student list; the lesson screens and `/lesson` were removed (§0 #28–31).
- [x] **1.10 Calmer marking.** The native-select mark picker and collapsible homework items; a larger today card and next-day box (§0 #32–33).
- [x] **1.11 Class statistics and ranking.** Pure `classStatistics()`, `/class-stats` with the year and month filter, the ranked list (§0 #34–36).
- [x] **1.12 Exams.** `kind: 'exam'`, "إضافة اختبار", violet exam rows, exams left out of averages and the suggestion. The month table starts closed (§0 #37).
- [x] **1.13 Printable month sheets.** Shared sheet builders, `/print` with the A4 sheet, preview and print CSS, and both entry points (§0 #38, §2.11).
- [x] **1.14 Parent link.** `Student.parentId`, the parent API with its checks, cookie and rate limits, the `/parent` page, the share drawer with QR, and a QR on every printed sheet; the `parent` E2E spec (§0 #39–42, §2.12).

### [ ] Phase 2: React Native app

An Expo app for iPhone, iPad, Android phones and Android tablets with the PWA's features, native navigation and native controls (§0 #43–53, §2.13). Steps 2.1–2.4 prepare the repo and keep the web app unchanged; 2.5–2.13 build the app; 2.14–2.16 test, add account deletion and release.

**Prerequisites:**
- Done: an Expo (EAS) account (signed in); Android Studio with phone and tablet emulators (`qct_phone`, `qct_tablet`); the Apple Developer account.
- Before 2.5: Windows long paths turned on (`LongPathsEnabled`, a one-time admin change). Otherwise local Android builds of `apps/mobile` may hit the 260-character path limit, and the app would build only on EAS.
- Before 2.5's iPhone check: your iPhone registered for development builds (`eas device:create`).
- Before 2.16's Android part: a Google Play developer account.

**Verification per step:** `pnpm lint && pnpm typecheck && pnpm test` from the root runs every workspace package. Web steps also run `pnpm build` and the web E2E suite. Mobile UI steps are checked on the Android emulator (Claude) and on your iPhone/iPad dev build (you), at 360 dp in RTL, light and dark.

- [x] **2.1 Rename to "تحفيظ القرآن".** Messages (`ar`/`en`), PWA manifest, page titles, printed sheet header, README and this file's title. Installed PWAs keep the old name until re-added; that's acceptable (#46).
- [x] **2.2 Monorepo with `apps/web`.**
  - pnpm workspace; move the Next.js app, its configs, `e2e/` and `scripts/` into `apps/web`. `infra/`, `.github/` and the docs stay at the root.
  - Amplify build spec: `appRoot: apps/web` and `AMPLIFY_MONOREPO_APP_ROOT`; install only the web app's dependencies (`--filter`), still with the hoisted `node-linker`. CI runs lint and typecheck across the workspace.
  - Update README, `CLAUDE.md` and the three skills for the new paths.
  - Web behaviour unchanged: unit, integration and E2E tests and `pnpm build` green. **You deploy the stack change with the merge**; Amplify's first build of `main` may start before the stack update finishes and need one re-run.
- [x] **2.3 `packages/core`.** Move the pure code: `src/domain`, `src/shared`, the platform-free parts of `src/i18n` (config, direction, formats, error codes) and `messages/`. React-free, Vitest, imported as `@qct/core/...`. Web unchanged; tests move with their code.
- [x] **2.4 One data layer (#48, §2.14).**
  - The storage interface in `packages/core`:
    - async;
    - per table: `get`, `bulkGet`, `query` by index (`equals`, `between`, `anyOf`), `put`, `bulkPut`, `delete`, `bulkDelete`;
    - the outbox, rejected and meta stores;
    - `transaction(fn)`, which passes an explicit `tx` handle;
    - change notifications after commit.
  - A contract test suite for adapters, and the Dexie adapter, which passes it on `fake-indexeddb`.
  - Move these onto it: `LocalStore`, the outbox, apply-pull, the sync engine (with the lock, triggers, `fetch`, clock and online check injected), backoff, the indicator state, and the per-entity actions and queries (`src/client/data`).
  - Multi-record actions take `tx` instead of Dexie's implicit transaction; `writableTables` goes away.
  - The web keeps its `useLiveQuery` hooks, now wrapping the shared queries. Every existing test runs against the Dexie adapter, and web behaviour is unchanged: unit, integration and E2E tests and `pnpm build` green.
- [x] **2.5 Expo app scaffold (`apps/mobile`).**
  - **Setup:**
    - Expo SDK 58, dev client, `ai.imenu.quran`, URL scheme, EAS profiles (development, preview, production), runtime version per app version.
    - Metro resolves `@qct/core` from the workspace.
    - One TypeScript version across the workspace: the repo's 5.9.3, unless Expo needs 6, which its template ships. Core type-checks under both.
  - **Polyfills first (§2.13):** FormatJS (`ar`, `en`) and `expo-crypto`, loaded before anything else. A Jest test renders Arabic plurals and dates through them.
  - **A fix in core:** `toAppLocale` and `getDirection` read the language subtag without `Intl.Locale`, so a missing polyfill can't silently turn Arabic into LTR.
  - RTL at start (#53), IBM Plex Sans Arabic, light/dark theme tokens, `use-intl` with the shared messages.
  - ESLint blocks physical style props (`marginLeft`, `paddingRight`, `left`, `textAlign: 'left'`…) like the web's logical-class rule.
  - Jest (jest-expo) with Testing Library. Expo Router skeleton with native tabs and stacks and empty screens.
  - Add the mobile UI rules (logical styles, native controls, RTL, tablet widths) to the `rtl-i18n-ui` skill.
  - Checked on the Android emulator and on your iPhone dev build.
- [ ] **2.6 Sign-in on mobile.**
  - Server: the Better Auth Expo plugin and the app scheme in `trustedOrigins`; integration tests that the cookie-header client works with `withTenant` (including the renewed cookie) and sync.
  - App: SecureStore storage adapter; sign-in with center code + username + password (code remembered); center registration; forgot password (the email's link opens the web reset page); the forced first password change; the session snapshot from `/api/me`; the signed-out gate.
- [ ] **2.7 SQLite storage and sync on mobile.**
  - The SQLite adapter (§2.13, §2.14):
    - per-user and device databases, and schema migrations;
    - the write queue with exclusive transactions and `busy_timeout`;
    - `bulkPut` at up to 100 rows per statement;
    - change notifications from `LocalStore`, and the screen hook that replaces `useLiveQuery`.
  - Tested in Vitest through the same SQL on `node:sqlite`: it passes the 2.4 contract suite and runs the shared `LocalStore` and sync tests. `node:sqlite` needs no flag from Node 22.13, so `engines` and `.nvmrc` move to at least 22.13.
  - Mobile triggers and lock, the sync indicator, 401 → sign-in banner, `accessVersion` resync. Logout with the unsynced warning and "sync now"; database wipe.
  - Checked: offline writes on the emulator sync to a local server and show up in the web app.
- [ ] **2.8 Home, classes and students.**
  - Native tabs (home, search, settings, users for admins). Class cards; create, rename and archive (blocked with active students) in form sheets; archived classes.
  - The class page's student list; add, edit, move and archive students (including the parent ID); the header search bar with Arabic normalization; empty and loading states; access (hidden or read-only).
- [ ] **2.9 The student page.**
  - The today card: attendance (present / absent / excused with its note), due homework as collapsible items, the mark wheel, postpone and undo, recite now, next-day homework with the suggestion.
  - The searchable sura sheet and ayah fields with live errors; exams with the violet rows.
  - The month table with month navigation and the edit sheet for past days; view-only mode.
- [ ] **2.10 Class statistics.** Year and month filter (native menus), attendance rate and average marks, the ranked students (§0 #34–36).
- [ ] **2.11 Settings and administration.** Profile, password, theme, sync details with retry/discard, center settings (name, time zone); user management for admins: create, edit classes and permissions, reset password, disable.
- [ ] **2.12 Printing and the parent link.**
  - HTML month sheets from the shared builders (font embedded, QR as SVG) through `expo-print`: print, or save and share a PDF.
  - Both entry points: "طباعة الشهر" and the class's "طباعة كشوف الطلاب" (month, "تحديد الكل").
  - "رابط ولي الأمر": the web link, copy, the share sheet and its QR.
- [ ] **2.13 Tablets.** iPad and Android tablet layouts: multi-column grids and readable content widths where the web uses two columns; phones portrait, tablets in all orientations (iPad multitasking needs it). Checked on your iPad and an Android tablet emulator.
- [ ] **2.14 Mobile E2E and device checks.** Maestro flows on the Android emulator (main flow, offline, roles) with their own seeded server; an `en` LTR smoke render in Jest; a README checklist for iPhone and iPad (offline, print, share, RTL).
- [ ] **2.15 Account deletion (#50).** Who can delete what (e.g. an admin deletes the center and all its data; a teacher deletes his own account) is agreed with you before the step. The API, the app screens, and the same option on the web.
- [ ] **2.16 Release.**
  - App icon, splash screen, a privacy policy page on the web, a demo center for App Review.
  - App Store: listing in Arabic and English, EAS production build, TestFlight, then submission. EAS Update channel for JS fixes.
  - Google Play: production build and internal testing once the account exists. A new *personal* Play account must run a closed test with 12 testers for 14 days before publishing; an organization account (D-U-N-S number) doesn't. If the account isn't ready, the Android part stays open (`[~]`) and the phase closes without it.

---

## 7. Change log

The plan had 14 phases until 2026-10-22; they are now parts 1.1–1.14 of Phase 1, in the same order, so "Phase N" in older commits means part 1.N.

- 2026-10-05 (initial plan): changes against the brief: `Session` → `Lesson`; UUIDv5 for lessons and attendance; Next 15.5 for Amplify; query-param routes; no server-side page gating; the suggestion starts from the most recent item, pending or evaluated; `memorizationDirection` and the center time zone added; CI runs lint and typecheck only.
- 2026-10-05 (1.1):
  - `validateAyahRange` returns `params: { surah, ayahCount }` and a `field`; the i18n layer resolves the sura name, keeping the domain locale-free. The normalizer is `normalizeForSearch` (Arabic and Latin, ٱ, Arabic-Indic digits).
  - The CI workflow was validated with `@action-validator/cli` (actionlint needed Docker). `pnpm typecheck` runs `next typegen` first.
  - Arabic progress labels use "جاري", not "جارٍ": WebKit wrapped the tanween form inside a button.
- 2026-10-05 (1.2): `updatedBy` (device id) replaces the `_lwwTie` placeholder as the LWW tie-break; a retried push comes back "stale" and is cleared safely. The session snapshot and device id live in a device-level DB (`qct-app`). `GET /api/me` supplies the center's name and time zone.
- 2026-10-05 (1.3–1.5):
  - User text in a translated sentence is wrapped in `<bdi>`. The Next.js dev badge is off (it covered the navigation). Playwright's Windows WebKit clips Arabic with heavy tashkeel; real iOS is a manual check.
  - Lessons can't be dated in the future. "Mark all present" skips students already marked; tapping a selected status clears it. Ayah inputs are limited by digits, not clamped, with the error shown at once.
  - `next.config` reads its build directory from `NEXT_DIST_DIR`, so Claude's checks (port 3001, `.next-check`) never disturb the user's `pnpm dev`.
  - Edit sheets track records by id, not by list row (a row vanishing used to leave the page blocked). `<main>` has `overflow-x: clip`.
- 2026-10-05 (1.6):
  - Page-data requests are network-only and page shells are cached by path (§2.9). `reloadOnOnline` is off.
  - `pnpm test:e2e` runs its own world (memory Mongo, a production build in `.next-e2e`, port 3100), one account per spec and project, with a per-context `x-forwarded-for`. The offline spec runs in Chromium only; the iPhone offline path is a README checklist.
  - The mark picker shows the chosen value at once and rolls back on a failed write (WebKit's IndexedDB round trip was 200+ ms).
  - A stray check script committed in 1.1 was removed.
- 2026-10-06 (1.7): Deployment moved from a repo `amplify.yml` and manual console setup to the CloudFormation stack (6.6 of the old plan `[~]`). The build installs with a hoisted `node-linker` (Amplify's SSR packaging misses symlinked packages). Env values with `#` must be URL-encoded. The `imenu-ai` org puts immutable ids in the OIDC subject (`repo:imenu-ai@155732539/quran-classes-tracker@1405484269:environment:production`); the trust accepts both forms, plus `ref = refs/heads/main` and `aud = sts.amazonaws.com`, and the deploy job uses the `production` environment.
- 2026-10-10 (1.8):
  - The database was wiped instead of migrated (no real data yet). Device sessions from before count as signed out.
  - Center codes are random and retried on collision; only the E2E server and the CLI can fix one. Registration is limited to 5 an hour per IP.
  - Better Auth's username plugin calls the user's own unchanged username "taken", so services send the username only when it changes; profile forms send only changed fields.
  - Admins sync before assigning classes, so classes just created on their device exist on the server.
  - View-only screens use a disabled `<fieldset>`. Reset emails are in the user's language; the SSR compute role (not the build role) has SES permission. The forgot-password page answers the same whether or not the email exists.
  - After the first deploy: a route file exported a constant and only `next build` failed on it (§1.6). Constants live under `src/server` or `src/shared`.
- 2026-10-10 (1.9):
  - Pushes go in table order (§2.3): a homework item scored in a just-created lesson had reached the server before the lesson.
  - The navigation guard (§2.1) fixes a mark tapped just before "back" being lost offline. The search page no longer navigates on load.
  - When a student is absent or excused, the homework part of the today card is hidden. `recharts` and the shadcn chart were removed. 51 unused message keys were deleted.
- 2026-10-11 (1.10, from the user): the student details box was removed (they're in "edit student"); the today card is larger; next-day homework has its own dashed box.
- 2026-10-12 (1.12): the schema refuses a behavior mark on an exam. `MonthTable` takes `editable`, so the month arrows work for view-only users (they had been disabled by the `<fieldset>`).
- 2026-10-13 (1.13): long months use denser rows (up to 24 normal, 34 dense, then denser; about 43 fit). On iPhone a blank page followed each sheet, because iOS prints on its own paper; sheets now size to their content and `main-flow` also checks Letter with margins. The preview scales with CSS `zoom`. Whether `window.print()` works from the home-screen app is in the README's manual check.
- 2026-10-13 (1.14): after a failure limit is reached, even the right ID is refused until the window ends. The cookie is per student and refreshed on each visit. The printed QR sits beside the header so sheets keep one page; jsQR decoded it back to the link.
- 2026-10-22: the plan was condensed: the 14 phases became Phase 1, and Phase 2 (React Native app) was added, to be planned.
- 2026-10-22 (Phase 2 planned, with the user): option (b) for native components (#44), the PWA kept (#45), strict parity, registration in the app with deletion before release (#50), App Store first, the new name and `ai.imenu.quran` (#46), the `apps/web` monorepo (#47). Expo SDK 56 (May 2026, React Native 0.85) is the latest confirmed release; a later one is pinned in 2.5 if it's out.
- 2026-10-22 (2.1): only the shown name changed (`app.*` messages, the reset email subject, README, examples). Internal `qct` ids stay (database names, the `qct.session_token` cookie, storage keys, the planned `@qct/core`): they abbreviate the repo name, which doesn't change. The app has no real users yet, so later steps may wipe sessions and data freely. `BRIEF.md` keeps the original name. The deployed `EMAIL_FROM` lives in the Secrets Manager secret, so its sender name is the user's to change.
- 2026-10-22 (2.2):
  - Amplify's docs require a root `.npmrc` with `node-linker=hoisted` for a pnpm monorepo, so local installs are hoisted now too (before, only the Amplify build passed the flag). The build spec runs from the workspace root (`buildPath: /`) with `appRoot: apps/web`, the matching `AMPLIFY_MONOREPO_APP_ROOT` app variable, a `--filter "@qct/web..."` install, the secret written to `apps/web/.env`, and artifacts in `apps/web/.next`. The filtered, frozen-lockfile install and the build were rehearsed on a clean export of the commit.
  - Root scripts pass through (`pnpm --filter @qct/web …` or `pnpm -r …`), so every documented command still runs from the root; CI needed no change. Prettier stays at the root for the whole workspace. Root-anchored ignore patterns moved to `apps/web/.gitignore`.
  - `E2E_PORT` overrides the E2E port: another project's `next start` held 3100 on this machine.
- 2026-10-24 (2.3):
  - `@qct/core` ships TypeScript source with no build step. `exports` maps `./*` to `./src/*.ts`, plus the two folder entry points and `./messages/*`. The web app compiles it through `transpilePackages`, which also bundles it into the server chunks. That matters on Amplify, whose SSR packaging misses symlinked packages: the build output never `require`s it. Metro reads the same `exports` later.
  - Inside core, imports are relative. Its ESLint config (typescript-eslint, no Next rules) blocks React, Next, Dexie, Expo and `@/` imports. Its tsconfig has no DOM types, so code that only works in browsers fails the typecheck.
  - The test record builders (`src/test/records.ts`) moved too, because a domain test uses them; web tests import them from `@qct/core/test/records`. Core's i18n tests use `createTranslator` from `use-intl/core` (the library inside next-intl, and the one the app will use). `formats.ts` declares its own `Formats` shape instead of importing next-intl's. `request.ts` loads the messages through a fixed map, since a template-string import can't cross into a package.
  - Same totals as before: 487 tests in 67 files (core 202 in 18, web 285 in 49). `next build` and the E2E suite pass.
- 2026-10-24 (native spike, before 2.4): the user asked for a short throwaway Expo app before designing the storage interface. It ran outside the repo on the `qct_phone` emulator, with a Better Auth server configured like `apps/web`, and compared Hermes with Node on 50 cases. It found:
  - Expo SDK 58 (React Native 0.88, React 19.3, TypeScript 6 in its template) is current, so 2.5 pins it instead of 56. `@qct/core` loads in Metro as TypeScript source through its `exports`.
  - The Hermes gaps of §2.13: 22 of 50 cases broke without the polyfills, and 49 matched Node with them. The last one is cosmetic: `resolvedOptions().locale` drops `ca-gregory`, but formatting is identical.
  - The expo-sqlite rules of §2.13 (isolation, locking, the change listener, bulk speed). Reads are fast: 125 indexed rows parsed from JSON in 7 ms, the whole 5,000-row table in 80 ms. These shaped §2.14's design: an explicit transaction handle, notifications from `LocalStore`, and a batched `bulkPut`.
  - `node:sqlite` runs the same SQL, but needs no flag only from Node 22.13 (see 2.7).
  - Better Auth's Expo plugin works with the web config:
    - username sign-in and the `expo-origin` header (server `expo()` plugin plus the scheme in `trustedOrigins`);
    - the stored cookie on our own routes, and a renewed cookie readable from `set-cookie` and merged with `getSetCookie`;
    - sign-out clears it, and Android's own cookie jar sends nothing.

    The `:` key problem the plan expected is fixed upstream. Renewed cookies should be saved through the plugin's storage helper, not written straight to SecureStore: one session check went out without its cookie after a direct write.
  - The first local Android build took 12 minutes and installed NDK 27.1 by itself. Windows long paths are off on the development machine, so the spike lived in a short folder (see the prerequisites).
- 2026-10-24 (with the user): the app split was re-confirmed: two separate apps (the web PWA and a native Expo app with native controls) in one repo, sharing `packages/core` including the data layer; phones and tablets; the PWA stays complete (#43–48 unchanged).
- 2026-10-24 (2.4):
  - **Dexie's implicit transaction zone doesn't survive deeply nested native async calls.** The first Dexie run of the shared suites failed with `PrematureCommitError`. After two levels of nested `async` functions, a call like `db.table(x).put()` lost the zone and opened a second transaction, which waited for the first while the first committed. The old code never hit this, because each `LocalStore` write opened its own nested Dexie transaction. The adapter now binds every operation inside a transaction to Dexie's transaction object (`trans.table(name)`) and returns Dexie's own promises. That's the explicit handle of §2.14, all the way down. Inside a transaction, only storage work may be awaited.
  - **Core tests can't use Dexie**, so core has an in-memory adapter: the reference implementation, and a fake for app tests. It copies records in and out, keeps a transaction's writes private until commit, and runs transactions one at a time like SQLite will. An action that wrongly opened a second transaction through `store` instead of `tx` would deadlock there, not pass quietly.
  - **The moved tests are suites that take an adapter factory** (`packages/core/src/data/testing`): the storage contract, `LocalStore` and the outbox, every entity's actions, apply-pull, discard and the sync engine. `dataLayerSuites` runs them all on the memory adapter in core and on Dexie in the web; 2.7 adds SQLite. Pure tests (search, backoff, indicator) are plain core tests. A web test checks the Dexie schema against `TABLE_SCHEMA`.
  - **Behaviour changes, all internal:**
    - `setAttendance`, `setExcuseNote` and `clearAttendance` now read and write in one transaction (they used to read outside one).
    - apply-pull reads and writes each table in bulk.
    - `acknowledge` and `markFailed` use bulk operations.
    - `LocalStore.subscribe` listeners receive the tables a write changed.
    - The sync engine takes `lock`, `isOnline` and `apiBaseUrl` options. The web passes Web Locks and `navigator.onLine` (`src/client/sync/browser.ts`); without them the engine assumes online and runs unlocked.
    - The web's `client/data` modules keep their hooks and re-export core's actions. The action-only `lessons`, `attendance` and `homework` modules were removed, and their importers point at core.
  - **The contract doesn't use an adapter after `destroy`:** Dexie 4 refuses to reopen a deleted database. Each adapter's own test checks that the data is gone.
  - Tests: core 317 in 22 files (the shared suites on memory, plus the existing core tests), web 286 in 36 files (the shared suites on Dexie, plus the web's own). `next build` compiles; E2E 14 passed, 1 skipped (the offline spec on iPhone WebKit, as always).

- 2026-10-24 (2.5):
  - **Decisions taken with the user:**
    - The EAS project is owned by the `imenu` account: `@imenu/quran-classes-tracker`, slug `quran-classes-tracker`, URL scheme `ai.imenu.quran`.
    - React moved to 19.3.0 across the workspace, the version Expo SDK 58 needs; the web's unit, integration and E2E tests and `next build` pass on it. With pnpm's hoisted layout, two React versions would have risked a duplicate React in the app.
  - **Setup:**
    - EAS profiles: `development` (dev client, internal), `preview` (internal) and `production` (auto-increment), each on its own update channel. Build numbers are kept by EAS (`appVersionSource: remote`), and `runtimeVersion` follows the app version.
    - Metro finds `@qct/core` through Expo's own monorepo support, with no `metro.config.js`.
    - TypeScript stays 5.9.3, the one workspace version; the app type-checks on it. `expo install` checks skip TypeScript, so `expo-doctor` passes 20/20.
  - **Fonts are loaded at start with `useFonts`**, not embedded at build time. Embedded fonts get different family names on iOS and Android; loaded ones have one name on both. The splash screen stays up until they're ready, which takes a moment because they're bundled.
  - **Polyfills:** `index.ts` loads them before Expo Router. The Jest test deletes `Intl.PluralRules`, `Intl.Locale`, `Intl.RelativeTimeFormat` and `Intl.supportedValuesOf` first, so it exercises FormatJS's data as on Hermes. The polyfills check `name in Intl`, so setting a property to `undefined` isn't enough. In core, `getDirection` and `toAppLocale` now use `languageOf()`, a hand parser, instead of `Intl.Locale`.
  - **Checked on the `qct_phone` emulator, light and dark:**
    - RTL from the start (even Expo's error overlay); IBM Plex Sans Arabic.
    - The four native tabs, with labels always shown (Android hides them by default; the web always shows them).
    - Through the development-only Intl check in Settings: Arabic's six plural forms, dates, weekday, percentage and `uuid` on Hermes.
  - **Native tabs:** Material-symbol icons on Android need `expo-symbols`.
  - **Windows toolchain findings:**
    - `LongPathsEnabled` wasn't enough: the Android SDK's CMake 3.22.1 ships ninja 1.10.2, which still fails on paths over 260 characters (Reanimated's and Gesture Handler's generated C++). With the user's agreement, its `ninja.exe` was replaced by the official 1.12.1, keeping the old one beside it. An SDK update could bring it back (README, Mobile app).
    - A `node_modules` built up by several incremental `pnpm add` runs with the hoisted linker once broke the Expo CLI: an old `chalk` resolved the wrong `ansi-styles`. A clean `pnpm install --frozen-lockfile` laid it out correctly, and every check ran again on a clean install.
    - Expo's lint config brings `eslint-plugin-react-hooks` 7, which got hoisted over the web's 5.2 and turned on React Compiler rules in the web's lint. The web now declares `eslint-plugin-react-hooks@^5.2.0` itself.
    - Metro's watcher on Windows sometimes misses edits; restart it with `--clear`.
  - **Expo Router bundles every file under `src/app/`** as a route, so a test there broke the app bundle. Tests live outside it.
  - The template's `AGENTS.md`, `LICENSE` and a `.claude/settings.json` (which turned on an Expo Claude plugin) were left out. Their useful advice (check the docs for the installed SDK, use `expo install`) is in the `rtl-i18n-ui` skill.
  - **The iPhone check is the user's:** `eas build --profile development --platform ios` from `apps/mobile`. The first run asks for the Apple Developer sign-in, which can't run here.
  - **Amplify rehearsal on a clean export of the commit:** the build spec's `pnpm install --frozen-lockfile --filter "@qct/web..."` and `pnpm --filter @qct/web build` work. With the hoisted linker, though, the filter doesn't narrow the install: it installs the whole workspace, React Native and Expo included (889 top-level packages either way). That costs install time and cache space, not correctness, since the SSR output traces only what the web uses. Worth revisiting if Amplify build times matter.
  - Tests: core 318 in 22 files, web 286 in 36, mobile 5 in 2 (Jest). Lint and typecheck cover all three packages. Web `next build` compiles and E2E passes on React 19.3.
- 2026-10-24 (2.5, the first iPhone build):
  - **The first EAS iOS build failed:** "Could not find target 'thfyzalqraan' in project.pbxproj". With the Arabic `expo.name`, EAS's build worker computed a transliterated target name that prebuild hadn't created.
  - **The fix:** `expo.name` is now the English name, "Quran Memorization" (Xcode target `QuranMemorization`). A small config plugin (`apps/mobile/plugins/with-display-name.js`) sets the name under the icon to "تحفيظ القرآن": `CFBundleDisplayName` on iOS, `app_name` on Android (#46 unchanged). A clean Android prebuild and build ran on the emulator with the new names.
  - **EAS's first iOS build set up EAS Update:** it added `expo-updates` and `updates.url`, since the profiles use channels. The encryption answer is stored as `ITSAppUsesNonExemptEncryption: false`: HTTPS, the Keychain and system random numbers only, which are exempt.
- 2026-10-24 (2.5, on the user's iPhone): the development build ran on the iPhone, but the large header title sat on the left. `forcesRTL` sets React Native's direction; UIKit's native views (the navigation bar and its large title) follow the app's iOS localization, which defaulted to English. The app now declares Arabic as its only localization (`supportedLocales: ["ar"]`, `CFBundleDevelopmentRegion: "ar"`). This needs a new iOS build.
