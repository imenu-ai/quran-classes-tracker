import type { Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Permission } from "@/shared/access";
import type { PushMutation } from "@/shared/sync/protocol";
import type { SyncRecord, SyncTable } from "@/shared/sync/tables";
import { TEST_PASSWORD } from "@/test/auth";
import { startTestMongo } from "@/test/mongo";
import {
  attendanceRecord,
  classRecord,
  homeworkRecord,
  lessonRecord,
  studentRecord,
} from "@/test/records";
import type { Actor } from "../actor";
import { resetAuthForTests } from "../auth/auth";
import { createCenter, createMember } from "../centers";
import { ensureIndexes } from "../indexes";
import { accessOf, getMember } from "../members";
import { pullChanges } from "./pull";
import { pushChanges } from "./push";

const m = (table: SyncTable, record: SyncRecord): PushMutation =>
  ({ table, record }) as unknown as PushMutation;

describe("access on push and pull", () => {
  let db: Db;
  let stop: () => Promise<void>;
  let tenantId: string;
  let admin: Actor;
  let counter = 0;

  // Two classes with a student, a lesson, attendance and homework each.
  const classA = classRecord({ name: "A" });
  const classB = classRecord({ name: "B" });
  const studentA = studentRecord(classA.id, { fullName: "طالب أ" });
  const studentB = studentRecord(classB.id, { fullName: "طالب ب" });
  const lessonA = lessonRecord(classA.id);
  const lessonB = lessonRecord(classB.id);
  const attendanceA = attendanceRecord(lessonA.id, studentA.id, { classId: classA.id });
  const attendanceB = attendanceRecord(lessonB.id, studentB.id, { classId: classB.id });
  const homeworkA = homeworkRecord(studentA.id);
  const homeworkB = homeworkRecord(studentB.id);

  /** A fresh teacher in the center, as the sync routes would see him. */
  async function teacher(permissions: Permission[], classIds: string[]): Promise<Actor> {
    counter += 1;
    const { userId } = await createMember(tenantId, {
      name: `t${counter}`,
      username: `teacher_${counter}`,
      password: TEST_PASSWORD,
      permissions,
      classIds,
    });
    const member = await getMember(db, userId);
    return { tenantId, userId, access: accessOf(member!) };
  }

  const statusesOf = async (actor: Actor, mutations: PushMutation[]) =>
    (await pushChanges(db, actor, mutations)).map((result) => result.code ?? result.status);

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
    await ensureIndexes(db);
    resetAuthForTests();
    const center = await createCenter({
      centerName: "مركز",
      timezone: "Asia/Hebron",
      adminName: "admin",
      email: "access-admin@example.test",
      username: "admin",
      password: TEST_PASSWORD,
    });
    tenantId = center.tenantId;
    admin = {
      tenantId,
      userId: center.userId,
      access: accessOf((await getMember(db, center.userId))!),
    };
    const results = await pushChanges(db, admin, [
      m("classes", classA),
      m("classes", classB),
      m("students", studentA),
      m("students", studentB),
      m("lessons", lessonA),
      m("lessons", lessonB),
      m("attendance", attendanceA),
      m("attendance", attendanceB),
      m("homework", homeworkA),
      m("homework", homeworkB),
    ]);
    expect(results.every((result) => result.status === "applied")).toBe(true);
  });

  afterAll(async () => {
    resetAuthForTests();
    await stop();
  });

  // Each test edits with a later timestamp than anything before it.
  let clock = 10_000;
  beforeEach(() => {
    clock += 1_000;
  });
  const edit = <T extends SyncRecord>(record: T, changes: Partial<T>): T => ({
    ...record,
    ...changes,
    updatedAt: clock,
  });

  describe("push", () => {
    it("lets a teacher run lessons only in his classes", async () => {
      const actor = await teacher(["lessons.run"], [classA.id]);
      expect(
        await statusesOf(actor, [
          m("lessons", lessonRecord(classA.id, { date: "2026-10-06" })),
          m("lessons", lessonRecord(classB.id, { date: "2026-10-06" })),
          m("attendance", edit(attendanceA, { status: "absent" })),
          m("attendance", edit(attendanceB, { status: "absent" })),
          m("homework", edit(homeworkA, { note: "a" })),
          m("homework", edit(homeworkB, { note: "b" })),
        ]),
      ).toEqual(["applied", "FORBIDDEN", "applied", "FORBIDDEN", "applied", "FORBIDDEN"]);
    });

    it("needs the table's permission even in his own class", async () => {
      const actor = await teacher(["lessons.run"], [classA.id]);
      expect(
        await statusesOf(actor, [
          m("students", edit(studentA, { note: "x" })),
          m("students", studentRecord(classA.id)),
          m("classes", edit(classA, { name: "renamed" })),
          m("classes", classRecord()),
        ]),
      ).toEqual(["FORBIDDEN", "FORBIDDEN", "FORBIDDEN", "FORBIDDEN"]);

      const readOnly = await teacher([], [classA.id]);
      expect(await statusesOf(readOnly, [m("homework", edit(homeworkA, { note: "r" }))])).toEqual([
        "FORBIDDEN",
      ]);
    });

    it("assigns a class a teacher creates to him, within the same batch too", async () => {
      const actor = await teacher(["classes.manage", "students.manage"], []);
      const own = classRecord({ name: "صف جديد" });
      expect(
        await statusesOf(actor, [m("classes", own), m("students", studentRecord(own.id))]),
      ).toEqual(["applied", "applied"]);
      expect((await getMember(db, actor.userId))?.classIds).toEqual([own.id]);
      // Someone else's class stays out of reach.
      expect(await statusesOf(actor, [m("classes", edit(classB, { name: "x" }))])).toEqual([
        "FORBIDDEN",
      ]);
    });

    it("only moves a student between two classes the teacher has", async () => {
      const onlyA = await teacher(["students.manage"], [classA.id]);
      const moving = studentRecord(classA.id);
      expect(await statusesOf(onlyA, [m("students", moving)])).toEqual(["applied"]);
      expect(
        await statusesOf(onlyA, [m("students", edit(moving, { classId: classB.id }))]),
      ).toEqual(["FORBIDDEN"]);

      const both = await teacher(["students.manage"], [classA.id, classB.id]);
      expect(await statusesOf(both, [m("students", edit(moving, { classId: classB.id }))])).toEqual(
        ["applied"],
      );
    });

    it("keeps attendance in its lesson's class, and lessons in their class", async () => {
      const results = await pushChanges(db, admin, [
        m("attendance", attendanceRecord(lessonA.id, studentB.id, { classId: classB.id })),
        m("lessons", edit(lessonA, { classId: classB.id })),
      ]);
      expect(results.map((r) => [r.code, r.params?.field])).toEqual([
        ["INVALID_VALUE", "classId"],
        ["INVALID_VALUE", "classId"],
      ]);
    });
  });

  describe("pull", () => {
    const idsOf = (records: { id: string }[]) => records.map((record) => record.id).sort();

    it("gives a teacher only his classes and what's in them", async () => {
      const actor = await teacher(["lessons.run"], [classA.id]);
      const { changes } = await pullChanges(db, actor, 0, 1000);
      expect(idsOf(changes.classes)).toEqual([classA.id]);
      expect(changes.students.every((s) => s.classId === classA.id)).toBe(true);
      expect(changes.lessons.every((l) => l.classId === classA.id)).toBe(true);
      expect(changes.attendance.every((a) => a.classId === classA.id)).toBe(true);
      expect(idsOf(changes.homework)).toContain(homeworkA.id);
      expect(idsOf(changes.homework)).not.toContain(homeworkB.id);
    });

    it("gives admins everything", async () => {
      const { changes } = await pullChanges(db, admin, 0, 1000);
      expect(idsOf(changes.classes)).toEqual(expect.arrayContaining([classA.id, classB.id]));
      expect(idsOf(changes.homework)).toEqual(expect.arrayContaining([homeworkA.id, homeworkB.id]));
    });

    it("hands a moved student's history to his new class and resyncs who lost him", async () => {
      const moved = studentRecord(classA.id, { fullName: "منتقل" });
      const history = homeworkRecord(moved.id);
      await pushChanges(db, admin, [m("students", moved), m("homework", history)]);

      const teacherA = await teacher(["lessons.run"], [classA.id]);
      const teacherB = await teacher(["lessons.run"], [classB.id]);
      const { cursor } = await pullChanges(db, teacherB, 0, 1000);

      await pushChanges(db, admin, [m("students", edit(moved, { classId: classB.id }))]);

      // B now receives the student and his older homework.
      const next = await pullChanges(db, teacherB, cursor, 1000);
      expect(idsOf(next.changes.students)).toContain(moved.id);
      expect(idsOf(next.changes.homework)).toContain(history.id);
      // A's devices must resync to drop him; B's access didn't change.
      expect((await getMember(db, teacherA.userId))?.accessVersion).toBe(2);
      expect((await getMember(db, teacherB.userId))?.accessVersion).toBe(1);
    });
  });
});
