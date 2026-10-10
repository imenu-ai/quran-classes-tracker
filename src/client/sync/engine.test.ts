import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PullResponse, PushMutation, PushResult } from "@/shared/sync/protocol";
import { classRecord } from "@/test/records";
import { openLocalDb, type LocalDb } from "../db/dexie";
import { LocalStore } from "../db/local-store";
import { applyPulledChanges, getCursor } from "./apply-pull";
import { SyncEngine, type Timers } from "./engine";

const emptyChanges = (): PullResponse["changes"] => ({
  classes: [],
  students: [],
  lessons: [],
  attendance: [],
  homework: [],
});

/** A scriptable fake of the two sync endpoints. */
function fakeServer() {
  const pushes: PushMutation[][] = [];
  let pushStatus = 200;
  let pullStatus = 200;
  let decide: (mutation: PushMutation) => PushResult = (mutation) => ({
    id: String(mutation.record.id),
    table: mutation.table,
    status: "applied",
    serverVersion: 1,
  });
  const pullPages: PullResponse[] = [];
  let networkDown = false;

  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (networkDown) throw new TypeError("Failed to fetch");
    const path = String(url);
    if (path.startsWith("/api/sync/push")) {
      if (pushStatus !== 200) return new Response("{}", { status: pushStatus });
      const { mutations } = JSON.parse(String(init?.body)) as { mutations: PushMutation[] };
      pushes.push(mutations);
      return Response.json({ results: mutations.map(decide) });
    }
    if (pullStatus !== 200) return new Response("{}", { status: pullStatus });
    const since = Number(new URL(path, "http://x").searchParams.get("since"));
    const page = pullPages.shift() ?? { changes: emptyChanges(), cursor: since, hasMore: false };
    return Response.json(page);
  });

  return {
    fetch: fetch as unknown as typeof globalThis.fetch,
    calls: fetch,
    pushes,
    setPushStatus: (status: number) => (pushStatus = status),
    setPullStatus: (status: number) => (pullStatus = status),
    setDecide: (fn: typeof decide) => (decide = fn),
    queuePull: (...pages: PullResponse[]) => pullPages.push(...pages),
    setNetworkDown: (down: boolean) => (networkDown = down),
  };
}

/** Timers that only fire when the test says so. */
function manualTimers() {
  const pending: { callback: () => void; ms: number }[] = [];
  const timers: Timers = {
    set: (callback, ms) => {
      const handle = { callback, ms };
      pending.push(handle);
      return handle;
    },
    clear: (handle) => {
      const index = pending.indexOf(handle as (typeof pending)[number]);
      if (index >= 0) pending.splice(index, 1);
    },
  };
  return { timers, pending };
}

describe("SyncEngine", () => {
  let db: LocalDb;
  let store: LocalStore;
  let server: ReturnType<typeof fakeServer>;
  let online: boolean;
  let clock: ReturnType<typeof manualTimers>;
  let engine: SyncEngine;

  beforeEach(() => {
    db = openLocalDb(`engine-${crypto.randomUUID()}`);
    store = new LocalStore(db, { tenantId: "t1", deviceId: "device-a" });
    server = fakeServer();
    online = true;
    clock = manualTimers();
    engine = new SyncEngine({
      db,
      fetch: server.fetch,
      isOnline: () => online,
      random: () => 1,
      timers: clock.timers,
    });
  });

  afterEach(async () => {
    engine.dispose();
    await db.delete();
  });

  it("keeps offline writes and pushes them once online", async () => {
    online = false;
    const created = await store.create("classes", { name: "A", archivedAt: null });
    await engine.syncNow();
    expect(engine.getStatus().state).toBe("offline");
    expect(server.calls).not.toHaveBeenCalled();
    expect(await db.outbox.count()).toBe(1);

    online = true;
    await engine.syncNow();
    expect(server.pushes).toHaveLength(1);
    expect(server.pushes[0]?.[0]).toMatchObject({ table: "classes", record: { id: created.id } });
    expect(await db.outbox.count()).toBe(0);
    expect(engine.getStatus()).toMatchObject({ state: "idle", failures: 0 });
    expect(engine.getStatus().lastSyncedAt).not.toBeNull();
  });

  it("on 401 keeps the outbox, stops, and resumes after login", async () => {
    await store.create("classes", { name: "A", archivedAt: null });
    server.setPushStatus(401);
    await engine.syncNow();

    expect(engine.getStatus().state).toBe("needsLogin");
    expect(await db.outbox.count()).toBe(1);

    server.calls.mockClear();
    await engine.syncNow(); // ignored while logged out
    expect(server.calls).not.toHaveBeenCalled();
    expect(clock.pending).toHaveLength(0); // no retry loop against a dead session

    server.setPushStatus(200);
    await engine.resumeAfterLogin();
    expect(await db.outbox.count()).toBe(0);
    expect(engine.getStatus().state).toBe("idle");
  });

  it("on a 401 from pull also keeps everything and waits for login", async () => {
    server.setPullStatus(401);
    await engine.syncNow();
    expect(engine.getStatus().state).toBe("needsLogin");
  });

  it("backs off exponentially after failures and recovers", async () => {
    await store.create("classes", { name: "A", archivedAt: null });
    server.setPushStatus(503);

    await engine.syncNow();
    expect(engine.getStatus()).toMatchObject({ state: "error", failures: 1 });
    expect(clock.pending.map((t) => t.ms)).toEqual([2_000]);
    expect(await db.outbox.get((await db.outbox.toArray())[0]!.recordId)).toMatchObject({
      attempts: 1,
      lastError: "HTTP_503",
    });

    clock.pending.shift()!.callback();
    await vi.waitFor(() => expect(engine.getStatus().failures).toBe(2));
    expect(clock.pending.map((t) => t.ms)).toEqual([4_000]);

    server.setPushStatus(200);
    clock.pending.shift()!.callback();
    await vi.waitFor(() => expect(engine.getStatus().state).toBe("idle"));
    expect(engine.getStatus().failures).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    expect(clock.pending).toHaveLength(0);
  });

  it("treats a network error as offline and retries", async () => {
    await store.create("classes", { name: "A", archivedAt: null });
    server.setNetworkDown(true);
    await engine.syncNow();
    expect(engine.getStatus()).toMatchObject({ state: "offline", failures: 1 });
    expect(await db.outbox.count()).toBe(1);
    expect(clock.pending).toHaveLength(1);
  });

  it("moves a rejected change to `rejected` and clears accepted ones", async () => {
    const good = await store.create("classes", { name: "good", archivedAt: null });
    const bad = await store.create("classes", { name: "bad", archivedAt: null });
    server.setDecide((mutation) =>
      mutation.record.id === bad.id
        ? { id: bad.id, table: "classes", status: "rejected", code: "FORBIDDEN" }
        : { id: String(mutation.record.id), table: "classes", status: "stale" },
    );

    await engine.syncNow();
    expect(await db.outbox.count()).toBe(0);
    expect(await db.rejected.get(bad.id)).toMatchObject({ code: "FORBIDDEN" });
    expect(await db.rejected.get(good.id)).toBeUndefined();
    expect(engine.getStatus().state).toBe("idle");
  });

  it("pushes in batches until the outbox is empty", async () => {
    engine = new SyncEngine({ db, fetch: server.fetch, pushBatchSize: 2, timers: clock.timers });
    for (const name of ["a", "b", "c", "d", "e"])
      await store.create("classes", { name, archivedAt: null });
    await engine.syncNow();
    expect(server.pushes.map((batch) => batch.length)).toEqual([2, 2, 1]);
  });

  it("pulls every page and saves the cursor", async () => {
    const first = classRecord({ serverVersion: 1 });
    const second = classRecord({ serverVersion: 2 });
    server.queuePull(
      { changes: { ...emptyChanges(), classes: [first] }, cursor: 1, hasMore: true },
      { changes: { ...emptyChanges(), classes: [second] }, cursor: 2, hasMore: false },
    );
    await engine.syncNow();
    expect(await db.classes.count()).toBe(2);
    expect(await getCursor(db)).toBe(2);
    expect(String(server.calls.mock.calls.at(-1)?.[0])).toContain("since=1");
  });

  it("runs once at a time and re-runs for changes made during a sync", async () => {
    await store.create("classes", { name: "A", archivedAt: null });
    const first = engine.syncNow();
    const second = engine.syncNow();
    expect(second).toBe(first);
    await first;
    expect(server.pushes).toHaveLength(1);
  });
});

describe("applyPulledChanges", () => {
  let db: LocalDb;
  let store: LocalStore;

  beforeEach(() => {
    db = openLocalDb(`apply-${crypto.randomUUID()}`);
    store = new LocalStore(db, { tenantId: "t1", deviceId: "device-a", now: () => 5_000 });
  });

  afterEach(async () => {
    await db.delete();
  });

  it("a newer pulled record replaces the local one and supersedes a pending edit", async () => {
    const local = await store.create("classes", { name: "local", archivedAt: null });
    const newer = {
      ...local,
      name: "from server",
      updatedAt: 9_000,
      updatedBy: "device-b",
      serverVersion: 4,
    };

    const result = await applyPulledChanges(db, {
      changes: { ...emptyChanges(), classes: [newer] },
      cursor: 4,
    });
    expect(result).toEqual({ applied: 1, skipped: 0 });
    expect(await db.classes.get(local.id)).toMatchObject({ name: "from server" });
    expect(await db.outbox.get(local.id)).toBeUndefined();
  });

  it("an older pulled record does not overwrite a pending local edit", async () => {
    const local = await store.create("classes", { name: "local edit", archivedAt: null });
    const older = { ...local, name: "old server copy", updatedAt: 1_000, serverVersion: 2 };

    const result = await applyPulledChanges(db, {
      changes: { ...emptyChanges(), classes: [older] },
      cursor: 2,
    });
    expect(result).toEqual({ applied: 0, skipped: 1 });
    expect(await db.classes.get(local.id)).toMatchObject({ name: "local edit" });
    expect(await db.outbox.get(local.id)).toBeDefined();
    expect(await getCursor(db)).toBe(2);
  });

  it("applies pulled soft deletes", async () => {
    const record = classRecord({ serverVersion: 1 });
    await applyPulledChanges(db, { changes: { ...emptyChanges(), classes: [record] }, cursor: 1 });
    const deleted = { ...record, deletedAt: 2_000, updatedAt: 2_000, serverVersion: 2 };
    await applyPulledChanges(db, { changes: { ...emptyChanges(), classes: [deleted] }, cursor: 2 });
    expect(await db.classes.get(record.id)).toMatchObject({ deletedAt: 2_000 });
  });
});

describe("SyncEngine and access changes", () => {
  let db: LocalDb;
  let store: LocalStore;
  let server: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    db = openLocalDb(`engine-access-${crypto.randomUUID()}`);
    store = new LocalStore(db, { tenantId: "t1", deviceId: "device-a" });
    server = fakeServer();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("rebuilds the local copy for new access, keeping changes the server hasn't taken", async () => {
    const lost = classRecord({ name: "صف لم يعد له", serverVersion: 3 });
    await applyPulledChanges(db, { changes: { ...emptyChanges(), classes: [lost] }, cursor: 5 });
    const refused = await store.create("classes", { name: "مرفوض", archivedAt: null });
    server.setDecide((mutation) => ({
      id: String(mutation.record.id),
      table: mutation.table,
      status: "rejected",
      code: "FORBIDDEN",
    }));
    const gained = classRecord({ name: "صف جديد له", serverVersion: 8 });
    server.queuePull(
      { changes: emptyChanges(), cursor: 5, hasMore: false, accessVersion: 2 },
      {
        changes: { ...emptyChanges(), classes: [gained] },
        cursor: 9,
        hasMore: false,
        accessVersion: 2,
      },
    );
    const onAccessChanged = vi.fn(async () => {});
    const engine = new SyncEngine({
      db,
      fetch: server.fetch,
      isOnline: () => true,
      getAccessVersion: () => 1,
      onAccessChanged,
    });

    await engine.syncNow();

    expect(await db.classes.get(lost.id)).toBeUndefined();
    expect(await db.classes.get(refused.id)).toBeDefined();
    expect(await db.rejected.get(refused.id)).toBeDefined();
    expect(await db.classes.get(gained.id)).toMatchObject({ name: "صف جديد له" });
    expect(await getCursor(db)).toBe(9);
    expect(onAccessChanged).toHaveBeenCalledTimes(1);
    const pulls = server.calls.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.startsWith("/api/sync/pull"));
    expect(pulls.map((url) => new URL(url, "http://x").searchParams.get("since"))).toEqual([
      "5",
      "0",
    ]);
    engine.dispose();
  });

  it("leaves everything as is while the access version matches", async () => {
    const kept = classRecord({ serverVersion: 3 });
    await applyPulledChanges(db, { changes: { ...emptyChanges(), classes: [kept] }, cursor: 5 });
    server.queuePull({ changes: emptyChanges(), cursor: 5, hasMore: false, accessVersion: 4 });
    const onAccessChanged = vi.fn(async () => {});
    const engine = new SyncEngine({
      db,
      fetch: server.fetch,
      isOnline: () => true,
      getAccessVersion: () => 4,
      onAccessChanged,
    });
    await engine.syncNow();
    expect(await db.classes.get(kept.id)).toBeDefined();
    expect(onAccessChanged).not.toHaveBeenCalled();
    engine.dispose();
  });

  it("asks for the password change on 403 and keeps local changes", async () => {
    await store.create("classes", { name: "A", archivedAt: null });
    server.setPushStatus(403);
    const onPasswordChangeRequired = vi.fn();
    const engine = new SyncEngine({
      db,
      fetch: server.fetch,
      isOnline: () => true,
      onPasswordChangeRequired,
    });
    await engine.syncNow();
    expect(onPasswordChangeRequired).toHaveBeenCalledTimes(1);
    expect(engine.getStatus().state).toBe("idle");
    expect(await db.outbox.count()).toBe(1);
    engine.dispose();
  });
});
