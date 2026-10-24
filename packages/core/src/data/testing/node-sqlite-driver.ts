/// <reference types="node" />
import { DatabaseSync } from "node:sqlite";
import type { SqlDriver, SqlExecutor, SqlValue } from "../sql-storage";

/**
 * A SqlDriver on Node's built-in SQLite (in memory), so the SQLite adapter
 * runs the shared suites in Vitest with the same SQL as on the phone.
 */
export function createNodeSqliteDriver(): SqlDriver {
  const db = new DatabaseSync(":memory:");
  const executor: SqlExecutor = {
    async all<T>(sql: string, params: readonly SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
    async run(sql: string, params: readonly SqlValue[] = []) {
      db.prepare(sql).run(...params);
    },
    async exec(sql: string) {
      db.exec(sql);
    },
  };
  return {
    ...executor,
    async exclusiveTransaction(fn) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(executor);
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    async destroy() {
      if (db.isOpen) db.close();
    },
  };
}
