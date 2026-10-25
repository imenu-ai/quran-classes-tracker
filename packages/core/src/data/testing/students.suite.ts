import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classRecord, studentRecord } from "../../test/records";
import { LocalStore, LocalValidationError } from "../local-store";
import {
  archiveStudent,
  createStudent,
  moveStudent,
  sortByName,
  unarchiveStudent,
  updateStudent,
  type StudentInput,
} from "../entities/students";
import type { LocalDatabase } from "../database";
import { openTestDevice, type StorageFactory, type TestDevice } from "./harness";

export function studentsSuite(factory: StorageFactory) {
  const CLASS_ID = "01928c5e-7b3a-7cde-8f00-0000000000c1";
  const OTHER_CLASS_ID = "01928c5e-7b3a-7cde-8f00-0000000000c2";

  const input = (overrides: Partial<StudentInput> = {}): StudentInput => ({
    classId: CLASS_ID,
    fullName: "  محمد يوسف ",
    birthYear: 2014,
    note: "",
    memorizationDirection: "forward",
    parentId: "",
    ...overrides,
  });

  const codes = async (promise: Promise<unknown>) => {
    const error = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LocalValidationError);
    return (error as LocalValidationError).errors.map((e) => `${e.path}:${e.code}`);
  };

  describe("student actions", () => {
    let device: TestDevice;
    let db: LocalDatabase;
    let store: LocalStore;

    beforeEach(async () => {
      device = await openTestDevice(factory, { tenantId: "t1", deviceId: "d1", now: Date.now });
      ({ db, store } = device);
    });

    afterEach(async () => {
      await device.destroy();
    });

    it("saves the parent ID, and rejects one that isn't 5–20 digits", async () => {
      const student = await createStudent(store, input({ parentId: "123456789" }));
      expect((await db.get("students", student.id))?.parentId).toBe("123456789");
      expect(await codes(createStudent(store, input({ parentId: "12" })))).toEqual([
        "parentId:INVALID_FORMAT",
      ]);
    });

    it("creates a student (trimmed name, not archived) and queues it", async () => {
      const student = await createStudent(store, input());
      expect(student).toMatchObject({ fullName: "محمد يوسف", birthYear: 2014, archivedAt: null });
      expect(await db.get("outbox", student.id)).toBeDefined();
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
      expect(await db.count("students")).toBe(0);
    });

    it("edits, moves, archives and restores", async () => {
      const student = await createStudent(store, input());
      await updateStudent(
        store,
        student.id,
        input({ fullName: "محمد", memorizationDirection: "backward" }),
      );
      await moveStudent(store, student.id, OTHER_CLASS_ID);
      expect(await db.get("students", student.id)).toMatchObject({
        fullName: "محمد",
        memorizationDirection: "backward",
        classId: OTHER_CLASS_ID,
      });

      await archiveStudent(store, student.id, 99);
      expect(await db.get("students", student.id)).toMatchObject({ archivedAt: 99 });
      await unarchiveStudent(store, student.id);
      expect(await db.get("students", student.id)).toMatchObject({ archivedAt: null });
      expect(await db.get("outbox", student.id)).toMatchObject({ rev: 5 });
    });
  });

  describe("sortByName", () => {
    it("sorts with the locale's collation", () => {
      const cls = classRecord();
      const names = ["يوسف", "أحمد", "باسل"].map((fullName) => studentRecord(cls.id, { fullName }));
      expect(sortByName(names, "ar").map((s) => s.fullName)).toEqual(["أحمد", "باسل", "يوسف"]);
    });
  });
}
