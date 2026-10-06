import { describe, expect, it } from "vitest";
import { getIndicator } from "./indicator";

describe("getIndicator", () => {
  it("connected when idle with nothing pending", () => {
    expect(getIndicator({ state: "idle", pending: 0, rejected: 0 })).toEqual({
      tone: "ok",
      messages: [{ key: "connected" }],
    });
  });

  it("offline, and how many changes wait to sync", () => {
    expect(getIndicator({ state: "offline", pending: 0, rejected: 0 })).toEqual({
      tone: "muted",
      messages: [{ key: "offline" }],
    });
    expect(getIndicator({ state: "offline", pending: 3, rejected: 0 }).messages).toEqual([
      { key: "offline" },
      { key: "pending", count: 3 },
    ]);
  });

  it("syncing", () => {
    expect(getIndicator({ state: "syncing", pending: 5, rejected: 0 })).toEqual({
      tone: "busy",
      messages: [{ key: "syncing" }],
    });
  });

  it("pending changes while idle (e.g. waiting for the debounce)", () => {
    expect(getIndicator({ state: "idle", pending: 2, rejected: 0 })).toEqual({
      tone: "busy",
      messages: [{ key: "pending", count: 2 }],
    });
  });

  it("an error shows the pending count, or a generic error when nothing is pending", () => {
    expect(getIndicator({ state: "error", pending: 4, rejected: 0 })).toEqual({
      tone: "warning",
      messages: [{ key: "pending", count: 4 }],
    });
    expect(getIndicator({ state: "error", pending: 0, rejected: 0 })).toEqual({
      tone: "warning",
      messages: [{ key: "error" }],
    });
  });

  it("asks to sign in again, still counting what's kept", () => {
    expect(getIndicator({ state: "needsLogin", pending: 7, rejected: 0 })).toEqual({
      tone: "danger",
      messages: [{ key: "needsLogin" }, { key: "pending", count: 7 }],
    });
  });

  it("flags rejected changes", () => {
    expect(getIndicator({ state: "idle", pending: 0, rejected: 1 })).toEqual({
      tone: "warning",
      messages: [{ key: "rejected", count: 1 }],
    });
  });
});
