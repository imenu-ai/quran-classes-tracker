import { describe, expect, it } from "vitest";
import { clampUpdatedAt, isNewer, MAX_CLOCK_SKEW_MS, shouldApplyIncoming } from "./lww";

const at = (updatedAt: number, updatedBy = "device-a") => ({ updatedAt, updatedBy });

describe("isNewer", () => {
  it("a later updatedAt wins", () => {
    expect(isNewer(at(2), at(1))).toBe(true);
    expect(isNewer(at(1), at(2))).toBe(false);
  });

  it("breaks an exact tie by device id, the same way in both directions", () => {
    expect(isNewer(at(5, "device-b"), at(5, "device-a"))).toBe(true);
    expect(isNewer(at(5, "device-a"), at(5, "device-b"))).toBe(false);
  });

  it("treats an identical write (a retry) as not newer", () => {
    expect(isNewer(at(5, "device-a"), at(5, "device-a"))).toBe(false);
  });

  it("deletes and edits follow the same rule", () => {
    const deleted = { ...at(10), deletedAt: 10 };
    const editedBefore = { ...at(9), deletedAt: null };
    const editedAfter = { ...at(11), deletedAt: null };
    expect(isNewer(deleted, editedBefore)).toBe(true); // delete wins over an older edit
    expect(isNewer(editedAfter, deleted)).toBe(true); // a later edit wins over the delete
  });
});

describe("shouldApplyIncoming", () => {
  it("applies when there is no local copy", () => {
    expect(shouldApplyIncoming(undefined, at(1), false)).toBe(true);
  });

  it("applies the server copy when there is no pending local change, even if older", () => {
    expect(shouldApplyIncoming(at(5), at(3), false)).toBe(true);
  });

  it("keeps a pending local edit that is newer", () => {
    expect(shouldApplyIncoming(at(5), at(3), true)).toBe(false);
  });

  it("replaces a pending local edit with a newer server copy", () => {
    expect(shouldApplyIncoming(at(5), at(6), true)).toBe(true);
  });

  it("keeps the pending local edit on an identical timestamp from the same device", () => {
    expect(shouldApplyIncoming(at(5), at(5), true)).toBe(false);
  });
});

describe("clampUpdatedAt", () => {
  it("leaves normal timestamps alone", () => {
    expect(clampUpdatedAt(1_000, 1_000)).toBe(1_000);
    expect(clampUpdatedAt(500, 1_000)).toBe(500);
  });

  it("caps timestamps from a clock set too far ahead", () => {
    expect(clampUpdatedAt(1_000 + MAX_CLOCK_SKEW_MS + 1, 1_000)).toBe(1_000 + MAX_CLOCK_SKEW_MS);
  });
});
