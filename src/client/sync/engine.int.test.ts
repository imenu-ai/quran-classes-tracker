import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as pullRoute } from "@/app/api/sync/pull/route";
import { POST as pushRoute } from "@/app/api/sync/push/route";
import { resetAuthForTests } from "@/server/auth/auth";
import { ensureIndexes } from "@/server/indexes";
import { createSignedInTeacher } from "@/test/auth";
import { startTestMongo } from "@/test/mongo";
import { openLocalDb, type LocalDb } from "../db/dexie";
import { LocalStore } from "../db/local-store";
import { SyncEngine } from "./engine";

/** A fetch that sends requests to the real route handlers with a session cookie. */
function routesFetch(cookie: string): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost:3000");
    const headers = new Headers(init?.headers);
    headers.set("cookie", cookie);
    const request = new Request(url, { ...init, headers });
    return url.pathname === "/api/sync/push" ? pushRoute(request) : pullRoute(request);
  }) as typeof fetch;
}

interface Device {
  db: LocalDb;
  store: LocalStore;
  engine: SyncEngine;
  setNow(ms: number): void;
}

function makeDevice(name: string, tenantId: string, cookie: string): Device {
  let now = 1_000;
  const db = openLocalDb(`int-${name}-${crypto.randomUUID()}`);
  return {
    db,
    store: new LocalStore(db, { tenantId, deviceId: name, now: () => now }),
    engine: new SyncEngine({ db, fetch: routesFetch(cookie), now: () => now }),
    setNow: (ms) => (now = ms),
  };
}

describe("two devices syncing through the real server", () => {
  let stop: () => Promise<void>;
  let phone: Device;
  let laptop: Device;
  let otherTeacher: Device;

  beforeAll(async () => {
    const mongo = await startTestMongo();
    stop = mongo.stop;
    await ensureIndexes(mongo.db);
    resetAuthForTests();
    const teacher = await createSignedInTeacher("sync_teacher");
    const other = await createSignedInTeacher("other_teacher");
    phone = makeDevice("device-phone", teacher.tenantId, teacher.cookie);
    laptop = makeDevice("device-laptop", teacher.tenantId, teacher.cookie);
    otherTeacher = makeDevice("device-other", other.tenantId, other.cookie);
  });

  afterAll(async () => {
    for (const device of [phone, laptop, otherTeacher]) await device.db.delete();
    resetAuthForTests();
    await stop();
  });

  it("data created on one device appears on the other", async () => {
    const cls = await phone.store.create("classes", { name: "حلقة الفجر", archivedAt: null });
    await phone.store.create("students", {
      classId: cls.id,
      fullName: "أحمد",
      birthYear: 2014,
      note: "",
      memorizationDirection: "forward",
      archivedAt: null,
    });
    await phone.engine.syncNow();
    expect(await phone.db.outbox.count()).toBe(0);

    await laptop.engine.syncNow();
    expect(await laptop.db.classes.get(cls.id)).toMatchObject({ name: "حلقة الفجر" });
    expect(await laptop.db.students.where("classId").equals(cls.id).count()).toBe(1);
  });

  it("concurrent offline edits converge to the later one on both devices", async () => {
    const [cls] = await phone.db.classes.toArray();
    phone.setNow(10_000);
    await phone.store.update("classes", cls!.id, { name: "edited on phone" });
    laptop.setNow(20_000);
    await laptop.store.update("classes", cls!.id, { name: "edited on laptop (later)" });

    await phone.engine.syncNow();
    await laptop.engine.syncNow();
    await phone.engine.syncNow();

    for (const device of [phone, laptop]) {
      expect(await device.db.classes.get(cls!.id)).toMatchObject({
        name: "edited on laptop (later)",
      });
      expect(await device.db.outbox.count()).toBe(0);
    }
  });

  it("a soft delete on one device reaches the other", async () => {
    const [student] = await laptop.db.students.toArray();
    laptop.setNow(30_000);
    await laptop.store.softDelete("students", student!.id);
    await laptop.engine.syncNow();
    await phone.engine.syncNow();
    expect(await phone.db.students.get(student!.id)).toMatchObject({ deletedAt: 30_000 });
  });

  it("the server rejects an invalid ayah range even if the client skipped validation", async () => {
    const [student] = await phone.db.students.toArray();
    const bad = {
      id: "01928c5e-7b3a-7cde-8f00-00000000bad1",
      tenantId: "ignored",
      createdAt: 40_000,
      updatedAt: 40_000,
      updatedBy: "device-phone",
      deletedAt: null,
      serverVersion: 0,
      studentId: student!.id,
      surah: 108,
      fromAyah: 1,
      toAyah: 5,
      note: "",
      assignedLessonId: null,
      evaluatedLessonId: null,
      memorizationRate: null,
      behaviorRate: null,
    };
    // Write straight to IndexedDB, bypassing LocalStore validation.
    await phone.db.homework.put(bad);
    await phone.db.outbox.put({
      recordId: bad.id,
      table: "homework",
      rev: 1,
      enqueuedAt: 40_000,
      attempts: 0,
      lastError: null,
    });

    await phone.engine.syncNow();
    expect(await phone.db.outbox.count()).toBe(0);
    expect(await phone.db.rejected.get(bad.id)).toMatchObject({
      code: "AYAH_OUT_OF_RANGE",
      params: { surah: 108, ayahCount: 3, field: "toAyah" },
    });
    await laptop.engine.syncNow();
    expect(await laptop.db.homework.get(bad.id)).toBeUndefined();
  });

  it("another teacher's device never receives this tenant's data", async () => {
    await otherTeacher.engine.syncNow();
    expect(await otherTeacher.db.classes.count()).toBe(0);
    expect(await otherTeacher.db.students.count()).toBe(0);
  });
});
