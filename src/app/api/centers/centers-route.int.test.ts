import type { Db } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAuth, resetAuthForTests } from "@/server/auth/auth";
import { COLLECTIONS } from "@/server/collections";
import { ensureIndexes } from "@/server/indexes";
import { consumeRateLimit } from "@/server/rate-limit";
import { startTestMongo } from "@/test/mongo";
import { POST, REGISTER_RATE_LIMIT } from "./route";

let ipCounter = 0;

function register(body: Record<string, unknown>, ip = `192.0.2.${++ipCounter}`) {
  return POST(
    new Request("http://localhost:3000/api/centers", {
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

const valid = () => ({
  centerName: "مركز الفرقان",
  timezone: "Asia/Hebron",
  adminName: "المدير",
  email: `admin-${crypto.randomUUID()}@example.test`,
  username: "Admin",
  password: "a-good-password",
});

describe("POST /api/centers", () => {
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

  it("registers the center, returns its code and signs the admin in", async () => {
    const response = await register(valid());
    expect(response.status).toBe(201);
    const body = (await response.json()) as { code: string; username: string };
    expect(body).toMatchObject({ centerName: "مركز الفرقان", username: "admin" });
    expect(body.code).toMatch(/^\d{6}$/);

    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const session = await getAuth().api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user).toMatchObject({ username: `${body.code}:admin` });
  });

  it("answers field error codes for invalid input", async () => {
    const response = await register({ ...valid(), email: "nope", username: "x" });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { errors: { path: string; code: string }[] };
    expect(body.errors.map((error) => error.path).sort()).toEqual(["email", "username"]);
  });

  it("answers 409 for an email that's already registered", async () => {
    const first = valid();
    expect((await register(first)).status).toBe(201);
    const response = await register({ ...valid(), email: first.email });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "EMAIL_TAKEN" });
  });

  it("refuses anything but JSON", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/centers", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "centerName=x",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("limits registrations per IP", async () => {
    const ip = "198.51.100.77";
    for (let i = 0; i < REGISTER_RATE_LIMIT.max; i += 1) {
      expect((await register(valid(), ip)).status).toBe(201);
    }
    expect((await register(valid(), ip)).status).toBe(429);
    // Another IP is unaffected.
    expect((await register(valid())).status).toBe(201);
  });
});

describe("consumeRateLimit", () => {
  let db: Db;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
    await ensureIndexes(db);
  });

  afterAll(async () => {
    await stop();
  });

  it("allows max requests per window, then starts a new window", async () => {
    const rule = { window: 60, max: 2 };
    expect(await consumeRateLimit(db, "k", rule, 1_000)).toBe(true);
    expect(await consumeRateLimit(db, "k", rule, 2_000)).toBe(true);
    expect(await consumeRateLimit(db, "k", rule, 3_000)).toBe(false);
    expect(await consumeRateLimit(db, "k", rule, 61_001 + 1_000)).toBe(true);
    expect(await db.collection(COLLECTIONS.rateLimits).findOne({ key: "app:k" })).toMatchObject({
      count: 1,
    });
  });
});
