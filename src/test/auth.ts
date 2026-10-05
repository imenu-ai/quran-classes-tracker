import { createTeacherAccount } from "@/server/accounts";
import { getAuth } from "@/server/auth/auth";

let ipCounter = 0;

/**
 * Creates a teacher (and tenant) and signs in through Better Auth.
 * Returns the session cookie to send with test requests.
 */
export async function createSignedInTeacher(username: string, tenantName = `tenant-${username}`) {
  const password = "test-password-123";
  const account = await createTeacherAccount({ tenantName, username, password, name: username });
  ipCounter += 1;
  const response = await getAuth().handler(
    new Request("http://localhost:3000/api/auth/sign-in/username", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-forwarded-for": `198.18.0.${ipCounter}`,
      },
      body: JSON.stringify({ username, password }),
    }),
  );
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { cookie, tenantId: account.tenantId, userId: account.userId };
}
