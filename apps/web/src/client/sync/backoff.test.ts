import { describe, expect, it } from "vitest";
import { BACKOFF_MAX_MS, backoffDelay } from "./backoff";

describe("backoffDelay", () => {
  it("doubles from 2 s, between half and the full delay", () => {
    const low = () => 0;
    const high = () => 1;
    expect([1, 2, 3, 4].map((n) => backoffDelay(n, low))).toEqual([1_000, 2_000, 4_000, 8_000]);
    expect([1, 2, 3, 4].map((n) => backoffDelay(n, high))).toEqual([2_000, 4_000, 8_000, 16_000]);
  });

  it("caps at 5 minutes", () => {
    expect(backoffDelay(30, () => 1)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelay(30, () => 0)).toBe(BACKOFF_MAX_MS / 2);
  });

  it("treats 0 failures like the first retry", () => {
    expect(backoffDelay(0, () => 1)).toBe(2_000);
  });
});
