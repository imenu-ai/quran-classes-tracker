---
name: offline-sync-data
description: The offline-first data path of quran-classes-tracker (shared Zod schemas, the Dexie local DB, LocalStore + outbox, push/pull sync with last-write-wins, tenant-scoped MongoDB repositories, indexes). Use it whenever you add or change a synced entity or field, write code that reads or writes classes, students, lessons, attendance or homework, touch src/shared, src/client/db, src/client/data, src/client/sync or src/server/sync, add an index, or debug data that doesn't sync, duplicates or disappears, even if the request is phrased as a UI feature ("add a phone number to students", "let the teacher delete a lesson").
---

# Offline-first data in this app

The teacher must be able to run a whole lesson with no connection, on several devices, without losing or duplicating anything. Every rule below protects that. `PLAN.md` §2 (architecture) and §4 (data model) describe the design. Read them for anything not covered here.

## How data flows

```
UI ── reads ──▶ Dexie (IndexedDB, one DB per user: qct-<userId>)  via useLiveQuery
UI ── writes ─▶ LocalStore: validate full record → put record + outbox entry (ONE transaction)
Sync engine ── push outbox ─▶ POST /api/sync/push ─▶ validate, force tenant, check refs, LWW upsert
Sync engine ◀─ pull changes ─ GET /api/sync/pull?since=N ◀─ records with serverVersion > N
```

- **The UI never calls the API for data.** It reads Dexie and writes through `LocalStore` (`src/client/db/local-store.ts`), so online and offline behave the same.
- **Sync** (`src/client/sync/engine.ts`) runs on app start, on `online`, when the app becomes visible, 1.5 s after a local write, and every 60 s.
- **Conflicts** resolve by last write wins on `updatedAt`, with ties broken by `updatedBy` (`src/shared/sync/lww.ts`). Each device's clock only moves forward; `LocalStore` stores it in `meta`.
- **A pulled record never overwrites a local record that has a pending outbox entry and is newer.** See `applyPulledChanges` in `src/client/sync/apply-pull.ts`.

## Where each piece lives

| Concern                                          | File                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Record schema (shared by client and server)      | `src/shared/schemas/<entity>.ts`, built on `syncableBaseSchema` in `base.ts`                     |
| The list of synced tables, schemas, foreign keys | `src/shared/sync/tables.ts` (`SYNC_TABLES`, `RECORD_SCHEMAS`, `REFERENCES`)                      |
| Deterministic IDs                                | `src/shared/ids.ts` (`lessonIdFor`, `attendanceIdFor`)                                           |
| Local DB schema and indexes                      | `src/client/db/dexie.ts` (`LocalDb`, `this.version(n).stores(…)`)                                |
| Local writes                                     | `src/client/db/local-store.ts`: `create`, `update`, `upsert`, `softDelete`, `restore`            |
| Queries and actions per entity                   | `src/client/data/<entity>.ts` (`useLiveQuery` hooks plus action functions taking a `LocalStore`) |
| Mongo collection names                           | `src/server/collections.ts` (`COLLECTIONS`, `SYNCABLE_COLLECTIONS`)                              |
| Tenant-scoped data access                        | `src/server/repositories/tenant-repository.ts` (`createTenantRepositories`)                      |
| Push and pull services                           | `src/server/sync/push.ts`, `pull.ts`, `versions.ts`                                              |
| Mongo indexes                                    | `src/server/indexes.ts` (`INDEXES`; apply with `pnpm db:indexes`)                                |
| Pure domain rules (no React, DB or text)         | `src/domain/**`                                                                                  |
| Test record builders, in-memory Mongo            | `src/test/records.ts`, `src/test/mongo.ts`                                                       |
| Sample data                                      | `scripts/dev-seed.ts` (writes through the real `pushChanges`)                                    |

## Centers and access (Phase 8)

Data belongs to a **center** (`tenantId`). Who may touch it is decided per user by a server-only `members` document: role, permissions, assigned classes. See `src/shared/access.ts`, `src/server/members.ts` and PLAN.md §2.11.

- **Sync routes pass the signed-in actor.** `pushChanges` and `pullChanges` take a `SyncScope`: an `Actor` from `withTenant` context, or a bare tenant id for trusted server code (dev seed, tests), which has full access. Never pass a bare tenant id from a request.
- **Push checks a teacher's every write.** It needs the table's permission (classes → `classes.manage`, students → `students.manage`, lessons/attendance/homework → `lessons.run`) and every class it touches must be his. For homework, that's the student's class; for a move, both classes. Otherwise it's `FORBIDDEN`. A new class needs only the permission and becomes his.
- **Pull returns only his classes** and their students, lessons and attendance (by `classId`), plus those students' homework. A new table that a teacher should see must be added to the pull scoping, with the class it belongs to.
- **Attendance carries `classId`** (its lesson's class, checked on push). Lessons and attendance never change class.
- **Access changes resync the device.** Changing a member's classes or permissions bumps `accessVersion`. Sync responses carry it, and the engine rebuilds the local copy when it changes. When a student changes class, his homework is re-versioned, and teachers who lose him get a new `accessVersion`.
- **The client only hides.** `useAccess()` (`src/client/access.ts`) shapes the UI; never rely on it for security.

## Rules, and why they matter

- **Write through `LocalStore` only.** Each write validates the full record with the shared schema, then saves the record and its outbox entry in one IndexedDB transaction. A direct `db.<table>.put()` creates a record that never syncs.
- **Wrap multi-record actions in one transaction.** Use `db.transaction("rw", tables, …)` around the `store.*` calls, so the action is all or nothing. The table list must include every table `LocalStore` touches: the entity tables plus `db.outbox`, `db.rejected` and `db.meta`. See `writableTables` in `src/client/data/classes.ts`. Dexie throws if a table is missing.
- **Never hard-delete synced records.** Use `softDelete` (it sets `deletedAt`) and `restore`. A hard delete can't propagate to other devices, and the next pull would bring the record back. Queries filter on `deletedAt === null`. Archiving (`archivedAt`) is separate and reversible.
- **IDs come from the client.** UUIDv7 is the default. When two devices could create "the same thing" offline, derive a deterministic UUIDv5 instead, so they merge rather than duplicate: one lesson per class per day, one attendance record per lesson and student. Find existing records by their natural key, not only by the derived ID. `findAttendance` does this because older records may use other IDs.
- **Domain and server code return error codes, never text.** Schemas use `codeErrorMap` / `parseWithCodes` (`src/shared/schemas/errors.ts`). The UI translates codes through `messages/*.json`.
- **The server never trusts the client's `tenantId`.** Push overwrites it with the session's tenant. Access (role, permissions, classes) also comes from the server, never from the request. Server code reaches tenant data only through `TenantRepository`, which applies the tenant filter last. Never query a syncable collection directly.
- **References are checked on push.** Add every new foreign key to `REFERENCES`. A missing parent is rejected as `REFERENCE_NOT_FOUND`. The outbox pushes by table in `SYNC_TABLES` order (parents first), then oldest first, and the server writes each batch in the same order. A new table must go in `SYNC_TABLES` after the tables it references.
- **Rejections are never dropped.** A record the server refuses moves to the `rejected` store and appears in Settings → Sync, where only the user can retry or discard it.

## Lessons are created on demand (Phase 9)

The UI no longer manages lessons. Today's lesson for a class is created the first time something is recorded for one of its students (`todayLessonId` in `src/client/data/today.ts`, built on `startLesson`). Read with the derived id and never create a lesson just to display something.

A postponed recitation is stored on the homework item (`postponedLessonIds`). Read it through `postponedLessonsOf()`, since records pulled from the server may predate the field. Marking a student absent goes through `setStudentAttendance`, which also cancels his postponements in that lesson.

## Adding a field to an existing entity

Existing devices and the database already hold records **without** the new field. Devices may also still run the old app from the service-worker cache, and push records without it.

1. **Shared schema.** Add the field in `src/shared/schemas/<entity>.ts` with a `.default(...)`, or make it `.nullable()`, so old records still validate. `LocalStore` validates the full record on every write, so a required field with no default makes every old record impossible to edit.
2. **Code that reads it** must cope with it missing on records pulled from the server, since pulled records aren't re-validated. Alternatively, backfill:
   - on the device, a Dexie `version(n+1)` with `.upgrade()`;
   - in Mongo, a one-off script, bumping `serverVersion` through the normal version allocation so devices pull the change.
3. **Dexie index.** Only needed if you query by the field. Add `this.version(n+1).stores({...})`. Never edit an existing version's schema.
4. **Mongo index.** If the server queries by the field, add it to `INDEXES` in `src/server/indexes.ts`, scoped by `tenantId` first.
5. **Test data.** Update the builders in `src/test/records.ts` and `scripts/dev-seed.ts`.
6. **UI and messages.** Follow the `rtl-i18n-ui` skill.

## Adding a new synced entity

1. Create `src/shared/schemas/<entity>.ts` as `syncableBaseSchema.extend({...})`, and export it from `src/shared/schemas/index.ts`.
2. In `src/shared/sync/tables.ts`, add the table to `SYNC_TABLES`, `SyncRecordMap`, `RECORD_SCHEMAS` and `REFERENCES`. The same name is used in Dexie, the protocol and Mongo.
3. In `LocalDb` (`src/client/db/dexie.ts`), add the typed table and a new `version(n+1).stores({...})` including it, with `id` first.
4. In `src/server/collections.ts`, add it to `COLLECTIONS` and `SYNCABLE_COLLECTIONS`. Repositories, push and pull pick it up from there.
5. In `src/server/indexes.ts`, add `{ tenantId: 1, serverVersion: 1 }` (pull needs it), plus any per-query index.
6. Create `src/client/data/<entity>.ts` with live-query hooks and actions.
7. Write tests:
   - a record builder in `src/test/records.ts`;
   - push and pull integration cases;
   - Dexie and LocalStore tests if there is new logic.
8. If the sync rules change, record it in `PLAN.md` §4 and the change log.

## Tests

- **Unit tests** sit next to the code as `*.test.ts`. IndexedDB tests use `fake-indexeddb`.
- **Server integration tests** are `*.int.test.ts` and use `mongodb-memory-server` via `src/test/mongo.ts`. The first run downloads a mongod binary.
- **Component tests** use `// @vitest-environment jsdom` and `renderArabic` from `src/test/dom.tsx`.
- **Run everything with `pnpm test`.** For data-flow changes, run `pnpm test:e2e` as well. Its offline spec proves offline work reaches the server.
