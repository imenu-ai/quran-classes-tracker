import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSignedInTeacher, signIn, TEST_PASSWORD } from "@/test/auth";
import { startTestMongo } from "@/test/mongo";
import { classRecord } from "@/test/records";
import { getAuth, resetAuthForTests } from "./auth/auth";
import {
  CenterError,
  createCenter,
  createMember,
  listMembers,
  setMemberPassword,
  updateCenter,
  updateMember,
  updateOwnProfile,
} from "./centers";
import { COLLECTIONS } from "./collections";
import { ensureIndexes } from "./indexes";
import { getMember } from "./members";
import { pushChanges } from "./sync/push";

const register = (overrides: Record<string, unknown> = {}) =>
  createCenter({
    centerName: "مركز النور",
    timezone: "Asia/Hebron",
    adminName: "المدير",
    email: `admin-${crypto.randomUUID()}@example.test`,
    username: "admin",
    password: TEST_PASSWORD,
    ...overrides,
  });

async function changePassword(cookie: string, currentPassword: string, newPassword: string) {
  return getAuth().handler(
    new Request("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie },
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  );
}

describe("centers and members", () => {
  let db: Db;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
    await ensureIndexes(db);
    resetAuthForTests();
  });

  afterAll(async () => {
    resetAuthForTests();
    await stop();
  });

  describe("createCenter", () => {
    it("creates the center with a 6-digit code and an admin who signs in with it", async () => {
      const center = await register({ username: "Admin_1" });
      expect(center.code).toMatch(/^\d{6}$/);
      expect(center.username).toBe("admin_1");

      const user = await db.collection(COLLECTIONS.users).findOne({ tenantId: center.tenantId });
      expect(user).toMatchObject({
        username: `${center.code}:admin_1`,
        displayUsername: "admin_1",
        locale: "ar",
      });
      expect(String(user?.email)).toMatch(/@example\.test$/);

      const member = await getMember(db, center.userId);
      expect(member).toMatchObject({
        tenantId: center.tenantId,
        role: "admin",
        disabled: false,
        mustChangePassword: false,
      });

      expect((await signIn(center.code, "admin_1")).response.status).toBe(200);
      // The username alone (without the center code) isn't an account.
      const bare = await getAuth().handler(
        new Request("http://localhost:3000/api/auth/sign-in/username", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            "x-forwarded-for": "203.0.113.9",
          },
          body: JSON.stringify({ username: "admin_1", password: TEST_PASSWORD }),
        }),
      );
      expect(bare.status).not.toBe(200);
    });

    it("lets two centers use the same username", async () => {
      const a = await register({ username: "same" });
      const b = await register({ username: "same" });
      expect(a.code).not.toBe(b.code);
      expect((await signIn(a.code, "same")).response.status).toBe(200);
      expect((await signIn(b.code, "same")).response.status).toBe(200);
    });

    it("refuses an email that's already registered, leaving no center behind", async () => {
      const email = `taken-${crypto.randomUUID()}@example.test`;
      await register({ email });
      const before = await db.collection(COLLECTIONS.tenants).countDocuments();
      await expect(register({ email: email.toUpperCase() })).rejects.toMatchObject({
        code: "EMAIL_TAKEN",
      });
      expect(await db.collection(COLLECTIONS.tenants).countDocuments()).toBe(before);
    });

    it.each([
      [{ username: "ab" }, "username"],
      [{ username: "has space" }, "username"],
      [{ password: "short" }, "password"],
      [{ adminName: "  " }, "adminName"],
      [{ email: "not-an-email" }, "email"],
      [{ timezone: "Mars/Olympus" }, "timezone"],
    ])("rejects invalid input %o", async (patch, field) => {
      const error = await register(patch).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(CenterError);
      expect((error as CenterError).fieldErrors.map((e) => e.path)).toContain(field);
    });
  });

  describe("members", () => {
    it("creates a teacher who must change his password, then can't reuse a username", async () => {
      const center = await register();
      const { userId } = await createMember(center.tenantId, {
        name: "الأستاذ سالم",
        username: "Salem",
        phone: "0599 123 456",
        password: TEST_PASSWORD,
        permissions: ["lessons.run", "lessons.run"],
      });
      const member = await getMember(db, userId);
      expect(member).toMatchObject({
        role: "teacher",
        permissions: ["lessons.run"],
        classIds: [],
        mustChangePassword: true,
      });
      const user = await db
        .collection(COLLECTIONS.users)
        .findOne({ username: `${center.code}:salem` });
      expect(user).toMatchObject({ phone: "0599 123 456", displayUsername: "salem" });
      expect(String(user?.email)).toMatch(/@users\.invalid$/);

      await expect(
        createMember(center.tenantId, { name: "x", username: "SALEM", password: TEST_PASSWORD }),
      ).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
    });

    it("clears mustChangePassword once the teacher changes his password", async () => {
      const center = await register();
      const { userId } = await createMember(center.tenantId, {
        name: "t",
        username: "first_login",
        password: TEST_PASSWORD,
      });
      const { cookie } = await signIn(center.code, "first_login");
      expect((await changePassword(cookie, "wrong-password", "new-password-1")).status).not.toBe(
        200,
      );
      expect((await getMember(db, userId))?.mustChangePassword).toBe(true);
      expect((await changePassword(cookie, TEST_PASSWORD, "new-password-1")).status).toBe(200);
      expect((await getMember(db, userId))?.mustChangePassword).toBe(false);
    });

    it("only assigns classes that exist in the center", async () => {
      const center = await createSignedInTeacher("classes_admin");
      const ownClass = classRecord();
      await pushChanges(db, center.tenantId, [{ table: "classes", record: ownClass }]);
      const other = await register();

      await expect(
        createMember(other.tenantId, {
          name: "t",
          username: "teacher1",
          password: TEST_PASSWORD,
          classIds: [ownClass.id],
        }),
      ).rejects.toMatchObject({ code: "CLASS_NOT_FOUND" });

      const { userId } = await createMember(center.tenantId, {
        name: "t",
        username: "teacher1",
        password: TEST_PASSWORD,
        classIds: [ownClass.id],
      });
      expect((await getMember(db, userId))?.classIds).toEqual([ownClass.id]);
    });

    it("bumps accessVersion only when role, permissions or classes change", async () => {
      const center = await register();
      const { userId } = await createMember(center.tenantId, {
        name: "t",
        username: "versioned",
        password: TEST_PASSWORD,
        permissions: ["lessons.run"],
      });
      await updateMember(center.tenantId, userId, { name: "renamed", phone: "123" });
      expect((await getMember(db, userId))?.accessVersion).toBe(1);
      await updateMember(center.tenantId, userId, { permissions: ["lessons.run"] });
      expect((await getMember(db, userId))?.accessVersion).toBe(1);
      await updateMember(center.tenantId, userId, {
        permissions: ["lessons.run", "reports.view"],
      });
      expect((await getMember(db, userId))?.accessVersion).toBe(2);
    });

    it("saves a full form unchanged (same username, name and access)", async () => {
      const center = await register();
      const { userId } = await createMember(center.tenantId, {
        name: "t",
        username: "resaved",
        password: TEST_PASSWORD,
        permissions: ["lessons.run"],
      });
      await updateMember(center.tenantId, userId, {
        name: "t",
        username: "resaved",
        phone: "",
        role: "teacher",
        permissions: ["lessons.run"],
        classIds: [],
      });
      expect((await getMember(db, userId))?.accessVersion).toBe(1);
    });

    it("renames a member's username within the center", async () => {
      const center = await register();
      const { userId } = await createMember(center.tenantId, {
        name: "t",
        username: "old_name",
        password: TEST_PASSWORD,
      });
      await updateMember(center.tenantId, userId, { username: "New_Name" });
      expect((await signIn(center.code, "new_name")).response.status).toBe(200);
      expect((await signIn(center.code, "old_name")).response.status).not.toBe(200);
    });

    it("refuses sign-in for a disabled member and signs him out", async () => {
      const center = await register();
      const { userId } = await createMember(center.tenantId, {
        name: "t",
        username: "to_disable",
        password: TEST_PASSWORD,
      });
      const { cookie } = await signIn(center.code, "to_disable");
      await updateMember(center.tenantId, userId, { disabled: true });

      const session = await getAuth().api.getSession({ headers: new Headers({ cookie }) });
      expect(session).toBeNull();
      const { response } = await signIn(center.code, "to_disable");
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "ACCOUNT_DISABLED" });
    });

    it("never leaves a center without an active admin", async () => {
      const center = await register();
      await expect(
        updateMember(center.tenantId, center.userId, { disabled: true }),
      ).rejects.toMatchObject({
        code: "LAST_ADMIN",
      });
      await expect(
        updateMember(center.tenantId, center.userId, { role: "teacher" }),
      ).rejects.toMatchObject({ code: "LAST_ADMIN" });

      const { userId: second } = await createMember(center.tenantId, {
        name: "second admin",
        username: "second_admin",
        password: TEST_PASSWORD,
        role: "admin",
      });
      await updateMember(center.tenantId, center.userId, { role: "teacher" });
      expect((await getMember(db, center.userId))?.role).toBe("teacher");
      await expect(updateMember(center.tenantId, second, { disabled: true })).rejects.toMatchObject(
        {
          code: "LAST_ADMIN",
        },
      );
    });

    it("lets an admin set a new password, which must be changed and signs the user out", async () => {
      const center = await register();
      const { userId } = await createMember(center.tenantId, {
        name: "t",
        username: "forgot",
        password: TEST_PASSWORD,
      });
      const { cookie } = await signIn(center.code, "forgot");
      await changePassword(cookie, TEST_PASSWORD, "own-password-1");
      const { cookie: fresh } = await signIn(center.code, "forgot", "own-password-1");

      await setMemberPassword(center.tenantId, userId, "admin-chosen-1");
      expect(
        await getAuth().api.getSession({ headers: new Headers({ cookie: fresh }) }),
      ).toBeNull();
      expect((await getMember(db, userId))?.mustChangePassword).toBe(true);
      expect((await signIn(center.code, "forgot", "admin-chosen-1")).response.status).toBe(200);
      await expect(setMemberPassword(center.tenantId, userId, "short")).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    });

    it("doesn't reach members of another center", async () => {
      const a = await register();
      const b = await register();
      const { userId } = await createMember(a.tenantId, {
        name: "t",
        username: "mine",
        password: TEST_PASSWORD,
      });
      await expect(updateMember(b.tenantId, userId, { name: "x" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(setMemberPassword(b.tenantId, userId, "another-pass-1")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("lists the center's members only", async () => {
      const center = await register();
      await createMember(center.tenantId, {
        name: "سالم",
        username: "listed",
        phone: "1",
        password: TEST_PASSWORD,
      });
      const members = await listMembers(center.tenantId);
      expect(members.map((m) => m.username).sort()).toEqual(["admin", "listed"]);
      expect(members.find((m) => m.username === "listed")).toMatchObject({
        name: "سالم",
        phone: "1",
        role: "teacher",
        mustChangePassword: true,
      });
    });
  });

  describe("own profile and center", () => {
    it("updates name, username and phone; only admins have an email", async () => {
      const center = await register();
      const { userId } = await createMember(center.tenantId, {
        name: "t",
        username: "self_edit",
        password: TEST_PASSWORD,
      });
      await updateOwnProfile(center.tenantId, userId, {
        name: "الاسم الجديد",
        username: "self_edited",
        phone: "+970 599",
      });
      const user = await db
        .collection(COLLECTIONS.users)
        .findOne({ username: `${center.code}:self_edited` });
      expect(user).toMatchObject({ name: "الاسم الجديد", phone: "+970 599" });

      await expect(
        updateOwnProfile(center.tenantId, userId, { email: "t@example.test" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        updateOwnProfile(center.tenantId, userId, { username: "admin" }),
      ).rejects.toMatchObject({ code: "USERNAME_TAKEN" });

      const email = `new-${crypto.randomUUID()}@example.test`;
      await updateOwnProfile(center.tenantId, center.userId, { email });
      expect(await db.collection(COLLECTIONS.users).findOne({ email })).not.toBeNull();
    });

    it("renames the center and changes its time zone", async () => {
      const center = await register();
      await updateCenter(center.tenantId, { name: "مركز الهدى", timezone: "Asia/Amman" });
      expect(
        await db.collection(COLLECTIONS.tenants).findOne({ _id: center.tenantId as never }),
      ).toMatchObject({
        name: "مركز الهدى",
        timezone: "Asia/Amman",
        code: center.code,
      });
    });
  });
});
