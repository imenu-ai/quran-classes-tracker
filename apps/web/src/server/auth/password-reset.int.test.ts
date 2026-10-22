import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createSignedInMember, createSignedInTeacher, signIn } from "@/test/auth";
import { startTestMongo } from "@/test/mongo";
import { getDb } from "../db";
import { setEmailTransportForTests, type OutgoingEmail } from "../email";
import { ensureIndexes } from "../indexes";
import { getAuth, resetAuthForTests } from "./auth";

const BASE = "http://localhost:3000/api/auth";
let ipCounter = 0;

function post(path: string, body: unknown, cookie?: string) {
  ipCounter += 1;
  return getAuth().handler(
    new Request(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": `203.0.113.${ipCounter}`,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("password reset by email", () => {
  let stop: () => Promise<void>;
  const sent: OutgoingEmail[] = [];

  beforeAll(async () => {
    const mongo = await startTestMongo();
    stop = mongo.stop;
    await ensureIndexes(mongo.db);
    resetAuthForTests();
    setEmailTransportForTests(async (email) => {
      sent.push(email);
    });
  });

  afterEach(() => {
    sent.length = 0;
  });

  afterAll(async () => {
    setEmailTransportForTests(null);
    resetAuthForTests();
    await stop();
  });

  it("emails an admin a link that sets a new password and signs out his sessions", async () => {
    const admin = await createSignedInTeacher("reset_admin");
    const user = await getDb()
      .collection("users")
      .findOne({ username: `${admin.code}:reset_admin` });
    const email = String(user?.email);

    const requested = await post("/request-password-reset", {
      email,
      redirectTo: "/reset-password",
    });
    expect(requested.status).toBe(200);
    expect(sent).toHaveLength(1);
    const [message] = sent;
    expect(message).toMatchObject({ to: email });
    expect(message?.subject).toContain("استعادة كلمة المرور");
    expect(message?.html).toContain('dir="rtl"');

    const token = /reset-password\/([^?\s]+)/.exec(message?.text ?? "")?.[1];
    expect(token).toBeTruthy();
    const reset = await post("/reset-password", { newPassword: "a-new-password-9", token });
    expect(reset.status).toBe(200);

    expect(
      await getAuth().api.getSession({ headers: new Headers({ cookie: admin.cookie }) }),
    ).toBeNull();
    expect((await signIn(admin.code, "reset_admin", "a-new-password-9")).response.status).toBe(200);
    // The link works once.
    expect(
      (await post("/reset-password", { newPassword: "another-one-99", token })).status,
    ).not.toBe(200);
  });

  it("sends nothing for a teacher's placeholder address or an unknown email", async () => {
    const admin = await createSignedInTeacher("reset_admin_2");
    await createSignedInMember(admin, { username: "reset_teacher" });
    const teacher = await getDb()
      .collection("users")
      .findOne({ username: `${admin.code}:reset_teacher` });

    expect((await post("/request-password-reset", { email: String(teacher?.email) })).status).toBe(
      200,
    );
    expect((await post("/request-password-reset", { email: "nobody@example.test" })).status).toBe(
      200,
    );
    expect(sent).toHaveLength(0);
  });
});
