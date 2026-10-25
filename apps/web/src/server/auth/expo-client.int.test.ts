import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as meRoute } from "@/app/api/me/route";
import { GET as pullRoute } from "@/app/api/sync/pull/route";
import { POST as pushRoute } from "@/app/api/sync/push/route";
import { createCenter } from "@/server/centers";
import { COLLECTIONS } from "@/server/collections";
import { getDb } from "@/server/db";
import { ensureIndexes } from "@/server/indexes";
import { startTestMongo } from "@/test/mongo";
import { TEST_PASSWORD } from "@/test/auth";
import { composeUsername, MOBILE_APP_SCHEME } from "@qct/core/shared/access";
import { classRecord } from "@qct/core/test/records";
import { getAuth, resetAuthForTests, SESSION_EXPIRES_IN } from "./auth";

/**
 * The mobile app's Better Auth client (the Expo plugin) has no browser
 * origin: it sends `expo-origin: <scheme>://`, keeps the session cookie in
 * secure storage, and sends it back in a `cookie` header. These tests act
 * like it against the real handlers.
 */
const APP_ORIGIN = `${MOBILE_APP_SCHEME}://`;
let ip = 0;

function authRequest(
  path: string,
  init: { body?: unknown; cookie?: string; origin?: string } = {},
) {
  ip += 1;
  const headers = new Headers({ "x-forwarded-for": `198.19.0.${ip}` });
  if (init.origin !== undefined) headers.set("expo-origin", init.origin);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);
  return getAuth().handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: init.body === undefined ? "GET" : "POST",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

/** The cookie header the app would send, from a response's set-cookie. */
const cookieFrom = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

const apiRequest = (path: string, cookie: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  return new Request(`http://localhost:3000${path}`, { ...init, headers });
};

describe("the mobile app's auth client (Expo plugin)", () => {
  let stop: () => Promise<void>;
  let center: Awaited<ReturnType<typeof createCenter>>;

  beforeAll(async () => {
    const mongo = await startTestMongo();
    stop = mongo.stop;
    await ensureIndexes(mongo.db);
    resetAuthForTests();
    center = await createCenter({
      centerName: "مركز التطبيق",
      timezone: "Asia/Hebron",
      adminName: "مدير",
      email: "app-admin@example.test",
      username: "app_admin",
      password: TEST_PASSWORD,
    });
  });

  afterAll(async () => {
    resetAuthForTests();
    await stop();
  });

  const signIn = (origin = APP_ORIGIN) =>
    authRequest("/sign-in/username", {
      origin,
      body: { username: composeUsername(center.code, "app_admin"), password: TEST_PASSWORD },
    });

  it("signs in from the app's origin and gets the session cookie", async () => {
    const response = await signIn();
    expect(response.status).toBe(200);
    expect(cookieFrom(response)).toMatch(/qct\.session_token=/);
  });

  it("uses the cookie header on our own routes: /api/me and sync", async () => {
    const cookie = cookieFrom(await signIn());

    const me = await meRoute(apiRequest("/api/me", cookie));
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      user: { username: "app_admin", role: "admin" },
      tenant: { code: center.code },
    });

    const cls = classRecord({ name: "حلقة من التطبيق" });
    const push = await pushRoute(
      apiRequest("/api/sync/push", cookie, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mutations: [{ table: "classes", record: cls }] }),
      }),
    );
    expect(push.status).toBe(200);
    expect((await push.json()).results[0]).toMatchObject({ id: cls.id, status: "applied" });

    const pull = await pullRoute(apiRequest("/api/sync/pull?since=0", cookie));
    expect(pull.status).toBe(200);
    expect((await pull.json()).changes.classes.map((c: { id: string }) => c.id)).toContain(cls.id);
  });

  it("renews the session on our own routes, and the renewed cookie works", async () => {
    const cookie = cookieFrom(await signIn());
    const token = decodeURIComponent(cookie.match(/qct\.session_token=([^.;]+)/)![1]!);

    // As if the session were last extended two days ago (it's renewed daily).
    const sessions = getDb().collection(COLLECTIONS.authSessions);
    const twoDaysAgo = Date.now() + SESSION_EXPIRES_IN * 1000 - 2 * 86_400_000;
    const updated = await sessions.updateOne(
      { token },
      { $set: { expiresAt: new Date(twoDaysAgo) } },
    );
    expect(updated.matchedCount).toBe(1);

    const me = await meRoute(apiRequest("/api/me", cookie));
    expect(me.status).toBe(200);
    const renewed = cookieFrom(me);
    expect(renewed).toMatch(/qct\.session_token=/);
    const session = await sessions.findOne({ token });
    expect(session!.expiresAt.getTime()).toBeGreaterThan(twoDaysAgo + 86_400_000);

    expect((await meRoute(apiRequest("/api/me", renewed))).status).toBe(200);
  });

  it("signs out: the cookie stops working", async () => {
    const cookie = cookieFrom(await signIn());
    const out = await authRequest("/sign-out", { origin: APP_ORIGIN, cookie, body: {} });
    expect(out.status).toBe(200);
    expect((await meRoute(apiRequest("/api/me", cookie))).status).toBe(401);
  });
});
