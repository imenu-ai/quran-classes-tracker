import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSignedInMember, createSignedInTeacher } from "@/test/auth";
import { startTestMongo } from "@/test/mongo";
import { updateMember } from "../centers";
import { ensureIndexes } from "../indexes";
import { resetAuthForTests } from "./auth";
import { getTenantContext, withTenant } from "./tenant-context";

const request = (cookie?: string) =>
  new Request("http://localhost:3000/api/x", cookie ? { headers: { cookie } } : {});

describe("tenant context", () => {
  let stop: () => Promise<void>;
  let admin: Awaited<ReturnType<typeof createSignedInTeacher>>;

  beforeAll(async () => {
    const mongo = await startTestMongo();
    stop = mongo.stop;
    await ensureIndexes(mongo.db);
    resetAuthForTests();
    admin = await createSignedInTeacher("ctx_admin");
  });

  afterAll(async () => {
    resetAuthForTests();
    await stop();
  });

  it("returns null without a session", async () => {
    expect(await getTenantContext(new Headers())).toBeNull();
  });

  it("returns the user's tenant and access with a valid session cookie", async () => {
    const context = await getTenantContext(new Headers({ cookie: admin.cookie }));
    expect(context).toMatchObject({
      tenantId: admin.tenantId,
      userId: admin.userId,
      access: { role: "admin" },
      accessVersion: 1,
    });
    expect(context?.repos.classes.tenantId).toBe(admin.tenantId);
  });

  it("withTenant answers 401 without a session and runs the handler with one", async () => {
    const handler = withTenant(async (_request, context) => Response.json(context.tenantId));
    expect((await handler(request())).status).toBe(401);
    expect(await (await handler(request(admin.cookie))).json()).toBe(admin.tenantId);
  });

  it("asks for a password change before anything else, except where allowed", async () => {
    const teacher = await createSignedInMember(admin, { username: "ctx_new_teacher" });
    const handler = withTenant(async () => Response.json("ran"));
    const refused = await handler(request(teacher.cookie));
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "PASSWORD_CHANGE_REQUIRED" });

    const allowed = withTenant(async () => Response.json("ran"), {
      allowPendingPasswordChange: true,
    });
    expect(await (await allowed(request(teacher.cookie))).json()).toBe("ran");
  });

  it("refuses a disabled member", async () => {
    const teacher = await createSignedInMember(admin, { username: "ctx_disabled" });
    await updateMember(admin.tenantId, teacher.userId, { disabled: true });
    const handler = withTenant(async () => Response.json("ran"), {
      allowPendingPasswordChange: true,
    });
    // Disabling also ends his sessions, so the cookie no longer works at all.
    expect((await handler(request(teacher.cookie))).status).toBe(401);
  });
});
