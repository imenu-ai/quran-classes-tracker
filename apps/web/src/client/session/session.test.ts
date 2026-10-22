import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { openLocalDb } from "../db/dexie";
import {
  bootstrapSession,
  clearSession,
  forgetDevice,
  getDeviceId,
  readSession,
  saveSession,
  snapshotFromMe,
} from "./session";

const me = {
  user: {
    id: "u1",
    name: "الأستاذ",
    username: "teacher",
    phone: "0599",
    email: null,
    locale: "ar" as const,
    role: "teacher" as const,
    permissions: ["lessons.run" as const],
    classIds: ["c1"],
    mustChangePassword: true,
    accessVersion: 3,
  },
  tenant: { id: "t1", name: "مركز", code: "482913", timezone: "Asia/Hebron" },
};

describe("session snapshot", () => {
  it("keeps a stable device id", async () => {
    const first = await getDeviceId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(await getDeviceId()).toBe(first);
  });

  it("maps /api/me into a snapshot", () => {
    expect(snapshotFromMe(me, 5)).toEqual({
      userId: "u1",
      tenantId: "t1",
      name: "الأستاذ",
      username: "teacher",
      phone: "0599",
      email: null,
      locale: "ar",
      role: "teacher",
      permissions: ["lessons.run"],
      classIds: ["c1"],
      mustChangePassword: true,
      accessVersion: 3,
      tenantName: "مركز",
      centerCode: "482913",
      timezone: "Asia/Hebron",
      savedAt: 5,
    });
  });

  it("treats a snapshot saved before centers existed as signed out", async () => {
    await saveSession({ userId: "u0", tenantId: "t0" } as never);
    expect(await readSession()).toBeNull();
  });

  it("bootstraps from /api/me and saves the snapshot", async () => {
    await clearSession();
    const fetchMock = vi.fn(async () => Response.json(me));
    const snapshot = await bootstrapSession(fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledWith("/api/me", expect.anything());
    expect(await readSession()).toEqual(snapshot);
  });

  it("fails without saving when /api/me fails", async () => {
    await clearSession();
    const fetchMock = vi.fn(async () => new Response("{}", { status: 401 }));
    await expect(bootstrapSession(fetchMock as unknown as typeof fetch)).rejects.toThrow();
    expect(await readSession()).toBeNull();
  });

  it("forgetting the device deletes the user's local data and the snapshot", async () => {
    await bootstrapSession((async () => Response.json(me)) as unknown as typeof fetch);
    const db = openLocalDb("u1");
    await db.meta.put({ key: "cursor", value: 9 });

    await forgetDevice(db);
    expect(await readSession()).toBeNull();
    const reopened = openLocalDb("u1");
    expect(await reopened.meta.count()).toBe(0);
    await reopened.delete();
  });
});
