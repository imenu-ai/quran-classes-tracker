import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestMongo } from "@/test/mongo";
import { COLLECTIONS } from "../collections";
import { ensureIndexes } from "../indexes";
import { getAuth, resetAuthForTests, SESSION_EXPIRES_IN, SIGN_IN_RATE_LIMIT } from "./auth";
import { hashPassword } from "./password";

const BASE = "http://localhost:3000/api/auth";
const PASSWORD = "correct-horse-battery";
let ipCounter = 0;

/** Each test signs in from its own IP so rate limits don't leak between tests. */
function signIn(body: unknown, ip: string) {
  return getAuth().handler(
    new Request(`${BASE}/sign-in/username`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("Better Auth (username + password)", () => {
  let stop: () => Promise<void>;
  let ip: string;

  beforeAll(async () => {
    const mongo = await startTestMongo();
    stop = mongo.stop;
    await ensureIndexes(mongo.db);
    resetAuthForTests();

    const ctx = await getAuth().$context;
    const user = await ctx.internalAdapter.createUser(
      {
        name: "الأستاذ أحمد",
        email: "test-teacher@users.invalid",
        username: "Teacher",
        tenantId: "tenant-a",
      },
      { method: "admin" },
    );
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await hashPassword(PASSWORD),
    });
  });

  afterAll(async () => {
    resetAuthForTests();
    await stop();
  });

  beforeEach(() => {
    ipCounter += 1;
    ip = `203.0.113.${ipCounter}`;
  });

  it("signs in with the right password and sets a long-lived httpOnly session cookie", async () => {
    const response = await signIn({ username: "teacher", password: PASSWORD }, ip);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { user: Record<string, unknown> };
    expect(body.user).toMatchObject({ username: "teacher", tenantId: "tenant-a", locale: "ar" });

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/qct\.session_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(new RegExp(`Max-Age=${SESSION_EXPIRES_IN}`));
    // The user's locale is copied into the locale cookie at login.
    expect(cookie).toMatch(/NEXT_LOCALE=ar/);
  });

  it("normalizes the username (case-insensitive)", async () => {
    const response = await signIn({ username: "TEACHER", password: PASSWORD }, ip);
    expect(response.status).toBe(200);
  });

  it("rejects a wrong password with 401", async () => {
    const response = await signIn({ username: "teacher", password: "wrong-password" }, ip);
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie") ?? "").not.toMatch(/NEXT_LOCALE/);
  });

  it("rejects an unknown username with the same 401", async () => {
    const response = await signIn({ username: "nobody", password: PASSWORD }, ip);
    expect(response.status).toBe(401);
  });

  it(`rate-limits sign-in after ${SIGN_IN_RATE_LIMIT.max} attempts per window`, async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= SIGN_IN_RATE_LIMIT.max; attempt++) {
      statuses.push((await signIn({ username: "teacher", password: "wrong" }, ip)).status);
    }
    expect(statuses.slice(0, SIGN_IN_RATE_LIMIT.max).every((status) => status === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);

    // The limit is stored in MongoDB, so it holds across server instances.
    const db = (await import("../db")).getDb();
    expect(await db.collection(COLLECTIONS.rateLimits).countDocuments()).toBeGreaterThan(0);
  });

  it("disables the email sign-in and sign-up endpoints", async () => {
    for (const path of ["/sign-in/email", "/sign-up/email"]) {
      const response = await getAuth().handler(
        new Request(`${BASE}${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({
            email: "test-teacher@users.invalid",
            password: PASSWORD,
            name: "x",
          }),
        }),
      );
      expect(response.status, path).toBe(404);
    }
  });

  it("stores the password as an argon2id hash", async () => {
    const db = (await import("../db")).getDb();
    const account = await db.collection(COLLECTIONS.authAccounts).findOne({});
    expect(String(account?.password)).toMatch(/^\$argon2id\$/);
  });
});
