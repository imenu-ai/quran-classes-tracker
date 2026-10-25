# تحفيظ القرآن (quran-classes-tracker)

An offline-first PWA for Quran memorization centers. Teachers record attendance, evaluate each student's recitation, assign the next homework and review monthly progress. Everything works without a connection and syncs when one is back.

- **Arabic-first and RTL.** The UI has no hard-coded direction, and English (LTR) is built in but hidden.
- **iPhone-first.** Also works on Android, iPad, Android tablets and laptops.
- **Centers and roles.** A center admin registers the center and creates its users, choosing each teacher's classes and permissions. Every record belongs to one center, and the server enforces access on every request.

The product brief is in [BRIEF.md](BRIEF.md). The full design (decisions, sync protocol, data model and phases) is in [PLAN.md](PLAN.md).

## Stack

| Area        | Choice                                                                                |
| ----------- | ------------------------------------------------------------------------------------- |
| App         | Next.js 15 (App Router), React 19, TypeScript (strict)                                |
| UI          | Tailwind CSS v4, shadcn/ui (Radix, `rtl: true`), next-themes                          |
| i18n        | next-intl without i18n routing: the locale comes from the user's account via a cookie |
| Local data  | Dexie (IndexedDB), one database per user                                              |
| Server data | MongoDB (local in development, Atlas in production)                                   |
| Auth        | Better Auth (username + password, argon2id, 400-day sessions)                         |
| Offline     | Serwist service worker                                                                |
| Tests       | Vitest (unit, jsdom, mongodb-memory-server), Playwright (E2E)                         |

Node 22.13 or later (see `.nvmrc`; the SQLite tests use `node:sqlite`) and pnpm 10 (pinned in `package.json`; run `corepack enable` once).

**Repo layout.** A pnpm workspace (PLAN.md, Phase 2):

- `apps/web`: the web app (package `@qct/web`).
- `packages/core`: React-free code shared with the coming mobile app (package `@qct/core`, imported as `@qct/core/…`): domain rules, schemas and the sync protocol, the local data layer and sync engine (each app plugs in its own storage), i18n config and the messages. It's TypeScript source, compiled by the app that imports it.
- `apps/mobile`: the React Native app for iOS and Android (package `@qct/mobile`, Expo). See [Mobile app](#mobile-app); it's being built in Phase 2.

Run every command below from the repo root: `lint`, `typecheck` and `test` run in every package, and the other scripts pass on to the web app. `.npmrc` sets `node-linker=hoisted`, which Amplify needs for a pnpm monorepo.

## Local setup

1. **Install a local MongoDB** (Community Server) and start it. The default URI is `mongodb://localhost:27017`. No Docker needed.
2. **Install dependencies:**
   ```sh
   corepack enable
   pnpm install
   ```
3. **Create `apps/web/.env.local`** from the example and set a real secret:
   ```sh
   cp apps/web/.env.example apps/web/.env.local
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
5. **Create a center and its admin.** The CLI prints the 6-digit center code used at sign-in.
   ```sh
   pnpm center:create --center "مركز التحفيظ" --name "المدير" --email admin@example.com --username admin
   # optional: --password <p> (otherwise a hidden prompt), --timezone Asia/Hebron, --locale ar
   ```
6. **Optional sample data** (classes, students and a few months of lessons):
   ```sh
   pnpm dev:seed --center <center code>
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
| `pnpm test` / `pnpm test:watch`     | Unit and integration tests (Vitest; Jest in the mobile app)              |
| `pnpm test:e2e`                     | Playwright end-to-end tests (see below)                                  |
| `pnpm mobile:e2e`                   | Maestro flows for the mobile app on the Android emulator (see below)     |
| `pnpm format` / `pnpm format:check` | Prettier                                                                 |
| `pnpm db:indexes`                   | Create or update MongoDB indexes                                         |
| `pnpm center:create`                | Create a center and its admin (prints the center code)                   |
| `pnpm dev:seed`                     | Fill a teacher's tenant with sample data                                 |

The CLI scripts read `apps/web/.env.local` then `apps/web/.env`; variables already set in the shell win. To run one against Atlas, set `MONGODB_URI` in the shell.

## Centers, users and sign-in

- **Registering a center.** A center admin registers at `/register` (center name, time zone, his name, email, username, password). He gets a 6-digit **center code** to share with his teachers. It's also shown in Settings → Center.
- **Signing in.** Everyone, admins included, types the **center code + username + password**. The code is remembered on the device. Usernames only need to be unique inside a center.
- **Users.** The admin adds users in **Users** (admins only), and chooses for each teacher:
  - his **classes**: he only sees and syncs these;
  - his **permissions**: create and manage classes; add, edit and move students; run lessons (attendance, evaluation, homework); see students' monthly reports.

  The admin can also make another user an admin, set a new password, or disable an account. A center always keeps at least one active admin.

- **First sign-in.** A teacher must replace the password the admin chose before using the app.
- **Own details.** Everyone edits their name, username, phone and password in Settings.
- **Forgotten passwords.**
  - An admin resets his own by email (`/forgot-password`, sent through Amazon SES).
  - A teacher asks his admin, who sets a new one.
- **Deleting.** Both ask for the password again (5 tries per 15 minutes), in the app and on the web, and need a connection.
  - **One's own account:** Settings → Account → "حذف الحساب". The user's sign-in and details (name, username, phone, email) are deleted and every device of theirs is signed out; the center's classes, students and records stay. The center's last active admin can't: they make another user an admin first, or delete the center.
  - **The center** (admins): Settings → Center → "حذف المركز". Every user is signed out, then every user, class, student, lesson, attendance and homework record and the center itself are deleted. Parent links stop working. Print the students' sheets first to keep them.
- **How access is enforced.** The device hides what a user can't do. The server checks every sync: a teacher's writes need the matching permission and one of his classes, and pulls only return his classes. When an admin changes someone's classes or permissions, that user's devices rebuild their local copy at the next sync.

## Daily use

- **Opening a class** lists its students.
- **A student's page** shows his month as a simple table: one row per day with the portion and the memorization and behavior marks, "مؤجل" or "غائب", and the month's averages. It starts closed, showing just the month, its averages and the days attended; tap it to open the table. Earlier months are one tap away, and tapping a row corrects it (for users who can run lessons).
- **Under the table, "اليوم" (today):**
  - attendance (present, absent, excused with a note);
  - each due homework item as a collapsible section (sura and ayat; tap to open), with two mark pickers (1–10, the phone's own wheel on iPhone);
  - "تأجيل التسميع" (postpone the recitation) when he isn't ready: the homework stays for the next day and his averages aren't affected;
  - "تسميع الآن" when nothing is due;
  - "إضافة اختبار" (add an exam): any portion, added and marked on the spot with one mark (1–10). Exams show in violet with an "اختبار" badge, in today's list and in the month table. They're left out of every average (the student's and the class statistics) and don't move the next-homework suggestion;
  - "إضافة واجب لليوم التالي", pre-filled with the next portion.
- **Class statistics** ("الإحصائيات" next to "إضافة طالب"):
  - the class's attendance rate (present, absent, excused) and average marks;
  - its students ranked by attendance rate, then memorization average, then behavior average. An excused absence counts as attended here, and a student's rate counts the lesson days since he joined.
  - All time by default; pick a year, or a year and a month, to narrow it.
- **Printing** (needs "view reports"): a student's month prints on one A4 sheet. It shows the center, class, student and the user who printed it; the month's table (oldest day first) with its averages; and counts of days present, absent and excused, homework recited, exams and postponements.
  - From the student page: open the month table, then "طباعة الشهر" (the month shown).
  - From the class statistics: "طباعة كشوف الطلاب", then pick the month (the one shown there, else the current month) and the students ("تحديد الكل" selects or clears them all). It makes one document with a page per student.
  - The print page shows the sheets; "طباعة / حفظ PDF" opens the device's print dialog, which prints them or saves a PDF ("Save as PDF", or Share → Save to Files on iPhone). It works offline.
- **The parent link.** Each student has a link for his parent, who opens it with his **ID number** (رقم الهوية); no account needed.
  - Set the parent's ID number in the student's "تعديل البيانات" (users who can manage students). Digits only, 5–20; Arabic digits are fine. Siblings can share the same number.
  - Hand the link out from the student menu, "رابط ولي الأمر" (copy, share or its QR code), or print the month: every printed sheet carries the link as a QR code.
  - The parent sees what the printed sheet shows, for the current month or any other: homework and exams with their marks, absences and postponements, the averages and counts.
  - The phone is remembered for 30 days; "خروج من هذا الجهاز" forgets it. Without a parent ID, the link says it isn't valid. The page needs a connection (it reads from the server).
- **Lessons** still exist in the data (one per class per day), but the teacher never manages them: today's is created the first time something is recorded.

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
- **Pushes go parents first** (classes, students, lessons, attendance, homework), so a change never reaches the server before a record it refers to.
- **Routes use query parameters** (`/class?id=…`, `/student?id=…`), so one cached page shell serves every class and student offline. Pages hold no data; only the API checks the session.
- **Code layout:**
  - `packages/core/src/domain`: pure logic (sura map and validation, homework suggestion, monthly stats, dates).
  - `packages/core/src/shared`: schemas and the sync protocol, used by client and server.
  - `packages/core/src/data`: the device's data layer over a storage interface: `LocalStore` and the outbox, the sync engine, and the actions and queries per entity, with tests that run on every storage adapter.
  - `packages/core/src/i18n` and `packages/core/messages`: locales, direction, formats, error codes to text, and the message files.
  - `apps/web/src/server`: Mongo, auth, sync services. The other web folders below are under `apps/web` too.
  - `src/client`: the Dexie storage adapter, live-query hooks, sync triggers, session and PWA helpers.
  - `src/components`, `src/app`: UI and routes.

## i18n and direction rules

- All text lives in `packages/core/messages/ar.json` (and `en.json`). Domain and server code return error **codes**, never text.
- Use **logical** Tailwind classes only (`ms-`, `pe-`, `start-`, `text-start`, …). `pnpm lint` fails on physical ones (`ml-`, `right-`, `text-left`, …) and on literal `dir="rtl"` / `dir="ltr"`.
- Icons that point a direction (back, next) go through `DirectionalIcon`, which mirrors them in RTL.
- Numbers use Latin digits and dates the Gregorian calendar, via the locale tag `ar-u-ca-gregory-nu-latn`. Inputs accept Arabic-Indic digits too.
- To enable English for testing: add `en` to `ENABLED_LOCALES` and set the user's `locale` to `en` (the locale is copied into a cookie at sign-in).

## Tests

```sh
pnpm test        # unit + integration (mongodb-memory-server downloads a MongoDB binary the first time)
pnpm test:e2e    # end-to-end
```

`pnpm test:e2e` starts its own environment (`apps/web/e2e/server.mts`). Your local database and dev server are not touched.

1. An in-memory MongoDB with fresh test accounts.
2. A production build in `.next-e2e`.
3. That build served on port 3100 (set `E2E_PORT` if that port is taken).

To reuse the last build: `SKIP_E2E_BUILD=1 pnpm test:e2e`.

| Spec        | Covers                                                                                                                                                                                                                     | Projects                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `main-flow` | class → students → student page: recite and mark, next-day homework, absence; next day: postpone, undo, mark                                                                                                               | iPhone 15 (WebKit), Pixel 7, Desktop Chrome                              |
| `offline`   | offline: mark one student and mark another absent, reload, reconnect; a second fresh login sees both                                                                                                                       | Chromium only (Playwright can't drive service workers offline in WebKit) |
| `roles`     | an admin registers, creates classes and a teacher with limited access; the teacher's forced password change, restricted view, reassignment and disabling                                                                   | all three                                                                |
| `parent`    | the teacher sets a parent ID and marks the student; a signed-out phone opens the parent link with the ID, sees the month and is remembered; a student without a parent ID has an invalid link; the printed sheet's QR code | all three                                                                |
| `ltr-smoke` | every main screen in English: `dir="ltr"` and no horizontal overflow at 360 px                                                                                                                                             | all three                                                                |

The first time, install the browsers with `pnpm --filter @qct/web exec playwright install`. Playwright's WebKit on Windows is close to iOS Safari but not identical, so check on a real iPhone before a release (next section).

## Testing on an iPhone

Service workers, installing to the home screen and offline mode all need **HTTPS**. `http://<your-PC-IP>:3000` will load, but none of the offline features will work. Two options:

- **An Amplify branch deployment** (closest to production).
- **A tunnel to a local production build.** For example, with Cloudflare's `cloudflared`:
  1. In one terminal: `cloudflared tunnel --url http://localhost:3000`. It prints a `https://….trycloudflare.com` URL.
  2. Set `BETTER_AUTH_URL` in `apps/web/.env.local` to that URL. Otherwise sign-in is rejected as coming from an unknown origin.
  3. In another terminal: `pnpm build && pnpm start` (stop `pnpm dev` first; both use port 3000).

  A quick tunnel gets a new URL each time, so repeat step 2 after restarting it.

On the iPhone:

1. Open the URL in **Safari**, then Share → **Add to Home Screen**. The home page shows these steps too.
2. Open the app **from the home-screen icon** and sign in there. An installed web app on iOS has its own storage, separate from Safari: signing in inside Safari doesn't carry over.
3. Browse once online: home, a class, a student, search and settings. The app also pre-caches every page in the background after sign-in.

**Manual offline check** (airplane mode):

- [ ] Turn on airplane mode and fully close the app (swipe it away).
- [ ] Reopen it from the home screen. The classes appear and the indicator shows "غير متصل".
- [ ] Open a class and a student: mark him (recite now or his due homework), postpone another student's recitation, mark one absent, and add next-day homework.
- [ ] Open a student profile: the new scores are in the month summary.
- [ ] Close and reopen the app, still offline: everything is still there, and the pending count shows.
- [ ] Turn airplane mode off and return to the app. The indicator goes "جارٍ المزامنة" → "متصل".
- [ ] On another device (or a laptop), sign in: the marks, postponement and absence are in the students' tables.

**Manual print check** (from the home-screen app):

- [ ] On a student's page, open the month table and tap "طباعة الشهر", then "طباعة / حفظ PDF": the iOS print sheet opens with one A4 page.
- [ ] Share → Save to Files gives a PDF: Arabic joined and right to left, the center, class, student and your name at the top.
- [ ] From the class statistics, print all students: one page each.
- [ ] Try it offline too (airplane mode).

## Mobile app

`apps/mobile` is an Expo app (SDK 58, React Native 0.88) with native navigation and controls, in Arabic and right to left from the start. It's being built in Phase 2 (PLAN.md): so far the teacher's day, class statistics, settings and user management, printing and the parent link, and tablet layouts. EAS project: `@imenu/quran-classes-tracker`; bundle id and Android package `ai.imenu.quran`.

**Setup (Windows, Android).**

- Android Studio with an emulator (the plan's checks use a Small Phone profile, 360 dp wide), JDK 17 (`JAVA_HOME`), `ANDROID_HOME` set.
- Windows long paths turned on (`LongPathsEnabled`). The React Native build's paths go past 260 characters.
- ninja 1.12 or later in the SDK's CMake: the ninja 1.10.2 bundled with CMake 3.22.1 fails on long paths anyway ("Filename longer than 260 characters"). Replace `%LOCALAPPDATA%\Android\Sdk\cmake\3.22.1\bin\ninja.exe` with the official `ninja-win.zip` from the ninja-build GitHub releases (keep the old file). An SDK update can bring the old one back.
- `pnpm install` from the root, as for the web app.

**Run it on the emulator:**

```sh
pnpm mobile:android   # builds and installs the development app, then starts Metro
pnpm mobile           # later: just Metro, for the installed development app
```

The first build takes 10–20 minutes (Gradle and the Android NDK download once); later ones take about a minute. The app's own code reloads without a rebuild; a new native library or a change to `app.json` needs a new build. (Step 2.8 added `@expo/ui`, step 2.12 `expo-print`, `expo-sharing` and `react-native-svg`, and step 2.13 `expo-screen-orientation`, so builds from before them lack those parts.)

**On an iPhone** (no Mac needed; EAS builds in the cloud):

1. Once: register the iPhone with `npx eas-cli device:create` (from `apps/mobile`) and open the link on the phone.
2. Build: `npx eas-cli build --profile development --platform ios` (from `apps/mobile`). The first time, it asks for the Apple Developer sign-in to create the certificate and profile.
3. Install from the link EAS shows, start Metro with `pnpm mobile`, and open the app (same Wi-Fi, or `pnpm mobile -- --tunnel`).

Development builds show two checks in Settings: the local classes with a button that adds one (to see writes sync to the server and the web), and an Intl check (Arabic plurals, dates, direction).

**The server it talks to.** The app uses the web app's `/api` routes (sign-in, `/api/me` and sync), at `EXPO_PUBLIC_API_URL`:

- Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and set it, then restart Metro (the value is built into the bundle).
- Emulator against a web server on this PC: `http://localhost:<port>` after `adb reverse tcp:<port> tcp:<port>`.
- iPhone on the same Wi-Fi: `http://<this PC's LAN IP>:<port>`.
- Against production, the server must already have the mobile sign-in support (Better Auth's Expo plugin, merged in step 2.6).

Sign-in, registration, "forgot password" (it opens the web page) and the forced password change need that server. A signed-in user's saved session opens the app without it: their data lives on the phone (`qct-<userId>.db`), and changes made offline sync once the server is reachable.

**Tests and checks:** `pnpm lint`, `pnpm typecheck` and `pnpm test` cover the app too (ESLint with the logical-style rule, Jest with `jest-expo`). `npx expo-doctor` (from `apps/mobile`) checks dependency versions.

`src/ltr.test.tsx` renders the main screens in English (the hidden version) and fails on any Arabic left on them.

**End-to-end flows (Maestro, Android).** `pnpm mobile:e2e` runs the flows in `apps/mobile/maestro/` on the emulator, against their own server:

1. Once: install [Maestro](https://maestro.dev) (it goes to `~/.maestro`; set `MAESTRO` if it's elsewhere) and the development build (`pnpm mobile:android`).
2. Start one emulator, e.g. `qct_phone`. Stop `pnpm mobile` if it's running on port 8082.
3. `pnpm mobile:e2e` starts the web app's E2E server (as `pnpm test:e2e` does: a fresh in-memory MongoDB, a build in `.next-e2e`, port 3100 or `E2E_PORT`), then Metro on port 8082 (or `METRO_PORT`) pointed at it, reverses both ports into the emulator, and runs every flow. `SKIP_E2E_BUILD=1` reuses the last web build. One flow: `pnpm mobile:e2e maestro/offline.yaml`.

| Flow        | Covers                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main-flow` | sign in, create a class and a student, mark him present, recite now with a mark, the month table, everything synced                                            |
| `offline`   | airplane mode: create a class, the indicator shows it waiting; back online it syncs; after signing out (which wipes the device) and in again, it's still there |
| `roles`     | the admin creates a class, a student and a teacher for it; the teacher's forced password change, only that class, no admin controls, taking attendance         |
| `deletion`  | the only admin can't delete their own account; a wrong password, then the center deleted; signed out, and the account no longer signs in                       |

Each flow starts from a cleared app. Flows find fields by their `testID` (`sign-in.code`, `class.name`, `ayah.from`, …); Maestro types ASCII only on Android, so the test data is in Latin letters. If adb stops answering, the runner restarts its server; if every flow fails at the sign-in screen with the emulator's home screen showing, Android killed the app as it started (an emulator that has run for hours): `adb reboot`, then run again.

**Checks on an iPhone and an iPad** (a development build with the current native modules, see above; Maestro doesn't run iOS from Windows):

- [ ] Right to left: the header title, back arrow and tabs on the right; titles readable (not mirrored); Arabic text joined.
- [ ] Offline: airplane mode, mark a student, add a class; the indicator shows "غير متصل" and the pending count. Close the app fully and reopen: everything is there. Airplane mode off: "متصل", and the web shows the changes.
- [ ] Print: a student's month ("طباعة الشهر") opens the iOS print sheet with one A4 page; "مشاركة PDF" shares a PDF named after the student and month, with the Arabic font embedded. From the class statistics, print all students: one page each. Also offline.
- [ ] Share: the parent link ("رابط ولي الأمر") copies, opens the share sheet, and shows a QR code that a phone camera opens.
- [ ] iPad: the classes in columns (three in landscape), the class page in two; it rotates freely, and forms and sheets stay narrow and centred. The iPhone stays in portrait.
- [ ] The score wheel and form sheets behave natively; the keyboard doesn't cover the field being typed in.

### Releasing the app

The listing texts, App Review notes, privacy answers and the screenshot list are in `apps/mobile/store/app-store.md`. The release builds talk to `https://quran.imenu.ai` (`EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json`), and the store listing links to its `/privacy` and `/support` pages, so the web app must be deployed first.

**iOS** (from `apps/mobile`; asks for the Apple ID sign-in and its two-factor code):

```sh
npx eas-cli build --profile production --platform ios   # the build number goes up by itself
npx eas-cli submit --profile production --platform ios --latest   # to App Store Connect / TestFlight
```

Then, in App Store Connect: test in TestFlight, fill in the listing from `store/app-store.md`, add the screenshots and the demo accounts' passwords, and submit for review.

**JavaScript-only fixes** to a released version go out without a new build: `npx eas-cli update --channel production --message "…"`. A new native module or an `app.json` change needs a new build and a new version (`version` in `app.json`; the runtime version follows it).

**Android without Google Play:** `npx eas-cli build --profile android-apk --platform android` makes an APK and prints a link to its download page. People open it on their phone and allow installing from that source when Android asks; Play Protect may warn about an unknown developer. JavaScript fixes reach it through EAS Update like the iOS app; native changes need a new APK. EAS keeps the signing key, and the same key will sign the Play Store version later, so installed copies can update to it.

**The demo center for App Review** (production, code `689723`, `demo_admin` and `demo_teacher`). If a reviewer deletes it, recreate it from the repo root with the production `apps/web/.env`: `pnpm center:create --center "مركز النور التجريبي" --name "المدير التجريبي" --email mhmdtshref+qct-demo@gmail.com --username demo_admin`, then `pnpm dev:seed --center <new code>`, add `demo_teacher` (one class, "run lessons" and "see reports") in Users, and update the code in App Store Connect.

## Deployment

Production runs on **AWS Amplify Hosting** (Next.js SSR, region `eu-central-1`) with **MongoDB Atlas**. Amplify supports SSR up to Next.js 15, which is why Next is pinned to 15.

| Piece                                                               | Where                                                                                                                                           |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Amplify app, its `main` branch and service role, and the build spec | CloudFormation stack [infra/amplify-stack.yml](infra/amplify-stack.yml)                                                                         |
| Deploying that stack                                                | [.github/workflows/deploy-stack.yml](.github/workflows/deploy-stack.yml): only on a push to `main` that changes the stack file, or a manual run |
| The role GitHub Actions deploys with (OIDC)                         | One-time bootstrap stack [infra/github-deploy-role.yml](infra/github-deploy-role.yml), deployed by hand                                         |
| The app's environment variables                                     | One Secrets Manager secret (JSON), created by hand. The app only knows its ARN (`APP_SECRET_ARN`)                                               |
| Building and releasing the app                                      | Amplify, automatically, on every merge to `main`                                                                                                |
| CI (lint, type-check)                                               | [.github/workflows/ci.yml](.github/workflows/ci.yml), on pull requests to `main`                                                                |

Development happens on `dev`, and `dev` is merged into `main` through pull requests.

**How the build gets its environment.** Amplify doesn't pass environment variables to the SSR runtime. So the build reads the secret with the service role, writes every key into `apps/web/.env`, then builds the web app. It runs from the workspace root (`buildPath: /`, `appRoot: apps/web`) and installs only the web app's packages (`--filter "@qct/web..."`). Two consequences:

- After changing the secret, **redeploy** the app (Amplify console → the `main` branch → Redeploy this version) for it to take effect.
- Values must not contain `#`, which `.env` files treat as the start of a comment. URL-encode it as `%23` in the Mongo password; `openssl rand -base64 32` never produces one.

To change the build, edit `BuildSpec` in `infra/amplify-stack.yml` and merge it to `main`. Don't add an `amplify.yml` to the repo: it would take precedence over the stack's build spec.

### First deployment

Production was set up with these steps during Phase 1. Follow them in order to set it up again, for example in a new AWS account.

**1. MongoDB Atlas**

- [ ] Create a cluster (ideally in or near `eu-central-1`) and a database user with read/write on the app database only.
- [ ] Network access: Amplify's compute has no fixed outbound IP, so allow `0.0.0.0/0` and rely on a strong, generated database password.
- [ ] **If the database has data from before centers and roles (Phase 1, part 1.8), drop it.** Older users and records can't sign in or sync. The app had no real data then.
- [ ] From your machine, with `MONGODB_URI` (and `MONGODB_DB`) set to the Atlas values in the shell: `pnpm db:indexes`.
- [ ] The first center registers itself at `/register` once the app is live (step 6). `pnpm center:create` does the same from the command line.

**2. The app secret.** In Secrets Manager (`eu-central-1`), create a secret of type "Other", in plaintext JSON:

```json
{
  "MONGODB_URI": "mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority",
  "MONGODB_DB": "quran_tracker",
  "BETTER_AUTH_SECRET": "<new value from: openssl rand -base64 32>",
  "BETTER_AUTH_URL": "https://example.invalid",
  "ENABLED_LOCALES": "ar",
  "EMAIL_FROM": "تحفيظ القرآن <no-reply@your-domain.com>"
}
```

- `BETTER_AUTH_URL` is a placeholder until the app's URL exists (step 6).
- `EMAIL_FROM` is the sender of password reset emails. Its address must be verified in SES (next step). Without `EMAIL_FROM`, reset links are only logged, never sent.

Copy the secret's **full ARN**.

**2b. Amazon SES (password reset emails).** Center admins reset a forgotten password by email; teachers ask their admin.

- [ ] In SES (`eu-central-1`) → Identities → Create identity. Prefer a **domain** (add the DKIM DNS records it shows); a single email address also works for testing.
- [ ] Request **production access** (SES → Account dashboard). Until AWS approves it (usually about a day), SES is in sandbox mode and only sends to verified addresses.
- [ ] The stack gives the running app a compute role that may send through any SES identity in this account and region. Nothing else to configure.

**3. The deploy role (once).** With admin credentials for the AWS account:

```sh
aws cloudformation deploy --region eu-central-1 \
  --stack-name quran-classes-tracker-github-deploy \
  --template-file infra/github-deploy-role.yml \
  --capabilities CAPABILITY_IAM
# Add --parameter-overrides CreateOidcProvider=false if the account already
# has the token.actions.githubusercontent.com identity provider.
aws cloudformation describe-stacks --region eu-central-1 \
  --stack-name quran-classes-tracker-github-deploy --query "Stacks[0].Outputs"
```

**4. GitHub.**

- [ ] Install the Amplify GitHub App for the `imenu-ai` organization, with access to this repository: <https://github.com/apps/aws-amplify-eu-central-1/installations/new>.
- [ ] Create a classic personal access token with the `admin:repo_hook` scope. Amplify uses it to connect the repository when the app is created, and doesn't store it.
- [ ] Create the environment `production` (Settings → Environments → New environment). Under "Deployment branches and tags", allow `main` only. The deploy role trusts only jobs in this environment running on `main`.
- [ ] Add three secrets to the `production` environment (or as repository secrets):
  - `AWS_DEPLOY_ROLE_ARN`: the `DeployRoleArn` output from step 3.
  - `AMPLIFY_GITHUB_TOKEN`: the token.
  - `APP_SECRET_ARN`: the secret's ARN from step 2.

**5. Merge `dev` into `main`.**

- [ ] The "Deploy stack" workflow creates the stack: service role, Amplify app and `main` branch.
- [ ] Amplify then builds `main` on each merge. If no build starts after the stack is created, start one from the Amplify console (`main` → Run build).

**6. The app's URL.**

- [ ] Copy the stack's `ProductionUrl` output (shown at the end of the workflow run), e.g. `https://main.d1234abcd.amplifyapp.com`.
- [ ] Put it into the secret's `BETTER_AUTH_URL` (no trailing slash), then redeploy in the Amplify console.

**7. Checks.**

- [ ] Sign in once. It exercises the parts most likely to differ on Amplify: the native argon2 password hashing (`@node-rs/argon2`) and the packages installed with pnpm's hoisted layout.
- [ ] Install the app on the iPhone from the production URL and run the manual offline check above.
- [ ] Check the sign-in rate limit's client IP (below).
- [ ] Optional: a custom domain. Put it into `BETTER_AUTH_URL` and redeploy.

**`AMPLIFY_MONOREPO_APP_ROOT`.** Amplify requires this app environment variable to equal the build spec's `appRoot` (`apps/web`). Both are set in `infra/amplify-stack.yml`; change them together.

**The parent link's protection.** The parent page (`/parent?s=<studentId>`, `POST /api/parent`) has no account. The parent's ID number is the secret:

- It's stored as entered (not hashed), by decision, so it can be compared and shown to whoever edits the student. It's synced to the devices of the student's teachers like his other fields.
- Wrong numbers are limited to 10 per IP per 15 minutes and 30 per student per day. Past either limit, even the right number is refused until the window ends. All parent requests are limited to 60 per IP per 15 minutes.
- An unknown, deleted or unset student all answer "not valid" alike.
- The right number sets an HttpOnly cookie for 30 days (an HMAC of the student and his parent ID with `BETTER_AUTH_SECRET`). Changing the parent ID ends every remembered phone.
- The page shows names, dates, portions and marks only: no ids, no teacher's notes. The IP comes from `x-forwarded-for`, so the CloudFront note below applies here too.

**Sign-in rate limit behind CloudFront.** Sign-in is limited to 5 attempts a minute per client IP, taken from `x-forwarded-for`. Behind Amplify that header may carry a chain of IPs (`client, proxy`). Better Auth then finds no IP, and every user shares one bucket. That fails safe, but one person mistyping could briefly lock everyone out. After the first deploy:

1. Log the request headers once and check what `x-forwarded-for` looks like.
2. Set `advanced.ipAddress` in `apps/web/src/server/auth/auth.ts` accordingly, e.g. `trustedProxies`, or a CloudFront client-IP header.
