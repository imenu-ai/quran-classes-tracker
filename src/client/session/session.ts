import Dexie, { type EntityTable } from "dexie";
import { v7 as uuidv7 } from "uuid";
import type { Permission, Role } from "@/shared/access";
import { meResponseSchema, type MeResponse } from "@/shared/session";
import type { Locale } from "@/i18n/config";
import type { LocalDb } from "../db/dexie";

/**
 * What the device remembers about the signed-in user. This is what keeps the
 * app usable offline: the client gate checks it, not the server. Access here
 * only shapes the UI; the server enforces it on every sync.
 */
export interface SessionSnapshot {
  userId: string;
  tenantId: string;
  name: string;
  username: string;
  phone: string;
  /** Admins only. */
  email: string | null;
  locale: Locale;
  role: Role;
  permissions: Permission[];
  classIds: string[];
  mustChangePassword: boolean;
  accessVersion: number;
  tenantName: string;
  centerCode: string;
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

/**
 * The saved session, or null when nobody is signed in on this device. A
 * snapshot saved before centers and roles existed counts as signed out.
 */
export async function readSession(): Promise<SessionSnapshot | null> {
  const row = await getAppDb().device.get(SESSION_KEY);
  const snapshot = row?.value as Partial<SessionSnapshot> | undefined;
  if (!snapshot?.role || !snapshot.centerCode) return null;
  return snapshot as SessionSnapshot;
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
    phone: me.user.phone,
    email: me.user.email,
    locale: me.user.locale,
    role: me.user.role,
    permissions: me.user.permissions,
    classIds: me.user.classIds,
    mustChangePassword: me.user.mustChangePassword,
    accessVersion: me.user.accessVersion,
    tenantName: me.tenant.name,
    centerCode: me.tenant.code,
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

/** Where a signed-in user goes first: a user with an admin-set password must replace it. */
export const startPathFor = (snapshot: Pick<SessionSnapshot, "mustChangePassword">) =>
  snapshot.mustChangePassword ? "/change-password" : "/";

/**
 * Forgets the teacher on this device: removes the snapshot and deletes their
 * local database. Callers must warn first when changes are still unsynced.
 */
export async function forgetDevice(db: LocalDb): Promise<void> {
  // Delete through the open instance so its own connection doesn't block the delete.
  await db.delete();
  await clearSession();
}
