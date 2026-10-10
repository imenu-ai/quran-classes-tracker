import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetAuthForTests } from "@/server/auth/auth";
import { COLLECTIONS } from "@/server/collections";
import { ensureIndexes } from "@/server/indexes";
import { membersCollection } from "@/server/members";
import { createSignedInMember, createSignedInTeacher, signIn } from "@/test/auth";
import { startTestMongo } from "@/test/mongo";
import { PATCH as PATCH_CENTER } from "../center/route";
import { PATCH as PATCH_ACCOUNT } from "./route";

const patch = (url: string, cookie: string, body: unknown) =>
  new Request(url, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });

describe("own profile and center settings", () => {
  let db: Db;
  let stop: () => Promise<void>;
  let admin: Awaited<ReturnType<typeof createSignedInTeacher>>;

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
    await ensureIndexes(db);
    resetAuthForTests();
    admin = await createSignedInTeacher("account_admin");
  });

  afterAll(async () => {
    resetAuthForTests();
    await stop();
  });

  it("lets a teacher edit his own name, username and phone, but not set an email", async () => {
    const teacher = await createSignedInMember(admin, { username: "account_teacher" });
    await membersCollection(db).updateOne(
      { _id: teacher.userId },
      { $set: { mustChangePassword: false } },
    );
    const url = "http://localhost:3000/api/account";

    const saved = await PATCH_ACCOUNT(
      patch(url, teacher.cookie, {
        name: "الاسم الجديد",
        username: "renamed_teacher",
        phone: "0599",
      }),
    );
    expect(saved.status).toBe(200);
    expect((await signIn(admin.code, "renamed_teacher")).response.status).toBe(200);

    const email = await PATCH_ACCOUNT(patch(url, teacher.cookie, { email: "t@example.test" }));
    expect(email.status).toBe(403);

    const taken = await PATCH_ACCOUNT(patch(url, teacher.cookie, { username: "account_admin" }));
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: "USERNAME_TAKEN" });
  });

  it("lets only admins rename the center and change its time zone", async () => {
    const url = "http://localhost:3000/api/center";
    const saved = await PATCH_CENTER(
      patch(url, admin.cookie, { name: "مركز معدّل", timezone: "Asia/Amman" }),
    );
    expect(saved.status).toBe(200);
    expect(
      await db.collection(COLLECTIONS.tenants).findOne({ _id: admin.tenantId as never }),
    ).toMatchObject({ name: "مركز معدّل", timezone: "Asia/Amman" });

    const invalid = await PATCH_CENTER(patch(url, admin.cookie, { timezone: "Mars/Base" }));
    expect(invalid.status).toBe(400);

    const teacher = await createSignedInMember(admin, { username: "center_teacher" });
    await membersCollection(db).updateOne(
      { _id: teacher.userId },
      { $set: { mustChangePassword: false } },
    );
    const refused = await PATCH_CENTER(patch(url, teacher.cookie, { name: "x" }));
    expect(refused.status).toBe(403);
  });
});
