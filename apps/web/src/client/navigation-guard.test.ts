// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openLocalDb, type LocalDb } from "./db/dexie";
import { LocalStore } from "./db/local-store";
import { attachNavigationGuard } from "./navigation-guard";

describe("navigation guard", () => {
  let db: LocalDb;
  let store: LocalStore;
  let detach: () => void;
  const navigate = vi.fn();

  beforeEach(() => {
    db = openLocalDb(`guard-${crypto.randomUUID()}`);
    store = new LocalStore(db, { tenantId: "t1", deviceId: "d1" });
    detach = attachNavigationGuard(store, navigate);
    document.body.innerHTML = `<a id="in" href="/class?id=1">back</a><a id="out" href="https://example.com/">out</a>`;
  });

  afterEach(async () => {
    detach();
    navigate.mockReset();
    await db.delete();
  });

  const click = (id: string) => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    document.getElementById(id)!.dispatchEvent(event);
    return event;
  };

  it("lets links through when nothing is being saved", async () => {
    await new Promise((resolve) => setTimeout(resolve, 200)); // past the busy window
    expect(click("in").defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("holds an in-app link until a write in flight is saved, then navigates", async () => {
    const writing = store.create("classes", { name: "A", archivedAt: null });
    const event = click("in");
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    await writing;
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith("/class?id=1"));
    expect(await db.classes.count()).toBe(1);
  });

  it("never holds links to other sites", async () => {
    const writing = store.create("classes", { name: "A", archivedAt: null });
    expect(click("out").defaultPrevented).toBe(false);
    await writing;
  });
});
