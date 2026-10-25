import { describe, expect, it } from "vitest";
import { apiResult, deletionErrorKey } from "./api";
import { sortCenterUsers, type CenterUser } from "./center-users";

describe("apiResult", () => {
  it("passes a success body through", () => {
    expect(apiResult(true, { userId: "u1" })).toEqual({ ok: true, value: { userId: "u1" } });
  });

  it("keeps known server codes and field errors", () => {
    const errors = [{ path: "username", code: "TOO_SHORT", params: { minimum: 3 } }];
    expect(apiResult(false, { error: "INVALID_INPUT", errors })).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      errors,
    });
  });

  it("keeps the deletion codes", () => {
    expect(apiResult(false, { error: "WRONG_PASSWORD" })).toMatchObject({ code: "WRONG_PASSWORD" });
    expect(apiResult(false, { error: "RATE_LIMITED" })).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("turns anything else into GENERIC", () => {
    expect(apiResult(false, { error: "SOMETHING_NEW" })).toEqual({
      ok: false,
      code: "GENERIC",
      errors: [],
    });
    expect(apiResult(false, null)).toEqual({ ok: false, code: "GENERIC", errors: [] });
  });
});

describe("deletionErrorKey", () => {
  it("names the message for each failure", () => {
    expect(deletionErrorKey("WRONG_PASSWORD")).toBe("wrongPassword");
    expect(deletionErrorKey("RATE_LIMITED")).toBe("rateLimited");
    expect(deletionErrorKey("LAST_ADMIN")).toBe("lastAdmin");
    expect(deletionErrorKey("OFFLINE")).toBe("offline");
    expect(deletionErrorKey("FORBIDDEN")).toBe("generic");
  });
});

describe("sortCenterUsers", () => {
  const user = (id: string, name: string, role: CenterUser["role"]): CenterUser => ({
    id,
    name,
    username: id,
    phone: "",
    role,
    permissions: [],
    classIds: [],
    disabled: false,
    mustChangePassword: false,
  });

  it("puts you first, then admins, then the rest by name", () => {
    const sorted = sortCenterUsers(
      [
        user("t2", "Zaid", "teacher"),
        user("t1", "Ali", "teacher"),
        user("a1", "Omar", "admin"),
        user("me", "Sami", "teacher"),
      ],
      "me",
    );
    expect(sorted.map((u) => u.id)).toEqual(["me", "a1", "t1", "t2"]);
  });
});
