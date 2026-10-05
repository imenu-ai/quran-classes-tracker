import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attendanceIdFor } from "@/shared/ids";
import { attendanceRecord, classRecord, studentRecord } from "@/test/records";
import { openLocalDb, type LocalDb } from "../db/dexie";
import { LocalStore } from "../db/local-store";
import {
  buildRoster,
  clearAttendance,
  markAllPresent,
  setAttendance,
  setExcuseNote,
  summarizeAttendance,
} from "./attendance";

const LESSON = "01928c5e-7b3a-7cde-8f00-00000000aa01";
const S1 = "01928c5e-7b3a-7cde-8f00-00000000bb01";
const S2 = "01928c5e-7b3a-7cde-8f00-00000000bb02";
const S3 = "01928c5e-7b3a-7cde-8f00-00000000bb03";

describe("attendance actions", () => {
  let db: LocalDb;
  let store: LocalStore;

  beforeEach(() => {
    db = openLocalDb(`attendance-${crypto.randomUUID()}`);
    store = new LocalStore(db, { tenantId: "t1", deviceId: "d1" });
  });

  afterEach(async () => {
    await db.delete();
  });

  it("records one status per student per lesson and changes it in place", async () => {
    await setAttendance(store, LESSON, S1, "absent");
    await setAttendance(store, LESSON, S1, "present"); // arrived late
    const records = await db.attendance.toArray();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ id: attendanceIdFor(LESSON, S1), status: "present" });
  });

  it("keeps the excuse note while the status changes", async () => {
    await setAttendance(store, LESSON, S1, "excused");
    await setExcuseNote(store, LESSON, S1, "مريض");
    await setAttendance(store, LESSON, S1, "absent");
    await setAttendance(store, LESSON, S1, "excused");
    expect(await db.attendance.get(attendanceIdFor(LESSON, S1))).toMatchObject({
      status: "excused",
      excuseNote: "مريض",
    });
  });

  it("clears to 'not marked' and revives the same record when marked again", async () => {
    await setAttendance(store, LESSON, S1, "present");
    await clearAttendance(store, LESSON, S1);
    expect(summarizeAttendance(await db.attendance.toArray()).marked).toBe(0);
    await setAttendance(store, LESSON, S1, "absent");
    expect(await db.attendance.count()).toBe(1);
    expect(summarizeAttendance(await db.attendance.toArray())).toEqual({
      present: 0,
      absent: 1,
      excused: 0,
      marked: 1,
    });
  });

  it("'mark all present' only fills in unmarked students", async () => {
    await setAttendance(store, LESSON, S2, "absent");
    await markAllPresent(store, LESSON, [S1, S2, S3]);
    const byStudent = Object.fromEntries(
      (await db.attendance.toArray()).map((r) => [r.studentId, r.status]),
    );
    expect(byStudent).toEqual({ [S1]: "present", [S2]: "absent", [S3]: "present" });
  });
});

describe("buildRoster", () => {
  const cls = classRecord();
  const active = studentRecord(cls.id, { fullName: "باسل" });
  const archived = studentRecord(cls.id, { fullName: "أحمد", archivedAt: 5 });
  const movedAway = studentRecord(classRecord().id, { fullName: "زياد" });

  it("lists active students, plus anyone recorded in the lesson, by name", () => {
    const records = [attendanceRecord(LESSON, movedAway.id, { status: "excused" })];
    const roster = buildRoster([active, archived], [active, archived, movedAway], records, "ar");
    expect(
      roster.map((entry) => [entry.student.fullName, entry.attendance?.status ?? null]),
    ).toEqual([
      ["باسل", null],
      ["زياد", "excused"],
    ]);
  });

  it("lists a student only once when they are both in the class and recorded", () => {
    const records = [attendanceRecord(LESSON, active.id, { status: "present" })];
    const roster = buildRoster([active], [active, active], records, "ar");
    expect(roster).toHaveLength(1);
    expect(roster[0]?.attendance?.status).toBe("present");
  });
});
