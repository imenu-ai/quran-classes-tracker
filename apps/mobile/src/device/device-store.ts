import * as SQLite from "expo-sqlite";
import { v7 as uuidv7 } from "uuid";
import { asSessionSnapshot, type SessionSnapshot } from "@qct/core/shared/session";

/**
 * What the device keeps outside any user's data (PLAN.md §2.13): the saved
 * session, this device's id and the last center code. One small key-value
 * table in qct-app.db; the user's own data gets its own database (2.7).
 */
let db: SQLite.SQLiteDatabase | null = null;

function database(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync("qct-app.db");
    db.execSync(
      "CREATE TABLE IF NOT EXISTS device (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
    );
  }
  return db;
}

function read(key: string): unknown {
  const row = database().getFirstSync<{ value: string }>("SELECT value FROM device WHERE key = ?", [
    key,
  ]);
  return row ? JSON.parse(row.value) : undefined;
}

function write(key: string, value: unknown): void {
  database().runSync("INSERT OR REPLACE INTO device (key, value) VALUES (?, ?)", [
    key,
    JSON.stringify(value),
  ]);
}

function remove(key: string): void {
  database().runSync("DELETE FROM device WHERE key = ?", [key]);
}

const SESSION_KEY = "session";
const DEVICE_ID_KEY = "deviceId";
const CENTER_CODE_KEY = "centerCode";

/** The saved session, or null when nobody is signed in on this device. */
export const readSession = (): SessionSnapshot | null => asSessionSnapshot(read(SESSION_KEY));
export const saveSession = (snapshot: SessionSnapshot) => write(SESSION_KEY, snapshot);
export const clearSession = () => remove(SESSION_KEY);

/** A stable random id for this device (breaks last-write-wins ties). */
export function getDeviceId(): string {
  const existing = read(DEVICE_ID_KEY);
  if (typeof existing === "string") return existing;
  const id = uuidv7();
  write(DEVICE_ID_KEY, id);
  return id;
}

/** The last center code used here, so teachers type it once. */
export function readRememberedCenterCode(): string {
  const code = read(CENTER_CODE_KEY);
  return typeof code === "string" ? code : "";
}

export const rememberCenterCode = (code: string) => write(CENTER_CODE_KEY, code);
