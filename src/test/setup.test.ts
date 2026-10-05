import { describe, expect, it } from "vitest";
import { cn } from "@/test/alias-probe";

describe("test setup", () => {
  it("resolves the @/ path alias", () => {
    expect(cn("a", "b")).toBe("a b");
  });
});
