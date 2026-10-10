import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetAuthForTests } from "@/server/auth/auth";
import { ensureIndexes } from "@/server/indexes";
import { meResponseSchema } from "@/shared/session";
import { PERMISSIONS } from "@/shared/access";
import { createSignedInMember, createSignedInTeacher } from "@/test/auth";
import { startTestMongo } from "@/test/mongo";
import { GET } from "./route";

describe("GET /api/me", () => {
  let stop: () => Promise<void>;

  beforeAll(async () => {
    const mongo = await startTestMongo();
    stop = mongo.stop;
    await ensureIndexes(mongo.db);
    resetAuthForTests();
  });

  afterAll(async () => {
    resetAuthForTests();
    await stop();
  });

  it("answers 401 without a session", async () => {
    expect((await GET(new Request("http://localhost:3000/api/me"))).status).toBe(401);
  });

  it("returns the admin, his access and the center settings", async () => {
    const { cookie, tenantId, userId, code } = await createSignedInTeacher(
      "me_teacher",
      "مركز الهدى",
    );
    const response = await GET(
      new Request("http://localhost:3000/api/me", { headers: { cookie } }),
    );
    expect(response.status).toBe(200);
    const body = meResponseSchema.parse(await response.json());
    expect(body).toEqual({
      user: {
        id: userId,
        name: "me_teacher",
        username: "me_teacher",
        phone: "",
        email: expect.stringMatching(/@example\.test$/),
        locale: "ar",
        role: "admin",
        permissions: [...PERMISSIONS],
        classIds: [],
        mustChangePassword: false,
        accessVersion: 1,
      },
      tenant: { id: tenantId, name: "مركز الهدى", code, timezone: "Asia/Hebron" },
    });
  });

  it("returns a teacher's access, without an email", async () => {
    const center = await createSignedInTeacher("me_admin");
    const { cookie } = await createSignedInMember(center, {
      username: "me_member",
      phone: "0599",
      permissions: ["lessons.run"],
    });
    const response = await GET(
      new Request("http://localhost:3000/api/me", { headers: { cookie } }),
    );
    const body = meResponseSchema.parse(await response.json());
    expect(body.user).toMatchObject({
      username: "me_member",
      phone: "0599",
      email: null,
      role: "teacher",
      permissions: ["lessons.run"],
      mustChangePassword: true,
    });
  });
});
