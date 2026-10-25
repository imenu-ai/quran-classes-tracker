import {
  LOCAL_TABLES,
  TABLE_SCHEMA,
  type IndexKey,
  type IndexQuery,
  type LocalRecord,
  type LocalTable,
  type StorageAdapter,
  type StorageReader,
  type StorageWriter,
} from "./storage";

export type SqlValue = string | number | null;

/** What the adapter needs from a SQLite connection (expo-sqlite in the app, node:sqlite in tests). */
export interface SqlExecutor {
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  exec(sql: string): Promise<void>;
}

export interface SqlDriver extends SqlExecutor {
  /** Runs `fn` in an exclusive write transaction; rolls it back if `fn` throws. */
  exclusiveTransaction<R>(fn: (tx: SqlExecutor) => Promise<R>): Promise<R>;
  /** Closes the connection and deletes the database. */
  destroy(): Promise<void>;
}

/**
 * Each table stores the record as JSON plus one column per indexed field
 * (`f_<field>`), so queries run on SQL indexes. Index columns have no
 * declared type: SQLite then keeps numbers as numbers and strings as strings,
 * and orders numbers before strings, like IndexedDB.
 */
const fieldsOf = (index: string) =>
  index.startsWith("[") ? index.slice(1, -1).split("+") : [index];

const column = (field: string) => `f_${field}`;

const fieldsByTable = new Map(
  LOCAL_TABLES.map((table) => [
    table,
    [...new Set((TABLE_SCHEMA[table].indexes as readonly string[]).flatMap(fieldsOf))],
  ]),
);

/** Schema migrations, in order; `PRAGMA user_version` records how many ran. */
const MIGRATIONS: readonly string[] = [
  LOCAL_TABLES.map((table) => {
    const fields = fieldsByTable.get(table)!;
    const columns = ["k TEXT PRIMARY KEY NOT NULL", "data TEXT NOT NULL", ...fields.map(column)];
    const indexes = (TABLE_SCHEMA[table].indexes as readonly string[]).map(
      (index) =>
        `CREATE INDEX ${table}_${fieldsOf(index).join("_")} ON ${table} (${fieldsOf(index).map(column).join(", ")});`,
    );
    return [`CREATE TABLE ${table} (${columns.join(", ")});`, ...indexes].join("\n");
  }).join("\n"),
];

/** Rows per multi-row INSERT and keys per IN list (a first sync writes thousands). */
const CHUNK = 100;

const chunks = <T>(items: readonly T[]) =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK),
  );

const isKeyPart = (value: unknown): value is string | number =>
  typeof value === "string" || (typeof value === "number" && !Number.isNaN(value));

const placeholders = (count: number) => Array.from({ length: count }, () => "?").join(", ");

function rowValues(table: LocalTable, record: Record<string, unknown>): SqlValue[] {
  const key = record[TABLE_SCHEMA[table].key];
  if (typeof key !== "string") throw new Error(`A ${table} record needs a string key`);
  const fields = fieldsByTable.get(table)!.map((field) => {
    const value = record[field];
    return isKeyPart(value) ? value : null;
  });
  return [key, JSON.stringify(record), ...fields];
}

/** WHERE and ORDER BY for an index query; records without a value for the index never match. */
function indexClause(index: string, query: IndexQuery): { where: string; params: SqlValue[] } {
  const columns = fieldsOf(index).map(column);
  const tuple = columns.length === 1 ? columns[0]! : `(${columns.join(", ")})`;
  const parts = (key: IndexKey): SqlValue[] => (Array.isArray(key) ? [...key] : [key as SqlValue]);
  const one = `(${placeholders(columns.length)})`;
  const notNull = columns.map((name) => `${name} IS NOT NULL`).join(" AND ");
  let condition: string;
  let params: SqlValue[];
  if ("equals" in query) {
    condition = columns.length === 1 ? `${tuple} = ?` : `${tuple} = ${one}`;
    params = parts(query.equals);
  } else if ("anyOf" in query) {
    if (query.anyOf.length === 0) return { where: "0", params: [] };
    const values = query.anyOf.map(() => (columns.length === 1 ? "?" : one)).join(", ");
    condition = columns.length === 1 ? `${tuple} IN (${values})` : `${tuple} IN (VALUES ${values})`;
    params = query.anyOf.flatMap(parts);
  } else {
    const bound = columns.length === 1 ? "?" : one;
    condition = `${tuple} BETWEEN ${bound} AND ${bound}`;
    params = [...parts(query.between[0]), ...parts(query.between[1])];
  }
  return { where: `${notNull} AND ${condition}`, params };
}

function reader(sql: SqlExecutor): StorageReader {
  const records = <T extends LocalTable>(rows: { data: string }[]) =>
    rows.map((row) => JSON.parse(row.data) as LocalRecord<T>);
  return {
    async get(table, key) {
      const rows = await sql.all<{ data: string }>(`SELECT data FROM ${table} WHERE k = ?`, [key]);
      return rows[0] && (JSON.parse(rows[0].data) as LocalRecord<typeof table>);
    },
    async bulkGet(table, keys) {
      const found = new Map<string, LocalRecord<typeof table>>();
      for (const part of chunks([...new Set(keys)])) {
        const rows = await sql.all<{ k: string; data: string }>(
          `SELECT k, data FROM ${table} WHERE k IN (${placeholders(part.length)})`,
          part,
        );
        for (const row of rows) found.set(row.k, JSON.parse(row.data));
      }
      return keys.map((key) => found.get(key));
    },
    async query(table, index, query) {
      const { where, params } = indexClause(index, query);
      const order = [...fieldsOf(index).map(column), "k"].join(", ");
      return records(
        await sql.all(`SELECT data FROM ${table} WHERE ${where} ORDER BY ${order}`, params),
      );
    },
    async all(table) {
      return records(await sql.all(`SELECT data FROM ${table} ORDER BY k`));
    },
    async count(table) {
      const rows = await sql.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      return Number(rows[0]?.n ?? 0);
    },
  };
}

function writer(sql: SqlExecutor): StorageWriter {
  const insert = async (table: LocalTable, rows: readonly Record<string, unknown>[]) => {
    const width = 2 + fieldsByTable.get(table)!.length;
    const names = ["k", "data", ...fieldsByTable.get(table)!.map(column)].join(", ");
    for (const part of chunks(rows)) {
      const values = part.map(() => `(${placeholders(width)})`).join(", ");
      await sql.run(
        `INSERT OR REPLACE INTO ${table} (${names}) VALUES ${values}`,
        part.flatMap((row) => rowValues(table, row)),
      );
    }
  };
  const remove = async (table: LocalTable, keys: readonly string[]) => {
    for (const part of chunks(keys)) {
      await sql.run(`DELETE FROM ${table} WHERE k IN (${placeholders(part.length)})`, part);
    }
  };
  return {
    ...reader(sql),
    put: (table, record) => insert(table, [record as Record<string, unknown>]),
    bulkPut: (table, records) => insert(table, records as readonly Record<string, unknown>[]),
    delete: (table, key) => remove(table, [key]),
    bulkDelete: (table, keys) => remove(table, keys),
  };
}

/** Brings the database's schema up to date (runs at open; safe to rerun). */
async function migrate(driver: SqlDriver): Promise<void> {
  const [row] = await driver.all<{ user_version: number }>("PRAGMA user_version");
  const done = Number(row?.user_version ?? 0);
  for (let version = done; version < MIGRATIONS.length; version++) {
    await driver.exclusiveTransaction(async (tx) => {
      await tx.exec(MIGRATIONS[version]!);
      await tx.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

/**
 * The storage contract (storage.ts) on SQLite. Transactions go through one
 * queue, each as an exclusive SQLite transaction: a second write while one
 * runs would fail with "database is locked", and a non-exclusive one would
 * let an unrelated write join it (PLAN.md §2.13).
 */
export async function createSqlStorage(driver: SqlDriver): Promise<StorageAdapter> {
  await migrate(driver);
  let queue: Promise<unknown> = Promise.resolve();
  return {
    ...reader(driver),
    transaction(fn) {
      const result = queue.then(() => driver.exclusiveTransaction((tx) => fn(writer(tx))));
      queue = result.catch(() => {});
      return result;
    },
    // After the queued transactions, so none is cut off mid-write.
    destroy: () => queue.then(() => driver.destroy()),
  };
}
