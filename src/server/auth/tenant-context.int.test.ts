import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";
import { getAuth, resetAuthForTests } from "./auth";
import { hashPassword } from "./password";
import { getTenantContext, withTenant } from "./tenant-context";

const PASSWORD = "correct-horse-battery";

describe("tenant context", () => {
  let stop: () => Promise<void>;
  let sessionCookie: string;

  beforeAll(async () => {
    const mongo = await startTestMongo();
    stop = mongo.stop;
    resetAuthForTests();

    const ctx = await getAuth().$context;
    const user = await ctx.internalAdapter.createUser(
      { name: "T", email: "ctx@users.invalid", username: "ctxteacher", tenantId: "tenant-ctx" },
      { method: "admin" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await hashPassword(PASSWORD),
    });

    const response = await getAuth().handler(
      new Request("http://localhost:3000/api/auth/sign-in/username", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "x-forwarded-for": "198.51.100.7",
        },
        body: JSON.stringify({ username: "ctxteacher", password: PASSWORD }),
      }),
    );
    sessionCookie = (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  });

  afterAll(async () => {
    resetAuthForTests();
    await stop();
  });

  it("returns null without a session", async () => {
    expect(await getTenantContext(new Headers())).toBeNull();
  });

  it("returns the user's tenant with a valid session cookie", async () => {
    const context = await getTenantContext(new Headers({ cookie: sessionCookie }));
    expect(context).toMatchObject({ tenantId: "tenant-ctx" });
    expect(context?.repos.classes.tenantId).toBe("tenant-ctx");
  });

  it("withTenant answers 401 without a session and runs the handler with one", async () => {
    const handler = withTenant(async (_request, context) => Response.json(context.tenantId));

    const anonymous = await handler(new Request("http://localhost:3000/api/x"));
    expect(anonymous.status).toBe(401);

    const signedIn = await handler(
      new Request("http://localhost:3000/api/x", { headers: { cookie: sessionCookie } }),
    );
    expect(await signedIn.json()).toBe("tenant-ctx");
  });
});
