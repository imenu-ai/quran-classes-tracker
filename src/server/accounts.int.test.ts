import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";
import { AccountError, createTeacherAccount } from "./accounts";
import { getAuth, resetAuthForTests } from "./auth/auth";
import { COLLECTIONS } from "./collections";
import { ensureIndexes } from "./indexes";

const PASSWORD = "a-strong-password";

function signIn(username: string, password: string) {
  return getAuth().handler(
    new Request("http://localhost:3000/api/auth/sign-in/username", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
      },
      body: JSON.stringify({ username, password }),
    }),
  );
}

describe("createTeacherAccount", () => {
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

  it("creates the tenant and a teacher who can sign in", async () => {
    const result = await createTeacherAccount({
      tenantName: "مركز النور",
      username: "Ahmad",
      password: PASSWORD,
      name: "الأستاذ أحمد",
    });
    expect(result).toMatchObject({
      username: "ahmad",
      tenantName: "مركز النور",
      createdTenant: true,
    });

    const tenant = await db.collection(COLLECTIONS.tenants).findOne({ name: "مركز النور" });
    expect(tenant).toMatchObject({ _id: result.tenantId, timezone: "Asia/Hebron" });

    const user = await db.collection(COLLECTIONS.users).findOne({ username: "ahmad" });
    expect(user).toMatchObject({ tenantId: result.tenantId, locale: "ar", name: "الأستاذ أحمد" });
    expect(String(user?.email)).toMatch(/@users\.invalid$/);

    expect((await signIn("ahmad", PASSWORD)).status).toBe(200);
  });

  it("reuses an existing tenant", async () => {
    const result = await createTeacherAccount({
      tenantName: "مركز النور",
      username: "second_teacher",
      password: PASSWORD,
      name: "Second",
    });
    expect(result.createdTenant).toBe(false);
    expect(await db.collection(COLLECTIONS.tenants).countDocuments()).toBe(1);
  });

  it("refuses a duplicate username (case-insensitive)", async () => {
    await expect(
      createTeacherAccount({
        tenantName: "Other",
        username: "AHMAD",
        password: PASSWORD,
        name: "x",
      }),
    ).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
    // The tenant isn't created when the username is taken.
    expect(await db.collection(COLLECTIONS.tenants).findOne({ name: "Other" })).toBeNull();
  });

  it.each([
    [{ username: "ab" }, "username"],
    [{ username: "has space" }, "username"],
    [{ password: "short" }, "password"],
    [{ name: "  " }, "name"],
    [{ timezone: "Mars/Olympus" }, "timezone"],
  ])("rejects invalid input %o", async (patch, field) => {
    const error = await createTeacherAccount({
      tenantName: "T",
      username: "valid_user",
      password: PASSWORD,
      name: "Name",
      ...patch,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AccountError);
    expect((error as AccountError).message).toContain(field);
  });
});
