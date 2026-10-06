import { describe, expect, it } from "vitest";
import { getAccountErrorKey } from "./account-errors";

describe("getAccountErrorKey", () => {
  it("needs internet when offline or without a response", () => {
    expect(getAccountErrorKey({ status: 400, code: "X" }, false)).toBe("offline");
    expect(getAccountErrorKey(null, true)).toBe("offline");
  });

  it("maps Better Auth codes", () => {
    expect(getAccountErrorKey({ status: 422, code: "USERNAME_IS_ALREADY_TAKEN" }, true)).toBe(
      "usernameTaken",
    );
    expect(getAccountErrorKey({ status: 422, code: "USERNAME_TOO_SHORT" }, true)).toBe(
      "invalidUsername",
    );
    expect(getAccountErrorKey({ status: 400, code: "INVALID_PASSWORD" }, true)).toBe(
      "wrongPassword",
    );
    expect(getAccountErrorKey({ status: 401, code: "INVALID_PASSWORD" }, true)).toBe(
      "wrongPassword",
    );
    expect(getAccountErrorKey({ status: 400, code: "PASSWORD_TOO_SHORT" }, true)).toBe(
      "passwordLength",
    );
  });

  it("reports rate limiting, an expired session and anything else", () => {
    expect(getAccountErrorKey({ status: 429 }, true)).toBe("rateLimited");
    expect(getAccountErrorKey({ status: 401, code: "UNAUTHORIZED" }, true)).toBe("sessionExpired");
    expect(getAccountErrorKey({ status: 500 }, true)).toBe("generic");
  });
});
