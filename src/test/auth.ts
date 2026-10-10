import { createCenter, createMember } from "@/server/centers";
import { getAuth } from "@/server/auth/auth";
import { composeUsername, type CreateMemberInput } from "@/shared/access";

export const TEST_PASSWORD = "test-password-123";

let counter = 0;

/** Signs in through Better Auth; returns the session cookie for test requests. */
export async function signIn(code: string, username: string, password = TEST_PASSWORD) {
  counter += 1;
  const response = await getAuth().handler(
    new Request("http://localhost:3000/api/auth/sign-in/username", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": `198.18.${Math.floor(counter / 250)}.${(counter % 250) + 1}`,
      },
      body: JSON.stringify({ username: composeUsername(code, username), password }),
    }),
  );
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { response, cookie };
}

/**
 * Creates a center whose admin is `username`, and signs him in. Admins can do
 * everything, so tests that don't care about roles use this.
 */
export async function createSignedInTeacher(username: string, centerName = `center-${username}`) {
  counter += 1;
  const center = await createCenter({
    centerName,
    timezone: "Asia/Hebron",
    adminName: username,
    email: `${username}-${counter}@example.test`,
    username,
    password: TEST_PASSWORD,
  });
  const { cookie } = await signIn(center.code, username);
  return { cookie, tenantId: center.tenantId, userId: center.userId, code: center.code };
}

/** Adds a member to an existing center (as its admin would) and signs him in. */
export async function createSignedInMember(
  center: { tenantId: string; code: string },
  input: Omit<CreateMemberInput, "password" | "name"> & { name?: string },
) {
  const member = await createMember(center.tenantId, {
    name: input.name ?? input.username,
    password: TEST_PASSWORD,
    ...input,
  });
  const { cookie } = await signIn(center.code, input.username);
  return { cookie, userId: member.userId };
}
