---
name: offline-sync-data
description: The offline-first data path of quran-classes-tracker (shared Zod schemas, the Dexie local DB, LocalStore + outbox, push/pull sync with last-write-wins, tenant-scoped MongoDB repositories, indexes). Use it whenever you add or change a synced entity or field, write code that reads or writes classes, students, lessons, attendance or homework, touch packages/core/src/shared, packages/core/src/data, src/client/db, src/client/data or src/server/sync, add an index, or debug data that doesn't sync, duplicates or disappears, even if the request is phrased as a UI feature ("add a phone number to students", "let the teacher delete a lesson").
---

> Paths in this skill that start with `src/…`, `e2e/…` or `scripts/…` are relative to the web app, `apps/web/`. The React-free shared code (domain, shared schemas and sync rules, the local data layer and sync engine, i18n config, messages) lives in `packages/core/` and is imported as `@qct/core/…`. Run `pnpm` scripts from the repo root.

# Offline-first data in this app

The teacher must be able to run a whole lesson with no connection, on several devices, without losing or duplicating anything. Every rule below protects that. `PLAN.md` §2 (architecture) and §4 (data model) describe the design. Read them for anything not covered here.

## How data flows

```
UI ── reads ──▶ shared queries ─▶ LocalDatabase ─▶ adapter (web: Dexie/IndexedDB, one DB per user)
UI ── writes ─▶ shared actions ─▶ LocalStore: validate → record + outbox entry (ONE transaction)
Sync engine ── push outbox ─▶ POST /api/sync/push ─▶ validate, force tenant, check refs, LWW upsert
Sync engine ◀─ pull changes ─ GET /api/sync/pull?since=N ◀─ records with serverVersion > N
```

The data layer is shared with the mobile app (PLAN.md §2.14): `LocalStore`, the outbox, apply-pull, the sync engine and the per-entity actions and queries live in `packages/core/src/data` and talk only to the storage interface (`storage.ts`). Each app supplies an adapter: Dexie on the web (`src/client/db/dexie.ts`), SQLite on mobile (step 2.7). On the web, hooks in `src/client/data` wrap the shared queries in `useLiveQuery`.

- **The UI never calls the API for data.** It reads the local database and writes through `LocalStore` (`packages/core/src/data/local-store.ts`), so online and offline behave the same.
- **Sync** (`packages/core/src/data/sync/engine.ts`) runs on app start, on `online`, when the app becomes visible, 1.5 s after a local write, and every 60 s. The web's triggers are in `src/client/sync/triggers.ts`, its lock and online check in `src/client/sync/browser.ts`.
- **Conflicts** resolve by last write wins on `updatedAt`, with ties broken by `updatedBy` (`packages/core/src/shared/sync/lww.ts`). Each device's clock only moves forward; `LocalStore` stores it in `meta`.
- **A pulled record never overwrites a local record that has a pending outbox entry and is newer.** See `applyPulledChanges` in `packages/core/src/data/sync/apply-pull.ts`.

## Where each piece lives

| Concern                                               | File                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Record schema (shared by client and server)           | `packages/core/src/shared/schemas/<entity>.ts`, built on `syncableBaseSchema` in `base.ts`                    |
| The list of synced tables, schemas, foreign keys      | `packages/core/src/shared/sync/tables.ts` (`SYNC_TABLES`, `RECORD_SCHEMAS`, `REFERENCES`)                     |
| Deterministic IDs                                     | `packages/core/src/shared/ids.ts` (`lessonIdFor`, `attendanceIdFor`)                                          |
| Local tables, keys and indexes; the storage interface | `packages/core/src/data/storage.ts` (`TABLE_SCHEMA`, `StorageAdapter`)                                        |
| The web's Dexie schema and adapter                    | `src/client/db/dexie.ts` (`LocalDb`, `createDexieStorage`, `openLocalDatabase`)                               |
| Change notifications after commit                     | `packages/core/src/data/database.ts` (`LocalDatabase`)                                                        |
| Local writes                                          | `packages/core/src/data/local-store.ts`: `create`, `update`, `upsert`, `softDelete`, `restore`, `transaction` |
| Actions and queries per entity                        | `packages/core/src/data/entities/<entity>.ts` (taking a `DataWriter` or a `StorageReader`)                    |
| The web's live-query hooks                            | `src/client/data/<entity>.ts` (`useLiveQuery` around the shared queries)                                      |
| Shared data-layer tests                               | `packages/core/src/data/testing/*.suite.ts`, run on every adapter (`dataLayerSuites`)                         |
| Mongo collection names                                | `src/server/collections.ts` (`COLLECTIONS`, `SYNCABLE_COLLECTIONS`)                                           |
| Tenant-scoped data access                             | `src/server/repositories/tenant-repository.ts` (`createTenantRepositories`)                                   |
| Push and pull services                                | `src/server/sync/push.ts`, `pull.ts`, `versions.ts`                                                           |
| Mongo indexes                                         | `src/server/indexes.ts` (`INDEXES`; apply with `pnpm db:indexes`)                                             |
| Pure domain rules (no React, DB or text)              | `packages/core/src/domain/**`                                                                                 |
| Test record builders, in-memory Mongo                 | `packages/core/src/test/records.ts`, `src/test/mongo.ts`                                                      |
| Sample data                                           | `scripts/dev-seed.ts` (writes through the real `pushChanges`)                                                 |

## Centers and access

Data belongs to a **center** (`tenantId`). Who may touch it is decided per user by a server-only `members` document: role, permissions, assigned classes. See `packages/core/src/shared/access.ts`, `src/server/members.ts` and PLAN.md §2.11.

- **Sync routes pass the signed-in actor.** `pushChanges` and `pullChanges` take a `SyncScope`: an `Actor` from `withTenant` context, or a bare tenant id for trusted server code (dev seed, tests), which has full access. Never pass a bare tenant id from a request.
- **Push checks a teacher's every write.** It needs the table's permission (classes → `classes.manage`, students → `students.manage`, lessons/attendance/homework → `lessons.run`) and every class it touches must be his. For homework, that's the student's class; for a move, both classes. Otherwise it's `FORBIDDEN`. A new class needs only the permission and becomes his.
- **Pull returns only his classes** and their students, lessons and attendance (by `classId`), plus those students' homework. A new table that a teacher should see must be added to the pull scoping, with the class it belongs to.
- **Attendance carries `classId`** (its lesson's class, checked on push). Lessons and attendance never change class.
- **Access changes resync the device.** Changing a member's classes or permissions bumps `accessVersion`. Sync responses carry it, and the engine rebuilds the local copy when it changes. When a student changes class, his homework is re-versioned, and teachers who lose him get a new `accessVersion`.
- **The client only hides.** `useAccess()` (`src/client/access.ts`) shapes the UI; never rely on it for security.
- **The parent page is the one server-read page.** `POST /api/parent` (`src/server/parent.ts`) finds a student by id in any center, checks the parent's ID number (`Student.parentId`, stored as entered, read through `normalizeParentId`) or the remembered-phone cookie, and builds the month from MongoDB inside that student's center (`createTenantRepositories`). It uses the same pure builders as the screens and the printout (`packages/core/src/domain/stats/month-sheet.ts`), so a change to what a month shows belongs there. Keep its response free of ids and notes, and keep its rate limits (`src/server/rate-limit.ts`).

## Rules, and why they matter

- **Write through `LocalStore` only.** Each write validates the full record with the shared schema, then saves the record and its outbox entry in one transaction. A record written any other way never syncs. Raw `put`s on a `LocalDatabase` transaction are for sync bookkeeping (outbox, apply-pull) and test setup only.
- **Multi-record actions run in one transaction, through its handle.** Actions take a `DataWriter` (the store, or a transaction handle) and wrap their work in `store.transaction(async (tx) => …)`. Inside, use only `tx`, and pass `tx` to the helpers you call (`setAttendance(tx, …)`); a transaction started on a handle joins it. Calling `store` inside the callback starts a second transaction: SQLite (and core's memory adapter, which runs transactions one at a time) deadlocks on it, and Dexie loses atomicity. Never await anything but storage work inside a transaction (a fetch, a timer): IndexedDB commits a transaction that has nothing to do.
- **Never hard-delete synced records.** Use `softDelete` (it sets `deletedAt`) and `restore`. A hard delete can't propagate to other devices, and the next pull would bring the record back. Queries filter on `deletedAt === null`. Archiving (`archivedAt`) is separate and reversible.
- **IDs come from the client.** UUIDv7 is the default. When two devices could create "the same thing" offline, derive a deterministic UUIDv5 instead, so they merge rather than duplicate: one lesson per class per day, one attendance record per lesson and student. Find existing records by their natural key, not only by the derived ID. `findAttendance` does this because older records may use other IDs.
- **Domain and server code return error codes, never text.** Schemas use `codeErrorMap` / `parseWithCodes` (`packages/core/src/shared/schemas/errors.ts`). The UI translates codes through `packages/core/messages/*.json`.
- **`packages/core` stays React-free and platform-free,** because the mobile app imports it too. It may not import React, Next, Dexie, Expo or the web app, and uses relative imports inside itself (no `@/`); `pnpm lint` enforces both. It has its own Vitest config, and `pnpm test` runs every package.
- **The server never trusts the client's `tenantId`.** Push overwrites it with the session's tenant. Access (role, permissions, classes) also comes from the server, never from the request. Server code reaches tenant data only through `TenantRepository`, which applies the tenant filter last. Never query a syncable collection directly.
- **References are checked on push.** Add every new foreign key to `REFERENCES`. A missing parent is rejected as `REFERENCE_NOT_FOUND`. The outbox pushes by table in `SYNC_TABLES` order (parents first), then oldest first, and the server writes each batch in the same order. A new table must go in `SYNC_TABLES` after the tables it references.
- **Rejections are never dropped.** A record the server refuses moves to the `rejected` store and appears in Settings → Sync, where only the user can retry or discard it.

## Lessons are created on demand

The UI no longer manages lessons. Today's lesson for a class is created the first time something is recorded for one of its students (`todayLessonId` in `packages/core/src/data/entities/today.ts`, built on `startLesson`). Read with the derived id and never create a lesson just to display something.

A postponed recitation is stored on the homework item (`postponedLessonIds`). Read it through `postponedLessonsOf()`, since records pulled from the server may predate the field. Marking a student absent goes through `setStudentAttendance`, which also cancels his postponements in that lesson.

An exam is a homework record with `kind: "exam"`, created by `addExam` already assigned and evaluated in today's lesson. Its single mark is in `memorizationRate`, and `behaviorRate` stays null (the schema enforces this). Read the kind through `kindOf()` / `isExam()`, for the same reason as `postponedLessonsOf()`. Anything that averages marks or follows the student's progress (`monthlyStats`, `classStatistics`, `latestPortion`) must skip exams.

## Adding a field to an existing entity

Existing devices and the database already hold records **without** the new field. Devices may also still run the old app from the service-worker cache, and push records without it.

1. **Shared schema.** Add the field in `packages/core/src/shared/schemas/<entity>.ts` with a `.default(...)`, or make it `.nullable()`, so old records still validate. `LocalStore` validates the full record on every write, so a required field with no default makes every old record impossible to edit.
2. **Code that reads it** must cope with it missing on records pulled from the server, since pulled records aren't re-validated. Alternatively, backfill:
   - on the device, a Dexie `version(n+1)` with `.upgrade()`;
   - in Mongo, a one-off script, bumping `serverVersion` through the normal version allocation so devices pull the change.
3. **Local index.** Only needed if you query by the field. Add it to `TABLE_SCHEMA` (`packages/core/src/data/storage.ts`). On the web, add `this.version(n+1).stores({...})` to `LocalDb` (never edit an existing version's schema; a test checks Dexie against `TABLE_SCHEMA`); on mobile, a SQLite migration.
4. **Mongo index.** If the server queries by the field, add it to `INDEXES` in `src/server/indexes.ts`, scoped by `tenantId` first.
5. **Test data.** Update the builders in `packages/core/src/test/records.ts` and `scripts/dev-seed.ts`.
6. **UI and messages.** Follow the `rtl-i18n-ui` skill.

## Adding a new synced entity

1. Create `packages/core/src/shared/schemas/<entity>.ts` as `syncableBaseSchema.extend({...})`, and export it from `packages/core/src/shared/schemas/index.ts`.
2. In `packages/core/src/shared/sync/tables.ts`, add the table to `SYNC_TABLES`, `SyncRecordMap`, `RECORD_SCHEMAS` and `REFERENCES`. The same name is used in Dexie, the protocol and Mongo.
3. Add the table to `LocalRecordMap` and `TABLE_SCHEMA` in `packages/core/src/data/storage.ts`, then to `LocalDb` (`src/client/db/dexie.ts`): the typed table and a new `version(n+1).stores({...})` including it, with `id` first.
4. In `src/server/collections.ts`, add it to `COLLECTIONS` and `SYNCABLE_COLLECTIONS`. Repositories, push and pull pick it up from there.
5. In `src/server/indexes.ts`, add `{ tenantId: 1, serverVersion: 1 }` (pull needs it), plus any per-query index.
6. Create `packages/core/src/data/entities/<entity>.ts` with its actions and queries, and `src/client/data/<entity>.ts` with the web's live-query hooks.
7. Write tests:
   - a record builder in `packages/core/src/test/records.ts`;
   - push and pull integration cases;
   - a suite in `packages/core/src/data/testing/` (added to `dataLayerSuites`) if there is new local logic, so it runs on every adapter.
8. If the sync rules change, record it in `PLAN.md` §4 and the change log.

## Tests

- **Unit tests** sit next to the code as `*.test.ts`. Data-layer tests are suites that take an adapter factory (`packages/core/src/data/testing/`): core runs them on the memory adapter, the web on Dexie with `fake-indexeddb` (`src/client/db/dexie.test.ts`).
- **Server integration tests** are `*.int.test.ts` and use `mongodb-memory-server` via `src/test/mongo.ts`. The first run downloads a mongod binary.
- **Component tests** use `// @vitest-environment jsdom` and `renderArabic` from `src/test/dom.tsx`.
- **Run everything with `pnpm test`.** For data-flow changes, run `pnpm test:e2e` as well. Its offline spec proves offline work reaches the server.
