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

type Row = Record<string, unknown>;
type Tables = Map<LocalTable, Map<string, Row>>;

const copy = <T>(value: T): T => structuredClone(value);

/** IndexedDB key order: numbers, then strings, then arrays (element by element). */
export function compareKeys(a: IndexKey, b: IndexKey): number {
  const rank = (key: IndexKey) => (typeof key === "number" ? 0 : typeof key === "string" ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const order = compareKeys(a[i] as IndexKey, b[i] as IndexKey);
      if (order !== 0) return order;
    }
    return a.length - b.length;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

const isKeyPart = (value: unknown): value is string | number =>
  typeof value === "string" || (typeof value === "number" && !Number.isNaN(value));

/** The record's value for an index, or undefined when it isn't indexed (null/missing). */
function indexValue(row: Row, index: string): IndexKey | undefined {
  if (index.startsWith("[")) {
    const parts = index
      .slice(1, -1)
      .split("+")
      .map((field) => row[field]);
    return parts.every(isKeyPart) ? parts : undefined;
  }
  const value = row[index];
  return isKeyPart(value) ? value : undefined;
}

function matches(value: IndexKey, query: IndexQuery): boolean {
  if ("equals" in query) return compareKeys(value, query.equals) === 0;
  if ("anyOf" in query) return query.anyOf.some((key) => compareKeys(value, key) === 0);
  const [lower, upper] = query.between;
  return compareKeys(value, lower) >= 0 && compareKeys(value, upper) <= 0;
}

function reader(read: (table: LocalTable) => Map<string, Row>): StorageReader {
  const sortedRows = (table: LocalTable) =>
    [...read(table).entries()].sort(([a], [b]) => compareKeys(a, b)).map(([, row]) => row);
  return {
    async get(table, key) {
      const row = read(table).get(key);
      return row && copy(row as LocalRecord<typeof table>);
    },
    async bulkGet(table, keys) {
      return keys.map((key) => {
        const row = read(table).get(key);
        return row && copy(row as LocalRecord<typeof table>);
      });
    },
    async query(table, index, query) {
      const keyField = TABLE_SCHEMA[table].key;
      return sortedRows(table)
        .map((row) => ({ row, value: indexValue(row, index) }))
        .filter((hit): hit is { row: Row; value: IndexKey } => hit.value !== undefined)
        .filter((hit) => matches(hit.value, query))
        .sort(
          (a, b) =>
            compareKeys(a.value, b.value) ||
            compareKeys(a.row[keyField] as string, b.row[keyField] as string),
        )
        .map((hit) => copy(hit.row as LocalRecord<typeof table>));
    },
    async all(table) {
      return sortedRows(table).map((row) => copy(row as LocalRecord<typeof table>));
    },
    async count(table) {
      return read(table).size;
    },
  };
}

/**
 * An in-memory adapter: the reference implementation of the storage
 * contract, used by core's tests and as a fake for app tests. It behaves like
 * the strictest real adapter (SQLite): records are copied in and out,
 * transactions run one at a time and see their own writes, and nothing a
 * failed transaction wrote is kept.
 */
export function createMemoryStorage(): StorageAdapter {
  let committed: Tables = new Map(LOCAL_TABLES.map((table) => [table, new Map()]));
  let queue: Promise<unknown> = Promise.resolve();
  const table = (tables: Tables, name: LocalTable) => tables.get(name) as Map<string, Row>;

  const run = async <R>(fn: (tx: StorageWriter) => Promise<R>): Promise<R> => {
    // Copy-on-write: a table is copied the first time the transaction writes it.
    const working: Tables = new Map();
    const read = (name: LocalTable) => working.get(name) ?? table(committed, name);
    const writable = (name: LocalTable) => {
      let rows = working.get(name);
      if (!rows) {
        rows = new Map(table(committed, name));
        working.set(name, rows);
      }
      return rows;
    };
    const keyOf = (name: LocalTable, row: Row) => {
      const key = row[TABLE_SCHEMA[name].key];
      if (typeof key !== "string") throw new Error(`A ${name} record needs a string key`);
      return key;
    };
    const tx: StorageWriter = {
      ...reader(read),
      async put(name, record) {
        const row = copy(record) as Row;
        writable(name).set(keyOf(name, row), row);
      },
      async bulkPut(name, records) {
        const rows = writable(name);
        for (const record of records) {
          const row = copy(record) as Row;
          rows.set(keyOf(name, row), row);
        }
      },
      async delete(name, key) {
        writable(name).delete(key);
      },
      async bulkDelete(name, keys) {
        const rows = writable(name);
        for (const key of keys) rows.delete(key);
      },
    };
    const result = await fn(tx);
    committed = new Map(
      LOCAL_TABLES.map((name) => [name, working.get(name) ?? table(committed, name)]),
    );
    return result;
  };

  return {
    ...reader((name) => table(committed, name)),
    transaction(fn) {
      const result = queue.then(() => run(fn));
      queue = result.catch(() => {});
      return result;
    },
    async destroy() {
      committed = new Map(LOCAL_TABLES.map((name) => [name, new Map()]));
    },
  };
}
