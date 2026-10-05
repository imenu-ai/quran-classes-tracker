import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classRecord, studentRecord } from "@/test/records";
import { openLocalDb, type LocalDb } from "../db/dexie";
import { LocalStore, LocalValidationError } from "../db/local-store";
import {
  archiveStudent,
  createStudent,
  moveStudent,
  sortByName,
  unarchiveStudent,
  updateStudent,
  type StudentInput,
} from "./students";

const CLASS_ID = "01928c5e-7b3a-7cde-8f00-0000000000c1";
const OTHER_CLASS_ID = "01928c5e-7b3a-7cde-8f00-0000000000c2";

const input = (overrides: Partial<StudentInput> = {}): StudentInput => ({
  classId: CLASS_ID,
  fullName: "  محمد يوسف ",
  birthYear: 2014,
  note: "",
  memorizationDirection: "forward",
  ...overrides,
});

const codes = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(LocalValidationError);
  return (error as LocalValidationError).errors.map((e) => `${e.path}:${e.code}`);
};

describe("student actions", () => {
  let db: LocalDb;
  let store: LocalStore;

  beforeEach(() => {
    db = openLocalDb(`students-${crypto.randomUUID()}`);
    store = new LocalStore(db, { tenantId: "t1", deviceId: "d1" });
  });

  afterEach(async () => {
    await db.delete();
  });

  it("creates a student (trimmed name, not archived) and queues it", async () => {
    const student = await createStudent(store, input());
    expect(student).toMatchObject({ fullName: "محمد يوسف", birthYear: 2014, archivedAt: null });
    expect(await db.outbox.get(student.id)).toBeDefined();
  });

  it("reports localized-ready codes for each invalid field", async () => {
    expect(
      await codes(createStudent(store, input({ fullName: " ", birthYear: undefined }))),
    ).toEqual(["fullName:REQUIRED", "birthYear:REQUIRED"]);
    expect(await codes(createStudent(store, input({ birthYear: Number.NaN })))).toEqual([
      "birthYear:INVALID_TYPE",
    ]);
    expect(await codes(createStudent(store, input({ birthYear: 1800 })))).toEqual([
      "birthYear:TOO_SMALL",
    ]);
    expect(await db.students.count()).toBe(0);
  });

  it("edits, moves, archives and restores", async () => {
    const student = await createStudent(store, input());
    await updateStudent(
      store,
      student.id,
      input({ fullName: "محمد", memorizationDirection: "backward" }),
    );
    await moveStudent(store, student.id, OTHER_CLASS_ID);
    expect(await db.students.get(student.id)).toMatchObject({
      fullName: "محمد",
      memorizationDirection: "backward",
      classId: OTHER_CLASS_ID,
    });

    await archiveStudent(store, student.id, 99);
    expect(await db.students.get(student.id)).toMatchObject({ archivedAt: 99 });
    await unarchiveStudent(store, student.id);
    expect(await db.students.get(student.id)).toMatchObject({ archivedAt: null });
    expect(await db.outbox.get(student.id)).toMatchObject({ rev: 5 });
  });
});

describe("sortByName", () => {
  it("sorts with the locale's collation", () => {
    const cls = classRecord();
    const names = ["يوسف", "أحمد", "باسل"].map((fullName) => studentRecord(cls.id, { fullName }));
    expect(sortByName(names, "ar").map((s) => s.fullName)).toEqual(["أحمد", "باسل", "يوسف"]);
  });
});
