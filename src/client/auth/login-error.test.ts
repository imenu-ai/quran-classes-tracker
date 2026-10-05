import { describe, expect, it } from "vitest";
import { getLoginErrorKey } from "./login-error";

describe("getLoginErrorKey", () => {
  it("treats wrong credentials and invalid usernames the same", () => {
    expect(getLoginErrorKey({ status: 401 }, true)).toBe("invalidCredentials");
    expect(getLoginErrorKey({ status: 422 }, true)).toBe("invalidCredentials");
  });

  it("reports rate limiting", () => {
    expect(getLoginErrorKey({ status: 429 }, true)).toBe("rateLimited");
  });

  it("reports offline when the device is offline or the request never got a response", () => {
    expect(getLoginErrorKey({ status: 401 }, false)).toBe("offline");
    expect(getLoginErrorKey({}, true)).toBe("offline");
    expect(getLoginErrorKey(null, true)).toBe("offline");
  });

  it("falls back to a generic error", () => {
    expect(getLoginErrorKey({ status: 500 }, true)).toBe("generic");
  });
});
