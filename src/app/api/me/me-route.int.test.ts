import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetAuthForTests } from "@/server/auth/auth";
import { ensureIndexes } from "@/server/indexes";
import { meResponseSchema } from "@/shared/session";
import { createSignedInTeacher } from "@/test/auth";
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

  it("returns the teacher and tenant settings", async () => {
    const { cookie, tenantId, userId } = await createSignedInTeacher("me_teacher", "مركز الهدى");
    const response = await GET(
      new Request("http://localhost:3000/api/me", { headers: { cookie } }),
    );
    expect(response.status).toBe(200);
    const body = meResponseSchema.parse(await response.json());
    expect(body).toEqual({
      user: { id: userId, name: "me_teacher", username: "me_teacher", locale: "ar" },
      tenant: { id: tenantId, name: "مركز الهدى", timezone: "Asia/Hebron" },
    });
  });
});
