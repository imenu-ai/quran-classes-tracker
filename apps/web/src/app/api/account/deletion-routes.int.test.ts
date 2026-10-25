import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetAuthForTests } from "@/server/auth/auth";
import { COLLECTIONS, SYNCABLE_COLLECTIONS } from "@/server/collections";
import { ensureIndexes } from "@/server/indexes";
import { membersCollection } from "@/server/members";
import { pushChanges } from "@/server/sync/push";
import { createSignedInMember, createSignedInTeacher, signIn, TEST_PASSWORD } from "@/test/auth";
import { startTestMongo } from "@/test/mongo";
import { classRecord, studentRecord } from "@qct/core/test/records";
import { GET as GET_ME } from "../me/route";
import { DELETE as DELETE_CENTER } from "../center/route";
import { DELETE as DELETE_ACCOUNT } from "./route";

const ACCOUNT_URL = "http://localhost:3000/api/account";
const CENTER_URL = "http://localhost:3000/api/center";

const del = (url: string, cookie: string, password: string) =>
  new Request(url, {
    method: "DELETE",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ password }),
  });

const me = (cookie: string) =>
  GET_ME(new Request("http://localhost:3000/api/me", { headers: { cookie } }));

describe("deleting accounts and centers (PLAN.md §0 #50)", () => {
  let db: Db;
  let stop: () => Promise<void>;

  /** A teacher who has already replaced the admin's password. */
  async function teacherOf(center: { tenantId: string; code: string }, username: string) {
    const teacher = await createSignedInMember(center, { username });
    await membersCollection(db).updateOne(
      { _id: teacher.userId },
      { $set: { mustChangePassword: false } },
    );
    return teacher;
  }

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
    await ensureIndexes(db);
    resetAuthForTests();
  });

  afterAll(async () => {
    resetAuthForTests();
    await stop();
  });

  describe("DELETE /api/account", () => {
    it("deletes a teacher's account with his password; the center's records stay", async () => {
      const admin = await createSignedInTeacher("del_admin_1");
      const cls = classRecord();
      await pushChanges(db, admin.tenantId, [{ table: "classes", record: cls }]);
      const teacher = await teacherOf(admin, "del_teacher_1");

      const wrong = await DELETE_ACCOUNT(del(ACCOUNT_URL, teacher.cookie, "not-my-password"));
      expect(wrong.status).toBe(400);
      expect(await wrong.json()).toEqual({ error: "WRONG_PASSWORD" });
      expect((await me(teacher.cookie)).status).toBe(200);

      const deleted = await DELETE_ACCOUNT(del(ACCOUNT_URL, teacher.cookie, TEST_PASSWORD));
      expect(deleted.status).toBe(200);
      expect((await me(teacher.cookie)).status).toBe(401);
      expect((await signIn(admin.code, "del_teacher_1")).response.status).toBe(401);
      expect(await membersCollection(db).findOne({ _id: teacher.userId })).toBeNull();
      expect(
        await db.collection(COLLECTIONS.users).countDocuments({ tenantId: admin.tenantId }),
      ).toBe(1);
      expect(
        await db.collection(COLLECTIONS.classes).countDocuments({ _id: cls.id as never }),
      ).toBe(1);
    });

    it("refuses the last active admin, until there is another one", async () => {
      const admin = await createSignedInTeacher("del_admin_2");
      const last = await DELETE_ACCOUNT(del(ACCOUNT_URL, admin.cookie, TEST_PASSWORD));
      expect(last.status).toBe(409);
      expect(await last.json()).toEqual({ error: "LAST_ADMIN" });

      // A disabled admin doesn't count.
      const disabled = await createSignedInMember(admin, {
        username: "del_admin_2b",
        role: "admin",
      });
      await membersCollection(db).updateOne({ _id: disabled.userId }, { $set: { disabled: true } });
      expect((await DELETE_ACCOUNT(del(ACCOUNT_URL, admin.cookie, TEST_PASSWORD))).status).toBe(
        409,
      );

      await membersCollection(db).updateOne(
        { _id: disabled.userId },
        { $set: { disabled: false } },
      );
      expect((await DELETE_ACCOUNT(del(ACCOUNT_URL, admin.cookie, TEST_PASSWORD))).status).toBe(
        200,
      );
      expect((await signIn(admin.code, "del_admin_2")).response.status).toBe(401);
    });

    it("limits attempts per user", async () => {
      const admin = await createSignedInTeacher("del_admin_3");
      const teacher = await teacherOf(admin, "del_teacher_3");
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        statuses.push((await DELETE_ACCOUNT(del(ACCOUNT_URL, teacher.cookie, "guess"))).status);
      }
      expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
      const limited = await DELETE_ACCOUNT(del(ACCOUNT_URL, teacher.cookie, TEST_PASSWORD));
      expect(await limited.json()).toEqual({ error: "RATE_LIMITED" });
      expect((await me(teacher.cookie)).status).toBe(200);
    });

    it("needs a password", async () => {
      const admin = await createSignedInTeacher("del_admin_4");
      const response = await DELETE_ACCOUNT(del(ACCOUNT_URL, admin.cookie, ""));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "INVALID_INPUT" });
    });
  });

  describe("DELETE /api/center", () => {
    it("is for admins only", async () => {
      const admin = await createSignedInTeacher("del_admin_5");
      const teacher = await teacherOf(admin, "del_teacher_5");
      const response = await DELETE_CENTER(del(CENTER_URL, teacher.cookie, TEST_PASSWORD));
      expect(response.status).toBe(403);
      expect(
        await db.collection(COLLECTIONS.tenants).countDocuments({ _id: admin.tenantId as never }),
      ).toBe(1);
    });

    it("deletes the center, its users and every record, and nothing of another center", async () => {
      const admin = await createSignedInTeacher("del_admin_6");
      const teacher = await teacherOf(admin, "del_teacher_6");
      const cls = classRecord();
      await pushChanges(db, admin.tenantId, [
        { table: "classes", record: cls },
        { table: "students", record: studentRecord(cls.id) },
      ]);
      const other = await createSignedInTeacher("del_other_6");
      const otherClass = classRecord();
      await pushChanges(db, other.tenantId, [{ table: "classes", record: otherClass }]);

      const wrong = await DELETE_CENTER(del(CENTER_URL, admin.cookie, "not-my-password"));
      expect(wrong.status).toBe(400);
      expect(
        await db.collection(COLLECTIONS.classes).countDocuments({ tenantId: admin.tenantId }),
      ).toBe(1);

      const accountsBefore = await db.collection(COLLECTIONS.authAccounts).countDocuments();
      const sessionsBefore = await db.collection(COLLECTIONS.authSessions).countDocuments();
      const deleted = await DELETE_CENTER(del(CENTER_URL, admin.cookie, TEST_PASSWORD));
      expect(deleted.status).toBe(200);

      for (const name of SYNCABLE_COLLECTIONS) {
        expect(await db.collection(name).countDocuments({ tenantId: admin.tenantId })).toBe(0);
      }
      const byTenant = { tenantId: admin.tenantId };
      expect(await membersCollection(db).countDocuments(byTenant)).toBe(0);
      expect(await db.collection(COLLECTIONS.users).countDocuments(byTenant)).toBe(0);
      expect(
        await db.collection(COLLECTIONS.tenants).countDocuments({ _id: admin.tenantId as never }),
      ).toBe(0);
      expect(
        await db.collection(COLLECTIONS.counters).countDocuments({ _id: admin.tenantId as never }),
      ).toBe(0);
      // Both users' sign-ins and sessions, and nobody else's.
      expect(await db.collection(COLLECTIONS.authAccounts).countDocuments()).toBe(
        accountsBefore - 2,
      );
      expect(await db.collection(COLLECTIONS.authSessions).countDocuments()).toBe(
        sessionsBefore - 2,
      );
      expect((await me(admin.cookie)).status).toBe(401);
      expect((await me(teacher.cookie)).status).toBe(401);
      expect((await signIn(admin.code, "del_teacher_6")).response.status).toBe(401);

      expect(
        await db.collection(COLLECTIONS.classes).countDocuments({ _id: otherClass.id as never }),
      ).toBe(1);
      expect((await me(other.cookie)).status).toBe(200);
    });
  });
});
