import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetAuthForTests } from "@/server/auth/auth";
import { ensureIndexes } from "@/server/indexes";
import { membersCollection } from "@/server/members";
import { createSignedInMember, createSignedInTeacher, signIn } from "@/test/auth";
import { startTestMongo } from "@/test/mongo";
import { PATCH } from "./[id]/route";
import { POST as SET_PASSWORD } from "./[id]/password/route";
import { GET, POST } from "./route";

const BASE = "http://localhost:3000/api/center/users";
const json = (cookie: string, body: unknown, method = "POST") =>
  new Request(BASE, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("user management routes", () => {
  let stop: () => Promise<void>;
  let db: Db;
  let admin: Awaited<ReturnType<typeof createSignedInTeacher>>;

  beforeAll(async () => {
    const mongo = await startTestMongo();
    stop = mongo.stop;
    db = mongo.db;
    await ensureIndexes(mongo.db);
    resetAuthForTests();
    admin = await createSignedInTeacher("users_admin");
  });

  afterAll(async () => {
    resetAuthForTests();
    await stop();
  });

  it("lets the admin create, list, edit and reset a user", async () => {
    const created = await POST(
      json(admin.cookie, {
        name: "الأستاذ خالد",
        username: "khaled",
        password: "temporary-1",
        permissions: ["lessons.run"],
      }),
    );
    expect(created.status).toBe(201);
    const { userId } = (await created.json()) as { userId: string };

    const list = (await (
      await GET(new Request(BASE, { headers: { cookie: admin.cookie } }))
    ).json()) as {
      users: { id: string; username: string; mustChangePassword: boolean }[];
    };
    expect(list.users.find((user) => user.id === userId)).toMatchObject({
      username: "khaled",
      mustChangePassword: true,
    });

    const edited = await PATCH(
      json(admin.cookie, { phone: "0599", permissions: ["lessons.run", "reports.view"] }, "PATCH"),
      params(userId),
    );
    expect(edited.status).toBe(200);

    const reset = await SET_PASSWORD(
      json(admin.cookie, { password: "another-temp-2" }),
      params(userId),
    );
    expect(reset.status).toBe(200);
    expect((await signIn(admin.code, "khaled", "another-temp-2")).response.status).toBe(200);
  });

  it("answers field errors, conflicts and the last-admin guard", async () => {
    const invalid = await POST(json(admin.cookie, { name: "", username: "x", password: "1" }));
    expect(invalid.status).toBe(400);
    const body = (await invalid.json()) as { errors: { path: string }[] };
    expect(body.errors.map((error) => error.path).sort()).toEqual(["name", "password", "username"]);

    const taken = await POST(
      json(admin.cookie, { name: "x", username: "users_admin", password: "temporary-1" }),
    );
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: "USERNAME_TAKEN" });

    const lastAdmin = await PATCH(
      json(admin.cookie, { disabled: true }, "PATCH"),
      params(admin.userId),
    );
    expect(lastAdmin.status).toBe(409);
    expect(await lastAdmin.json()).toEqual({ error: "LAST_ADMIN" });

    const missing = await PATCH(json(admin.cookie, { name: "x" }, "PATCH"), params("nobody"));
    expect(missing.status).toBe(404);
  });

  it("is for admins only", async () => {
    const teacher = await createSignedInMember(admin, { username: "users_teacher" });
    // Past the first-login password change, a teacher is still refused.
    await membersCollection(db).updateOne(
      { _id: teacher.userId },
      { $set: { mustChangePassword: false } },
    );
    const refused = await GET(new Request(BASE, { headers: { cookie: teacher.cookie } }));
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "FORBIDDEN" });

    const other = await createSignedInTeacher("users_other_admin");
    const anotherCenter = await PATCH(
      json(other.cookie, { name: "x" }, "PATCH"),
      params(teacher.userId),
    );
    expect(anotherCenter.status).toBe(404);
  });
});
