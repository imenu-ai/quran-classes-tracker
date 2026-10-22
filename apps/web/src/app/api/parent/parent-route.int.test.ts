import type { Db } from "mongodb";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@/server/collections";
import { ensureIndexes } from "@/server/indexes";
import { classRecord, studentRecord } from "@/test/records";
import { startTestMongo } from "@/test/mongo";
import { DELETE, POST } from "./route";

const cls = classRecord();
const student = studentRecord(cls.id, { fullName: "أحمد", parentId: "401234567" });
const cookieName = `qct_parent_${student.id}`;

function post(body: unknown, cookie?: string) {
  return POST(
    new NextRequest("https://app.test/api/parent", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.7",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("/api/parent", () => {
  let db: Db;
  let stop: () => Promise<void>;

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
    await ensureIndexes(db);
    await db
      .collection(COLLECTIONS.tenants)
      .insertOne({ _id: "t1" as never, name: "مركز", code: "100901", timezone: "Asia/Hebron" });
    for (const [collection, { id, ...fields }] of [
      [COLLECTIONS.classes, cls],
      [COLLECTIONS.students, student],
    ] as const) {
      await db.collection(collection).insertOne({ _id: id as never, ...fields, tenantId: "t1" });
    }
  });

  afterAll(async () => {
    await stop();
  });

  it("refuses anything but a valid JSON request", async () => {
    expect((await post({ studentId: student.id, month: "2026-13" })).status).toBe(400);
    const form = await POST(
      new NextRequest("https://app.test/api/parent", { method: "POST", body: "studentId=x" }),
    );
    expect(form.status).toBe(400);
  });

  it("sets a 30-day, HttpOnly cookie for the right number, which then opens the page", async () => {
    const response = await post({ studentId: student.id, parentId: "401234567" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(new RegExp(`^${cookieName}=[\\w-]+;`));
    for (const flag of [
      "Path=/api/parent",
      "Max-Age=2592000",
      "HttpOnly",
      "SameSite=Lax",
      "Secure",
    ]) {
      expect(setCookie).toContain(flag);
    }

    const token = setCookie.split(";")[0]!;
    const again = await post({ studentId: student.id }, token);
    expect(again.status).toBe(200);
    expect(((await again.json()) as { studentName: string }).studentName).toBe("أحمد");
  });

  it("answers a wrong number with 401 and no cookie", async () => {
    const response = await post({ studentId: student.id, parentId: "11111111" });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "WRONG_PARENT_ID" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("forgets the phone on DELETE", async () => {
    const response = await DELETE(
      new NextRequest(`https://app.test/api/parent?s=${student.id}`, { method: "DELETE" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(new RegExp(`^${cookieName}=; .*Max-Age=0`));
  });
});
