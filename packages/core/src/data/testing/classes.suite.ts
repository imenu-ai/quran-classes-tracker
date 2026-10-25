import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classRecord, studentRecord } from "../../test/records";
import { LocalStore } from "../local-store";
import {
  archiveClass,
  archiveClassWithStudents,
  createClass,
  moveStudentsAndArchive,
  renameClass,
  summarizeClasses,
  unarchiveClass,
} from "../entities/classes";
import type { LocalDatabase } from "../database";
import { openTestDevice, type StorageFactory, type TestDevice } from "./harness";

export function classesSuite(factory: StorageFactory) {
  describe("summarizeClasses", () => {
    const fajr = classRecord({ name: "حلقة الفجر" });
    const asr = classRecord({ name: "حلقة العصر" });
    const archived = classRecord({ name: "قديمة", archivedAt: 5 });
    const deleted = classRecord({ name: "محذوفة", deletedAt: 5 });

    it("lists active classes sorted by name with active student counts", () => {
      const students = [
        studentRecord(fajr.id),
        studentRecord(fajr.id),
        studentRecord(fajr.id, { archivedAt: 9 }),
        studentRecord(fajr.id, { deletedAt: 9 }),
        studentRecord(asr.id),
      ];
      const result = summarizeClasses([fajr, archived, asr, deleted], students, "ar");
      expect(result.map((s) => [s.record.name, s.studentCount])).toEqual([
        ["حلقة العصر", 1],
        ["حلقة الفجر", 2],
      ]);
    });
  });

  describe("class actions", () => {
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

    const addStudent = (classId: string, name = "طالب") =>
      store.create("students", {
        classId,
        fullName: name,
        birthYear: 2014,
        note: "",
        memorizationDirection: "forward",
        parentId: "",
        archivedAt: null,
      });

    it("creates and renames, validating the name", async () => {
      const created = await createClass(store, "حلقة");
      await renameClass(store, created.id, "حلقة الفجر");
      expect(await db.get("classes", created.id)).toMatchObject({ name: "حلقة الفجر" });
      await expect(renameClass(store, created.id, "  ")).rejects.toThrow(/name:REQUIRED/);
    });

    it("archives an empty class and restores it", async () => {
      const cls = await createClass(store, "فارغة");
      expect(await archiveClass(store, cls.id, 77)).toEqual({ status: "archived" });
      expect(await db.get("classes", cls.id)).toMatchObject({ archivedAt: 77 });
      await unarchiveClass(store, cls.id);
      expect(await db.get("classes", cls.id)).toMatchObject({ archivedAt: null });
    });

    it("refuses to archive a class with active students", async () => {
      const cls = await createClass(store, "حلقة");
      await addStudent(cls.id);
      await addStudent(cls.id);
      const archivedStudent = await addStudent(cls.id);
      await store.update("students", archivedStudent.id, { archivedAt: 1 });

      expect(await archiveClass(store, cls.id)).toEqual({ status: "hasStudents", count: 2 });
      expect(await db.get("classes", cls.id)).toMatchObject({ archivedAt: null });
    });

    it("archives a class together with its students", async () => {
      const cls = await createClass(store, "حلقة");
      const a = await addStudent(cls.id);
      const b = await addStudent(cls.id);
      await archiveClassWithStudents(store, cls.id, 50);
      for (const id of [cls.id, a.id, b.id]) {
        expect(await db.get(id === cls.id ? "classes" : "students", id)).toMatchObject({
          archivedAt: 50,
        });
      }
      expect(await db.count("outbox")).toBe(3);
    });

    it("moves the students to another class, then archives", async () => {
      const from = await createClass(store, "قديمة");
      const to = await createClass(store, "جديدة");
      const a = await addStudent(from.id);
      await moveStudentsAndArchive(store, from.id, to.id, 60);
      expect(await db.get("students", a.id)).toMatchObject({ classId: to.id, archivedAt: null });
      expect(await db.get("classes", from.id)).toMatchObject({ archivedAt: 60 });
      await expect(moveStudentsAndArchive(store, to.id, to.id)).rejects.toThrow();
    });
  });
}
