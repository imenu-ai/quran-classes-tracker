import * as SQLite from "expo-sqlite";
import type { SqlDriver, SqlExecutor } from "@qct/core/data/sql-storage";

/** How long a write waits for another connection's lock before failing. */
const BUSY_TIMEOUT_MS = 5_000;

function executor(db: SQLite.SQLiteDatabase): SqlExecutor {
  return {
    all: (sql, params = []) => db.getAllAsync(sql, [...params]),
    run: async (sql, params = []) => {
      await db.runAsync(sql, [...params]);
    },
    exec: (sql) => db.execAsync(sql),
  };
}

export interface UserDatabaseFile {
  driver: SqlDriver;
  /** Closes the connection and keeps the file (another user signs in, the app moves on). */
  close(): Promise<void>;
}

/**
 * One database file per user (`qct-<userId>.db`), so signing in as someone
 * else never mixes data (PLAN.md §2.13). WAL lets screens read while a
 * transaction writes. `withExclusiveTransactionAsync` runs each transaction
 * on its own connection, so nothing outside it can join (unlike
 * `withTransactionAsync`); `busy_timeout` makes the connections wait for
 * each other instead of failing with "database is locked".
 */
export async function openUserDatabaseFile(userId: string): Promise<UserDatabaseFile> {
  const name = `qct-${userId}.db`;
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);
  let open = true;
  const close = async () => {
    if (!open) return;
    open = false;
    await db.closeAsync();
  };
  const driver: SqlDriver = {
    ...executor(db),
    async exclusiveTransaction(fn) {
      let result: Awaited<ReturnType<typeof fn>> | undefined;
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.execAsync(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
        result = await fn(executor(txn));
      });
      return result as Awaited<ReturnType<typeof fn>>;
    },
    async destroy() {
      await close();
      await SQLite.deleteDatabaseAsync(name);
    },
  };
  return { driver, close };
}
