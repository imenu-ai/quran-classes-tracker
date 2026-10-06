import Dexie, { type EntityTable } from "dexie";
import { v7 as uuidv7 } from "uuid";
import { meResponseSchema, type MeResponse } from "@/shared/session";
import type { Locale } from "@/i18n/config";
import type { LocalDb } from "../db/dexie";

/**
 * What the device remembers about the signed-in teacher. This is what keeps
 * the app usable offline: the client gate checks it, not the server.
 */
export interface SessionSnapshot {
  userId: string;
  tenantId: string;
  name: string;
  username: string;
  locale: Locale;
  tenantName: string;
  timezone: string;
  savedAt: number;
}

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

/** The saved session, or null when nobody is signed in on this device. */
export async function readSession(): Promise<SessionSnapshot | null> {
  const row = await getAppDb().device.get(SESSION_KEY);
  return (row?.value as SessionSnapshot | undefined) ?? null;
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

export function snapshotFromMe(me: MeResponse, now: number): SessionSnapshot {
  return {
    userId: me.user.id,
    tenantId: me.tenant.id,
    name: me.user.name,
    username: me.user.username,
    locale: me.user.locale,
    tenantName: me.tenant.name,
    timezone: me.tenant.timezone,
    savedAt: now,
  };
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

/**
 * Forgets the teacher on this device: removes the snapshot and deletes their
 * local database. Callers must warn first when changes are still unsynced.
 */
export async function forgetDevice(db: LocalDb): Promise<void> {
  // Delete through the open instance so its own connection doesn't block the delete.
  await db.delete();
  await clearSession();
}
