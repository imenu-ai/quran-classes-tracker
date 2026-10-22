import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetAuthForTests } from "@/server/auth/auth";
import { ensureIndexes } from "@/server/indexes";
import { MAX_PUSH_BATCH, type PullResponse, type PushResponse } from "@/shared/sync/protocol";
import { createSignedInMember, createSignedInTeacher } from "@/test/auth";
import { startTestMongo } from "@/test/mongo";
import { classRecord } from "@/test/records";
import { GET as pull } from "./pull/route";
import { POST as push } from "./push/route";

const BASE = "http://localhost:3000/api/sync";

describe("sync routes", () => {
  let stop: () => Promise<void>;
  let cookie: string;
  let tenantId: string;
  let code: string;

  const pushRequest = (body: string, headers: Record<string, string> = {}) =>
    new Request(`${BASE}/push`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie, ...headers },
      body,
    });

  beforeAll(async () => {
    const mongo = await startTestMongo();
    stop = mongo.stop;
    await ensureIndexes(mongo.db);
    resetAuthForTests();
    ({ cookie, tenantId, code } = await createSignedInTeacher("routes_teacher"));
  });

  afterAll(async () => {
    resetAuthForTests();
    await stop();
  });

  it("answers 401 without a session (and keeps nothing)", async () => {
    const noSession = await push(
      new Request(`${BASE}/push`, { method: "POST", body: JSON.stringify({ mutations: [] }) }),
    );
    expect(noSession.status).toBe(401);
    expect(await noSession.json()).toEqual({ error: "UNAUTHORIZED" });

    const pullNoSession = await pull(new Request(`${BASE}/pull?since=0`));
    expect(pullNoSession.status).toBe(401);
  });

  it("returns the user's accessVersion on push and pull", async () => {
    const pushed = (await (
      await push(pushRequest(JSON.stringify({ mutations: [] })))
    ).json()) as PushResponse;
    expect(pushed.accessVersion).toBe(1);
    const pulled = (await (
      await pull(new Request(`${BASE}/pull?since=0`, { headers: { cookie } }))
    ).json()) as PullResponse;
    expect(pulled.accessVersion).toBe(1);
  });

  it("answers 403 while the password an admin set hasn't been changed", async () => {
    const member = await createSignedInMember(
      { tenantId, code },
      { username: "routes_new_member", permissions: ["lessons.run"] },
    );
    const response = await pull(
      new Request(`${BASE}/pull?since=0`, { headers: { cookie: member.cookie } }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "PASSWORD_CHANGE_REQUIRED" });
  });

  it("answers 400 on malformed bodies and queries", async () => {
    expect((await push(pushRequest("{not json"))).status).toBe(400);
    expect((await push(pushRequest(JSON.stringify({ wrong: true })))).status).toBe(400);
    expect(
      (await push(pushRequest(JSON.stringify({ mutations: [{ table: "nope", record: {} }] }))))
        .status,
    ).toBe(400);
    expect((await pull(new Request(`${BASE}/pull?since=-1`, { headers: { cookie } }))).status).toBe(
      400,
    );
    expect(
      (await pull(new Request(`${BASE}/pull?limit=100000`, { headers: { cookie } }))).status,
    ).toBe(400);
  });

  it(`refuses more than ${MAX_PUSH_BATCH} mutations and oversized bodies`, async () => {
    const tooMany = Array.from({ length: MAX_PUSH_BATCH + 1 }, () => ({
      table: "classes",
      record: classRecord(),
    }));
    expect((await push(pushRequest(JSON.stringify({ mutations: tooMany })))).status).toBe(400);

    const huge = JSON.stringify({ mutations: [], padding: "x".repeat(1_100_000) });
    expect((await push(pushRequest(huge))).status).toBe(413);
  });

  it("pushes and pulls back the tenant's records", async () => {
    const record = classRecord();
    const pushed = await push(
      pushRequest(JSON.stringify({ mutations: [{ table: "classes", record }] })),
    );
    expect(pushed.status).toBe(200);
    expect(pushed.headers.get("cache-control")).toBe("no-store");
    const { results } = (await pushed.json()) as PushResponse;
    expect(results[0]).toMatchObject({ id: record.id, status: "applied" });

    const pulled = await pull(new Request(`${BASE}/pull?since=0`, { headers: { cookie } }));
    expect(pulled.status).toBe(200);
    const body = (await pulled.json()) as PullResponse;
    expect(body.changes.classes).toEqual([
      expect.objectContaining({ id: record.id, tenantId, name: record.name }),
    ]);
    expect(body.hasMore).toBe(false);
  });
});
