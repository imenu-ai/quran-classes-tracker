import {
  attachSyncTriggers,
  PERIODIC_SYNC_MS,
  WRITE_DEBOUNCE_MS,
  type TriggerSources,
} from "./triggers";

function setup({ active = true } = {}) {
  const engine = { syncNow: jest.fn(async () => {}), markOffline: jest.fn() };
  const writeListeners = new Set<() => void>();
  const localWrites = {
    subscribe: (listener: () => void) => {
      writeListeners.add(listener);
      return () => writeListeners.delete(listener);
    },
  };
  let onActive: (() => void) | null = null;
  let onConnectivity: ((online: boolean) => void) | null = null;
  const state = { active };
  const sources: TriggerSources = {
    isActive: () => state.active,
    onActive: (listener) => {
      onActive = listener;
      return () => (onActive = null);
    },
    onConnectivity: (listener) => {
      onConnectivity = listener;
      return () => (onConnectivity = null);
    },
  };
  const detach = attachSyncTriggers(engine, localWrites, sources);
  return {
    engine,
    state,
    detach,
    write: () => writeListeners.forEach((listener) => listener()),
    foreground: () => onActive?.(),
    connectivity: (online: boolean) => onConnectivity?.(online),
    listenerCount: () => writeListeners.size + (onActive ? 1 : 0) + (onConnectivity ? 1 : 0),
  };
}

describe("mobile sync triggers", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("syncs at once, then after the app returns to the foreground", () => {
    const t = setup();
    expect(t.engine.syncNow).toHaveBeenCalledTimes(1);
    t.foreground();
    expect(t.engine.syncNow).toHaveBeenCalledTimes(2);
    t.detach();
  });

  it("waits for writes to settle before syncing them", () => {
    const t = setup();
    t.engine.syncNow.mockClear();
    t.write();
    jest.advanceTimersByTime(WRITE_DEBOUNCE_MS - 100);
    t.write();
    jest.advanceTimersByTime(WRITE_DEBOUNCE_MS - 100);
    expect(t.engine.syncNow).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(t.engine.syncNow).toHaveBeenCalledTimes(1);
    t.detach();
  });

  it("shows offline when the connection drops and syncs when it returns", () => {
    const t = setup();
    t.engine.syncNow.mockClear();
    t.connectivity(false);
    expect(t.engine.markOffline).toHaveBeenCalledTimes(1);
    expect(t.engine.syncNow).not.toHaveBeenCalled();
    t.connectivity(true);
    expect(t.engine.syncNow).toHaveBeenCalledTimes(1);
    t.detach();
  });

  it("syncs every minute, only in the foreground", () => {
    const t = setup();
    t.engine.syncNow.mockClear();
    jest.advanceTimersByTime(PERIODIC_SYNC_MS);
    expect(t.engine.syncNow).toHaveBeenCalledTimes(1);
    t.state.active = false;
    jest.advanceTimersByTime(PERIODIC_SYNC_MS * 3);
    expect(t.engine.syncNow).toHaveBeenCalledTimes(1);
    t.detach();
  });

  it("detaching removes every listener and timer", () => {
    const t = setup();
    t.write();
    t.detach();
    t.engine.syncNow.mockClear();
    expect(t.listenerCount()).toBe(0);
    jest.advanceTimersByTime(PERIODIC_SYNC_MS * 2);
    expect(t.engine.syncNow).not.toHaveBeenCalled();
  });
});
