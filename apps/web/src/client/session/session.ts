import Dexie, { type EntityTable } from "dexie";
import { v7 as uuidv7 } from "uuid";
import {
  asSessionSnapshot,
  meResponseSchema,
  snapshotFromMe,
  type SessionSnapshot,
} from "@qct/core/shared/session";
import type { LocalDatabase } from "@qct/core/data/database";

export { snapshotFromMe, type SessionSnapshot } from "@qct/core/shared/session";

interface KeyValue {
  key: string;
  value: unknown;
}

/** Device-level store (not per user): current session and this device's id. */
class AppDb extends Dexie {
  device!: EntityTable<KeyValue, "key">;

  constructor() {
    super("qct-app");
    this.version(1).stores({ device: "key" });
  }
}

let appDb: AppDb | null = null;
const getAppDb = () => (appDb ??= new AppDb());

const SESSION_KEY = "session";
const DEVICE_ID_KEY = "deviceId";

/**
 * The saved session, or null when nobody is signed in on this device. A
 * snapshot saved before centers and roles existed counts as signed out.
 */
export async function readSession(): Promise<SessionSnapshot | null> {
  return asSessionSnapshot((await getAppDb().device.get(SESSION_KEY))?.value);
}

export async function saveSession(snapshot: SessionSnapshot): Promise<void> {
  await getAppDb().device.put({ key: SESSION_KEY, value: snapshot });
}

export async function clearSession(): Promise<void> {
  await getAppDb().device.delete(SESSION_KEY);
}

/** A stable random id for this device (breaks last-write-wins ties). */
export async function getDeviceId(): Promise<string> {
  const db = getAppDb();
  return db.transaction("rw", db.device, async () => {
    const existing = (await db.device.get(DEVICE_ID_KEY))?.value;
    if (typeof existing === "string") return existing;
    const id = uuidv7();
    await db.device.put({ key: DEVICE_ID_KEY, value: id });
    return id;
  });
}

/**
 * After a successful sign-in: fetch who we are and remember it on the
 * device. The first sync (a full pull) starts when the app shell mounts.
 */
export async function bootstrapSession(fetchImpl: typeof fetch = fetch): Promise<SessionSnapshot> {
  const response = await fetchImpl("/api/me", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`GET /api/me failed with ${response.status}`);
  const snapshot = snapshotFromMe(meResponseSchema.parse(await response.json()), Date.now());
  await saveSession(snapshot);
  return snapshot;
}

/** Where a signed-in user goes first: a user with an admin-set password must replace it. */
export const startPathFor = (snapshot: Pick<SessionSnapshot, "mustChangePassword">) =>
  snapshot.mustChangePassword ? "/change-password" : "/";

/**
 * Forgets the teacher on this device: removes the snapshot and deletes their
 * local database. Callers must warn first when changes are still unsynced.
 */
export async function forgetDevice(db: LocalDatabase): Promise<void> {
  await db.destroy();
  await clearSession();
}
