import { describe, expect, it } from "vitest";
import {
  can,
  canSeeClass,
  composeUsername,
  isCompositeUsername,
  localUsernameOf,
  registerCenterSchema,
} from "./access";
import { parseWithCodes } from "./schemas/errors";

describe("access", () => {
  const teacher = {
    role: "teacher" as const,
    permissions: ["lessons.run" as const],
    classIds: ["c1"],
  };
  const admin = { role: "admin" as const, permissions: [], classIds: [] };

  it("gives admins every permission and class", () => {
    expect(can(admin, "classes.manage")).toBe(true);
    expect(canSeeClass(admin, "any")).toBe(true);
  });

  it("limits teachers to their permissions and classes", () => {
    expect(can(teacher, "lessons.run")).toBe(true);
    expect(can(teacher, "students.manage")).toBe(false);
    expect(canSeeClass(teacher, "c1")).toBe(true);
    expect(canSeeClass(teacher, "c2")).toBe(false);
  });

  it("composes and splits per-center usernames", () => {
    expect(composeUsername("482913", " Ahmad ")).toBe("482913:ahmad");
    expect(localUsernameOf("482913:ahmad")).toBe("ahmad");
    expect(isCompositeUsername("482913:ahmad")).toBe(true);
    expect(isCompositeUsername("ahmad")).toBe(false);
    expect(isCompositeUsername("48291:ahmad")).toBe(false);
  });

  it("reports an empty email as required, a malformed one as invalid", () => {
    const base = {
      centerName: "c",
      timezone: "Asia/Hebron",
      adminName: "a",
      username: "admin",
      password: "a-good-password",
    };
    const codeFor = (email: string) => {
      const result = parseWithCodes(registerCenterSchema, { ...base, email });
      return result.success ? null : result.errors.find((e) => e.path === "email")?.code;
    };
    expect(codeFor("")).toBe("REQUIRED");
    expect(codeFor("nope")).toBe("INVALID_FORMAT");
    expect(codeFor("Admin@Example.com")).toBeNull();
  });
});
