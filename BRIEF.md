# Build: Quran Memorization Tracker (متابعة تحفيظ القرآن)

You are building a production-quality, **Arabic-first, RTL, mobile-first, offline-first** web app (PWA) for a Quran memorization teacher. It replaces the monthly paper form he keeps for each student. Arabic is the only language shown at launch, but the app must be **fully internationalized and direction-agnostic** so English (LTR) or other languages can be added later without refactoring. He will use it **on his phone during the lesson (الدرس), often with weak or no internet**.

**You are working inside an existing repository that I created.** Work like a senior engineer: explore the repo, ask me questions, write a plan and get my approval, then build **phase by phase, step by step**. Section 9 describes exactly how to work. Follow it strictly.

---

## 1. Users and context

- One teacher today. The app is free. Design it as **multi-tenant in a single database** so other teachers or centers can be added later without a rewrite.
- Each teacher has a **username and password** (no email). Accounts are created once by an admin script, and the teacher can change his username and password from settings.
- Default locale: **Arabic (`ar`), right-to-left**. See section 2 for language and direction rules.
- Time zone: `Asia/Hebron`. Lesson dates are local calendar dates (`YYYY-MM-DD`), not UTC timestamps.

## 2. Internationalization (i18n) and text direction

### Locales
- Use **next-intl** (or the current best-supported i18n library for the Next.js App Router; verify in the docs) from the first commit.
- **No hardcoded user-facing strings** in components, validation, or API responses. Every label, button, empty state, error, and toast comes from message files with English keys, for example `messages/ar.json` and `messages/en.json`.
- Launch with **`ar` as the default and only visible locale**. Also maintain `en.json` with English translations so the LTR path is real and tested, but don't show a language switcher yet. Control the visible locales with config (for example `ENABLED_LOCALES=ar`).
- Don't put the locale in the URL. Resolve it from the user's saved preference (a `locale` field on the user, defaulting to `ar`) and a cookie, so offline routes and cached pages stay simple. Confirm this approach with me in your questions.
- A unit test fails if `ar.json` and `en.json` don't have exactly the same keys.

### Direction (RTL now, LTR later)
- Derive `lang` and `dir` on `<html>` from the active locale (`ar` → `rtl`, `en` → `ltr`) through one helper, for example `getDirection(locale)`. Never hardcode `dir="rtl"` anywhere.
- Layout uses **logical properties only**: Tailwind `ms-/me-`, `ps-/pe-`, `start-/end-`, `text-start/text-end`, `border-s/border-e`, `rounded-s/rounded-e`. **Physical classes** (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`) **are not allowed**. Enforce this with a lint rule or a CI check.
- Directional icons (arrows, chevrons, "back", "next") flip with the direction, for example with `rtl:rotate-180` or a small directional icon component.
- Make sure shadcn/ui components (sheets, dropdowns, toasts, carousels) and the chart respect the current direction.
- User-entered text (student names, notes) uses `dir="auto"` so mixed Arabic and English content displays correctly in either direction.
- A Playwright smoke test renders the main screens in `en`/LTR to catch layout bugs early, even though English isn't visible to users yet.

### Formatting
- Format dates, weekday names, months, and numbers with `Intl` APIs (through next-intl's formatters) using the active locale. Never hardcode Arabic day or month names.
- For Arabic, use Western digits (0–9): `ar` with `numberingSystem: 'latn'`.
- Dates are shown in the Gregorian calendar.

## 3. Glossary (Arabic values for `ar.json`)

In code and message keys, use the English names (for example the `Session` entity). These are the Arabic values the `ar` messages must use.

| Concept (code name) | Arabic UI label |
|---|---|
| Class / circle (`Class`) | الحلقة |
| Student (`Student`) | الطالب |
| Session / lesson (`Session`) | الدرس |
| New session | درس جديد |
| Attendance (`Attendance`) | الحضور |
| Present / Absent / Excused | حاضر / غائب / غائب بعذر |
| Excuse note | سبب الغياب |
| Homework, assignment for the next lesson (`Homework`) | الواجب |
| Memorization rate (`memorizationRate`) | تقييم الحفظ |
| Behavior rate (`behaviorRate`) | تقييم السلوك |
| Sura | السورة |
| Ayah count | عدد الآيات |
| From ayah / To ayah | من آية / إلى آية |
| Day / Date | اليوم / التاريخ |
| Monthly memorization rate | معدل الحفظ الشهري |
| Monthly behavior rate | معدل السلوك الشهري |
| Attended days | أيام الحضور |
| Notes | ملاحظات |

## 4. Core domain rules

1. **Homework is the central record.** A homework item is a Quran portion (one sura, from ayah → to ayah) assigned to a student in one lesson and **evaluated in a later lesson**. When evaluated, it gets two scores:
   - `memorizationRate` (تقييم الحفظ): integer 1–10
   - `behaviorRate` (تقييم السلوك): integer 1–10
2. An evaluated homework item is one "row" in the student's history: **sura, from ayah, to ayah, تقييم الحفظ, تقييم السلوك, day, date** (day and date are those of the lesson where it was evaluated; the day name is derived from the date).
3. A student can have **zero, one, or several pending homework items**. In a lesson, the teacher can:
   - evaluate any pending homework,
   - **create homework for the next lesson**, and
   - if the student has no homework, **create an item and evaluate it immediately** in the current lesson.
4. **Attendance** is recorded per student per lesson: `present | absent | excused`, with an optional excuse note for `excused`. Attendance can be changed later (for example, a student who arrives late).
5. **Everything is editable at any time.** The teacher can open an old lesson and fill in or correct data whenever he wants. There are no locked months.
6. **Monthly statistics are always calculated, never stored:**
   - Monthly memorization rate = average of `memorizationRate` for all homework evaluated in that month.
   - Monthly behavior rate = average of `behaviorRate` for all homework evaluated in that month.
   - Attended days = count of `present` attendance records in that month. Also show absent and excused counts.
   - The month is determined by the **date of the lesson where the item was evaluated**. Show averages to one decimal place, or "—" when there is no data.
7. **Sura map and ayah validation:** see section 5. One sura per homework item.
8. When creating new homework, **pre-fill a suggestion** (same sura, `fromAyah` = last evaluated `toAyah + 1`, moving to the next sura when the current one is finished), but the teacher decides and can change everything. The suggestion must also use the sura map so it never points to an ayah that doesn't exist.
9. Use **soft deletion / archiving** for classes and students so history is never lost. A student can be moved to a different class.

## 5. Sura map (خريطة السور) and ayah validation

Create a single, typed, static source of truth for all 114 suras of the Quran and use it everywhere a sura or ayah number appears.

### Requirements
- File: a pure domain module, for example `src/domain/quran/surahs.ts`.
- Export:
  - `SURAHS`: a readonly array of `{ number: number; names: { ar: string; en: string }; ayahCount: number }` in order from 1 to 114. Sura names live in the map (not in the message files) because they are domain data, keyed by locale.
  - `SURAH_MAP`: a `ReadonlyMap<number, Surah>` keyed by sura number, for O(1) lookup.
  - Helpers: `getSurah(number)`, `getSurahName(number, locale)` (falls back to `ar` when a locale has no name), `getAyahCount(number)`, `isValidSurah(number)`, and `validateAyahRange(surah, fromAyah, toAyah)`.
- `validateAyahRange` returns `{ ok: true }` or `{ ok: false, code, params }`, with **error codes, not text**. The UI turns the code into a message through i18n. The Arabic messages below are the values for `ar.json`.
- **Validation rules** (`validateAyahRange`):
  - The sura number must be an integer between 1 and 114 → `SURAH_NOT_FOUND` → "السورة غير موجودة".
  - `fromAyah` and `toAyah` must be integers ≥ 1 → `INVALID_AYAH` → "رقم الآية غير صحيح".
  - Both must be ≤ the sura's `ayahCount` → `AYAH_OUT_OF_RANGE` with `{ surahName, ayahCount }` → for example "سورة البقرة تحتوي على 286 آية فقط".
  - `fromAyah ≤ toAyah` → `FROM_AFTER_TO` → "آية البداية يجب أن تكون قبل أو تساوي آية النهاية".
- Use the same validation in the **shared Zod schema** for homework (Zod issues carry the error code, not text), so it runs **on the client** (instant feedback in the form) **and on the server** (the sync API rejects invalid homework). Never trust the client alone.
- **UI usage:**
  - The sura picker is searchable by name (in the active locale, plus Arabic always) or number, and shows each option as number, localized name, and ayah count, for example "2 · البقرة · 286 آية".
  - Arabic search is forgiving: ignore diacritics (tashkeel) and treat أ/إ/آ as ا, ة as ه, and ى as ي, so typing "الاسراء" finds "الإسراء".
  - After choosing a sura, the ayah inputs show the allowed range (for example "من 1 إلى 286"), limit input to that range, and show the Arabic error message immediately when the value is invalid.
  - History rows and the student profile show the sura name from the map in the active locale, never a free-typed value. Store only the sura **number** in the database.
- **Unit tests** must assert: exactly 114 entries, numbers 1–114 in order with no gaps, total ayahs = **6236**, spot checks (1 → 7, 2 → 286, 9 → 129, 108 → 3, 114 → 6), every sura has non-empty `ar` and `en` names, `getSurahName` locale fallback, the Arabic search normalization, and all validation rules with their error codes, including the edge cases (first ayah, last ayah, 0, negative, above the count, from > to, non-integer, sura 0 and 115).

### Data (Hafs ʿan ʿĀṣim numbering, as printed in the Madani mushaf)
Use exactly this data. It has been verified: 114 suras, 6236 ayahs in total. English names are common transliterations; keep them as given.

| # | Arabic name (`ar`) | English name (`en`) | Ayah count |
|---|---|---|---|
| 1 | الفاتحة | Al-Fatihah | 7 |
| 2 | البقرة | Al-Baqarah | 286 |
| 3 | آل عمران | Al-Imran | 200 |
| 4 | النساء | An-Nisa | 176 |
| 5 | المائدة | Al-Ma'idah | 120 |
| 6 | الأنعام | Al-An'am | 165 |
| 7 | الأعراف | Al-A'raf | 206 |
| 8 | الأنفال | Al-Anfal | 75 |
| 9 | التوبة | At-Tawbah | 129 |
| 10 | يونس | Yunus | 109 |
| 11 | هود | Hud | 123 |
| 12 | يوسف | Yusuf | 111 |
| 13 | الرعد | Ar-Ra'd | 43 |
| 14 | إبراهيم | Ibrahim | 52 |
| 15 | الحجر | Al-Hijr | 99 |
| 16 | النحل | An-Nahl | 128 |
| 17 | الإسراء | Al-Isra | 111 |
| 18 | الكهف | Al-Kahf | 110 |
| 19 | مريم | Maryam | 98 |
| 20 | طه | Ta-Ha | 135 |
| 21 | الأنبياء | Al-Anbiya | 112 |
| 22 | الحج | Al-Hajj | 78 |
| 23 | المؤمنون | Al-Mu'minun | 118 |
| 24 | النور | An-Nur | 64 |
| 25 | الفرقان | Al-Furqan | 77 |
| 26 | الشعراء | Ash-Shu'ara | 227 |
| 27 | النمل | An-Naml | 93 |
| 28 | القصص | Al-Qasas | 88 |
| 29 | العنكبوت | Al-Ankabut | 69 |
| 30 | الروم | Ar-Rum | 60 |
| 31 | لقمان | Luqman | 34 |
| 32 | السجدة | As-Sajdah | 30 |
| 33 | الأحزاب | Al-Ahzab | 73 |
| 34 | سبأ | Saba | 54 |
| 35 | فاطر | Fatir | 45 |
| 36 | يس | Ya-Sin | 83 |
| 37 | الصافات | As-Saffat | 182 |
| 38 | ص | Sad | 88 |
| 39 | الزمر | Az-Zumar | 75 |
| 40 | غافر | Ghafir | 85 |
| 41 | فصلت | Fussilat | 54 |
| 42 | الشورى | Ash-Shura | 53 |
| 43 | الزخرف | Az-Zukhruf | 89 |
| 44 | الدخان | Ad-Dukhan | 59 |
| 45 | الجاثية | Al-Jathiyah | 37 |
| 46 | الأحقاف | Al-Ahqaf | 35 |
| 47 | محمد | Muhammad | 38 |
| 48 | الفتح | Al-Fath | 29 |
| 49 | الحجرات | Al-Hujurat | 18 |
| 50 | ق | Qaf | 45 |
| 51 | الذاريات | Adh-Dhariyat | 60 |
| 52 | الطور | At-Tur | 49 |
| 53 | النجم | An-Najm | 62 |
| 54 | القمر | Al-Qamar | 55 |
| 55 | الرحمن | Ar-Rahman | 78 |
| 56 | الواقعة | Al-Waqi'ah | 96 |
| 57 | الحديد | Al-Hadid | 29 |
| 58 | المجادلة | Al-Mujadilah | 22 |
| 59 | الحشر | Al-Hashr | 24 |
| 60 | الممتحنة | Al-Mumtahanah | 13 |
| 61 | الصف | As-Saff | 14 |
| 62 | الجمعة | Al-Jumu'ah | 11 |
| 63 | المنافقون | Al-Munafiqun | 11 |
| 64 | التغابن | At-Taghabun | 18 |
| 65 | الطلاق | At-Talaq | 12 |
| 66 | التحريم | At-Tahrim | 12 |
| 67 | الملك | Al-Mulk | 30 |
| 68 | القلم | Al-Qalam | 52 |
| 69 | الحاقة | Al-Haqqah | 52 |
| 70 | المعارج | Al-Ma'arij | 44 |
| 71 | نوح | Nuh | 28 |
| 72 | الجن | Al-Jinn | 28 |
| 73 | المزمل | Al-Muzzammil | 20 |
| 74 | المدثر | Al-Muddaththir | 56 |
| 75 | القيامة | Al-Qiyamah | 40 |
| 76 | الإنسان | Al-Insan | 31 |
| 77 | المرسلات | Al-Mursalat | 50 |
| 78 | النبأ | An-Naba | 40 |
| 79 | النازعات | An-Nazi'at | 46 |
| 80 | عبس | Abasa | 42 |
| 81 | التكوير | At-Takwir | 29 |
| 82 | الانفطار | Al-Infitar | 19 |
| 83 | المطففين | Al-Mutaffifin | 36 |
| 84 | الانشقاق | Al-Inshiqaq | 25 |
| 85 | البروج | Al-Buruj | 22 |
| 86 | الطارق | At-Tariq | 17 |
| 87 | الأعلى | Al-A'la | 19 |
| 88 | الغاشية | Al-Ghashiyah | 26 |
| 89 | الفجر | Al-Fajr | 30 |
| 90 | البلد | Al-Balad | 20 |
| 91 | الشمس | Ash-Shams | 15 |
| 92 | الليل | Al-Layl | 21 |
| 93 | الضحى | Ad-Duha | 11 |
| 94 | الشرح | Ash-Sharh | 8 |
| 95 | التين | At-Tin | 8 |
| 96 | العلق | Al-Alaq | 19 |
| 97 | القدر | Al-Qadr | 5 |
| 98 | البينة | Al-Bayyinah | 8 |
| 99 | الزلزلة | Az-Zalzalah | 8 |
| 100 | العاديات | Al-Adiyat | 11 |
| 101 | القارعة | Al-Qari'ah | 11 |
| 102 | التكاثر | At-Takathur | 8 |
| 103 | العصر | Al-Asr | 3 |
| 104 | الهمزة | Al-Humazah | 9 |
| 105 | الفيل | Al-Fil | 5 |
| 106 | قريش | Quraysh | 4 |
| 107 | الماعون | Al-Ma'un | 7 |
| 108 | الكوثر | Al-Kawthar | 3 |
| 109 | الكافرون | Al-Kafirun | 6 |
| 110 | النصر | An-Nasr | 3 |
| 111 | المسد | Al-Masad | 5 |
| 112 | الإخلاص | Al-Ikhlas | 4 |
| 113 | الفلق | Al-Falaq | 5 |
| 114 | الناس | An-Nas | 6 |

## 6. User flows

### First use
1. Teacher logs in (account created by the admin script).
2. Empty state invites him to **create a class** (name).
3. He adds **students**: full name, birth year, optional note, and the class (pre-selected when adding from inside a class).

### Lesson day
1. Home screen shows his classes (student count, whether a lesson exists today). Each class has a prominent **"درس جديد"** button. If a lesson for that class already exists today, open it instead of creating a duplicate.
2. **Attendance step:** list all active students of the class with a fast three-state toggle (حاضر / غائب / غائب بعذر). Include "تحديد الكل حاضر". Selecting "غائب بعذر" reveals an excuse-note field.
3. **Evaluation step:** a card per present student showing:
   - their pending homework item(s) (sura name and ayah range from the sura map), each with two 1–10 inputs (تقييم الحفظ, تقييم السلوك) that are fast to tap, such as segmented buttons;
   - "إضافة واجب للدرس القادم" to assign the next homework;
   - "تسميع الآن" to create and evaluate an item in this lesson when there is no pending homework.
   - A progress indicator: "تم تقييم X من Y".
4. **Autosave everything.** No save buttons. Every change is written locally immediately.

### Student profile
- Header: name, class, age (from birth year), note, current pending homework.
- **Per-month summary**, newest first: معدل الحفظ الشهري, معدل السلوك الشهري, attended / absent / excused counts, and number of evaluated items.
- A simple chart of monthly memorization and behavior averages over time.
- **Lesson history** for the selected month: date, day, sura, from–to, تقييم الحفظ, تقييم السلوك, plus absences with their excuse notes. Tapping a row allows editing it.
- A global student search from the home screen.

### Settings
Change display name, username, and password. Sync status. Log out (warn if there are unsynced changes).

## 7. Technical requirements

### Stack
- **Next.js** (latest stable, App Router), **TypeScript strict**, **pnpm**.
- **MongoDB** (Atlas free tier for production) with the official driver or Mongoose. Your choice, but justify it.
- **Tailwind CSS + shadcn/ui**, direction-agnostic as described in section 2.
- Fonts via `next/font`, chosen per locale: an Arabic font (IBM Plex Sans Arabic or Tajawal) for `ar`, with a matching Latin font for `en` (for example IBM Plex Sans). The font choice comes from the locale, not hardcoded.
- **Zod** schemas shared between client and server.
- **Dexie (IndexedDB)** for the local database, **Serwist** (or the current recommended Next.js PWA solution) for the service worker.
- Auth: a credentials-based solution with hashed passwords (argon2 or bcrypt), httpOnly cookie sessions, and login rate limiting. Use Auth.js or Better Auth (username plugin). Check current docs and pick the one that best supports offline use and username-only accounts.
- Verify the current versions and APIs of every library from their docs instead of relying on memory.

### Offline-first architecture (most important technical part)
- The UI **always reads from and writes to the local Dexie database** (for example with `useLiveQuery`), so the app behaves identically online and offline.
- All records use **client-generated IDs** (UUIDv7) so they can be created offline.
- Every syncable record has: `id`, `tenantId`, `createdAt`, `updatedAt`, `deletedAt | null`, and a server-assigned `serverVersion`.
- **Outbox pattern:** every local write also queues a mutation. The outbox is durable and never dropped on failure.
- **Push** (`POST /api/sync/push`): send batched mutations. The server validates with Zod (including sura/ayah validation), enforces tenant ownership, applies **last-write-wins by `updatedAt` per record**, assigns `serverVersion` from an atomic per-tenant counter (`findOneAndUpdate` + `$inc`), and returns accepted/rejected results.
- **Pull** (`GET /api/sync/pull?since=<serverVersion>`): return paginated records with a higher `serverVersion`, including soft deletions.
- Sync triggers: app start, coming back online, after local writes (debounced), and periodically while online. Use exponential backoff on failure.
- After the first login, do a full pull. The app shell must load offline after one online visit. The sura map is bundled with the app, so it works offline by default.
- **Offline auth:** if the user was logged in, the app stays usable offline. If sync returns 401, keep the outbox and ask him to log in again; never discard pending data.
- Show a small, always-visible sync indicator: متصل / غير متصل / "X تغييرات بانتظار المزامنة".
- Monthly statistics are computed on the client from local data.

### Multi-tenancy and security
- `users` includes a `locale` field (default `ar`).
- Collections: `tenants`, `users`, `classes`, `students`, `sessions`, `attendance`, `homework`, `counters`.
- Every document has `tenantId`. All server data access goes through a **repository layer that scopes every query by the authenticated user's tenant**. No API route touches the database without it.
- Proper indexes (`tenantId + serverVersion`, `tenantId + studentId`, unique `username`, and others as needed).
- Admin CLI script: `pnpm user:create --tenant "<name>" --username <u> --password <p> --name "<display name>"` that creates the tenant if needed and the teacher account.

### Data model (starting point; refine it and tell me what you change)
- `Class`: name, archivedAt
- `Student`: classId, fullName, birthYear, note, archivedAt
- `Session` (الدرس): classId, date (`YYYY-MM-DD`), note
- `Attendance`: sessionId, studentId, status, excuseNote
- `Homework`: studentId, surah (number 1–114, validated against the sura map), fromAyah, toAyah, note, assignedSessionId (nullable), evaluatedSessionId (nullable), memorizationRate (nullable), behaviorRate (nullable). Pending = not evaluated.

### UX quality bar
- Mobile-first, one-handed use, large touch targets, works well at 360px width.
- Fast: entering one student's evaluation should take a few taps.
- Clear empty states, loading states, and localized validation messages.
- Light and dark mode.
- Accessible: labels, focus states, sufficient contrast.

### Code quality
- Clear folder structure: domain logic (sura map and validation, monthly stats, homework suggestion) as pure functions separate from UI and database code. Domain code returns codes and data, never display text.
- **Vitest** unit tests for: the sura map and ayah validation (section 5), i18n message key parity, the direction helper, monthly stats calculation, next-homework suggestion, and sync merge logic (LWW, soft deletes, tenant isolation, rejection of invalid ayah ranges).
- **Playwright** end-to-end test of the main flow: login → create class → add students → start a lesson → attendance → evaluate → assign homework → view student profile, including an **offline run** that syncs correctly after reconnecting, plus the LTR smoke test from section 2.
- ESLint (including the rule that blocks physical direction classes), Prettier, a `.env.example`, and a README covering local setup, creating the first account, and deployment (Vercel or AWS Amplify + MongoDB Atlas).

## 8. Out of scope for now
A visible language switcher (the `en` locale is built and tested but hidden), parent access, WhatsApp, PDF reports, importing old paper data, email, and Hijri dates. Keep the design open to adding them later, but don't build them.

## 9. How to work (follow strictly)

### Stage 0: Explore the repository
- Inspect the existing repository: files, git status, branches, any existing config, README, or code.
- Do not delete or overwrite anything that already exists without asking me first.
- Save this brief into the repo as `docs/BRIEF.md` so it stays available across sessions.

### Stage 1: Questions (stop and wait)
- Ask me every question you have about requirements, ambiguities, or decisions **before** planning. Group them by topic and number them so I can answer quickly. Include your recommended answer for each when you have one.
- Also ask about my workflow preferences: branch strategy (for example one branch per phase vs. committing to `main`), commit style, and the deployment target.
- **Do not write a plan or any code until I have answered.**

### Stage 2: Plan (stop and wait for approval)
- Write the plan to `docs/PLAN.md` and commit it. It must include:
  - architecture overview, including the offline/sync design;
  - folder structure;
  - final data model with indexes;
  - library choices with versions and reasons;
  - the phases below, each broken into **small numbered steps**, each step with a clear "done when" check.
- Present a summary to me and **wait for my approval**. Update the plan if I ask for changes.

### Stage 3: Build phase by phase, step by step
Phases:
1. Scaffold, tooling, **i18n and direction setup (ar + en messages, logical-properties lint rule)**, theme, **sura map + validation + tests**, auth, tenants, user CLI script
2. Local database, outbox, sync API, and sync engine, with tests
3. Classes and students
4. Lessons: attendance and homework evaluation (using the sura picker and validation)
5. Student profile, monthly statistics, and chart
6. PWA/offline hardening, settings, end-to-end tests, README, and deployment

Rules for every phase:
- Work through the plan's steps **in order, one at a time**. After each step: run lint, type-check, and the relevant tests, then make a focused commit.
- Keep `docs/PLAN.md` up to date: tick off completed steps and note any changes to the plan and why.
- If you find something ambiguous or a reason to deviate from the plan, **stop and ask** instead of guessing.
- **At the end of each phase, stop.** Summarize what was built, how I can try it, the tests that pass, and any decisions you made. **Wait for my go-ahead before starting the next phase.**
