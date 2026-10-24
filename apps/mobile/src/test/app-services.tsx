import type { ReactNode } from "react";
import { LocalDatabase } from "@qct/core/data/database";
import { LocalStore } from "@qct/core/data/local-store";
import { createMemoryStorage } from "@qct/core/data/memory-storage";
import { SyncEngine } from "@qct/core/data/sync/engine";
import type { SessionSnapshot } from "@qct/core/shared/session";
import { AppServicesProvider, type AppServices } from "@/data/app-data";
import { renderArabic } from "./render";

export const TEST_SESSION: SessionSnapshot = {
  userId: "u1",
  tenantId: "t1",
  name: "أحمد",
  username: "ahmad",
  phone: "",
  email: null,
  locale: "ar",
  role: "teacher",
  permissions: [],
  classIds: [],
  mustChangePassword: false,
  accessVersion: 1,
  tenantName: "مركز النور",
  centerCode: "482913",
  timezone: "Asia/Hebron",
  savedAt: 0,
};

/** A server that answers every sync request with this status (and an empty body). */
export const respondWith = (status: number) =>
  jest.fn(async () => ({ ok: status < 400, status, json: async () => ({}) }) as Response);

/** The real store and engine over the in-memory adapter, as the app wires them. */
export function createTestServices(options: { fetch?: typeof fetch } = {}): AppServices {
  const db = new LocalDatabase(createMemoryStorage());
  const store = new LocalStore(db, { tenantId: TEST_SESSION.tenantId, deviceId: "d1" });
  const engine = new SyncEngine({
    db,
    apiBaseUrl: "https://server.test",
    fetch: options.fetch ?? respondWith(503),
    // No retry timers left running after a test.
    timers: { set: () => null, clear: () => {} },
  });
  return { session: TEST_SESSION, db, store, engine, signOut: jest.fn(async () => {}) };
}

/** renderArabic, inside the signed-in user's services. */
export function renderWithApp(ui: ReactNode, services: AppServices = createTestServices()) {
  return renderArabic(<AppServicesProvider value={services}>{ui}</AppServicesProvider>);
}
