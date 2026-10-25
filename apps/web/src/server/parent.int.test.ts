import type { Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  attendanceRecord,
  classRecord,
  homeworkRecord,
  lessonRecord,
  studentRecord,
} from "@qct/core/test/records";
import { startTestMongo } from "@/test/mongo";
import { COLLECTIONS } from "./collections";
import { ensureIndexes } from "./indexes";
import { parentReport, parentToken } from "./parent";

const SECRET = "test-secret-test-secret-test-secret-123";
const TENANT = "tenant-parent";
const OTHER = "tenant-other";
const PARENT_ID = "401234567";
// 13 Oct 2026, noon UTC: October in the center's time zone.
const NOW = Date.UTC(2026, 9, 13, 12);

const cls = classRecord({ name: "حلقة الفجر" });
const ahmad = studentRecord(cls.id, { fullName: "أحمد", parentId: PARENT_ID });
const noParent = studentRecord(cls.id, { fullName: "سالم" });
const gone = studentRecord(cls.id, { fullName: "خالد", parentId: PARENT_ID, deletedAt: 5 });
const sep30 = lessonRecord(cls.id, { date: "2026-09-30" });
const oct1 = lessonRecord(cls.id, { date: "2026-10-01" });
const oct2 = lessonRecord(cls.id, { date: "2026-10-02" });
const oct5 = lessonRecord(cls.id, { date: "2026-10-05" });

async function put(db: Db, collection: string, tenantId: string, record: { id: string }) {
  const { id, ...fields } = record;
  await db.collection(collection).insertOne({ _id: id as never, ...fields, tenantId });
}

let ipCounter = 0;
const ip = () => `198.51.100.${++ipCounter}`;

describe("parentReport", () => {
  let db: Db;
  let stop: () => Promise<void>;
  const ask = (input: Partial<Parameters<typeof parentReport>[1]> = {}) =>
    parentReport(db, { studentId: ahmad.id, ip: ip(), secret: SECRET, now: NOW, ...input });

  beforeAll(async () => {
    ({ db, stop } = await startTestMongo());
    await ensureIndexes(db);
    await db.collection(COLLECTIONS.tenants).insertOne({
      _id: TENANT as never,
      name: "مركز النور",
      code: "100900",
      timezone: "Asia/Hebron",
    });
    await put(db, COLLECTIONS.classes, TENANT, cls);
    for (const s of [ahmad, noParent, gone]) await put(db, COLLECTIONS.students, TENANT, s);
    for (const l of [sep30, oct1, oct2, oct5]) await put(db, COLLECTIONS.lessons, TENANT, l);
    const homework = [
      homeworkRecord(ahmad.id, {
        surah: 112,
        fromAyah: 1,
        toAyah: 4,
        note: "ملاحظة المعلم",
        evaluatedLessonId: oct1.id,
        memorizationRate: 9,
        behaviorRate: 8,
      }),
      homeworkRecord(ahmad.id, {
        kind: "exam",
        surah: 67,
        fromAyah: 1,
        toAyah: 10,
        assignedLessonId: oct5.id,
        evaluatedLessonId: oct5.id,
        memorizationRate: 3,
      }),
      homeworkRecord(ahmad.id, {
        surah: 113,
        assignedLessonId: oct2.id,
        postponedLessonIds: [oct5.id],
      }),
      homeworkRecord(ahmad.id, {
        surah: 114,
        evaluatedLessonId: sep30.id,
        memorizationRate: 7,
        behaviorRate: 7,
      }),
    ];
    for (const h of homework) await put(db, COLLECTIONS.homework, TENANT, h);
    await put(db, COLLECTIONS.attendance, TENANT, attendanceRecord(oct1.id, ahmad.id));
    await put(
      db,
      COLLECTIONS.attendance,
      TENANT,
      attendanceRecord(oct2.id, ahmad.id, { status: "excused", excuseNote: "مريض" }),
    );
    await put(db, COLLECTIONS.attendance, TENANT, attendanceRecord(oct5.id, ahmad.id));
    // Another center's homework claiming the same student: never shown.
    await put(
      db,
      COLLECTIONS.homework,
      OTHER,
      homeworkRecord(ahmad.id, {
        surah: 1,
        evaluatedLessonId: oct1.id,
        memorizationRate: 1,
        behaviorRate: 1,
      }),
    );
  });

  afterAll(async () => {
    await stop();
  });

  beforeEach(async () => {
    await db.collection(COLLECTIONS.rateLimits).deleteMany({});
  });

  it("calls a link invalid for an unknown, deleted or unset student, all alike", async () => {
    for (const studentId of ["01928c5e-0000-7000-8000-000000000000", noParent.id, gone.id]) {
      expect(await ask({ studentId, parentId: PARENT_ID })).toEqual({
        ok: false,
        status: 404,
        error: "INVALID_LINK",
      });
    }
  });

  it("asks for the ID number without one, and refuses a wrong one", async () => {
    expect(await ask()).toMatchObject({ ok: false, status: 401, error: "PARENT_ID_REQUIRED" });
    expect(await ask({ parentId: "401234568" })).toMatchObject({
      ok: false,
      status: 401,
      error: "WRONG_PARENT_ID",
    });
  });

  it("shows the current month for the right number, typed in Arabic digits", async () => {
    const result = await ask({ parentId: "٤٠١ ٢٣٤ ٥٦٧" });
    if (!result.ok) throw new Error(result.error);
    const { report } = result;
    expect(report).toMatchObject({
      centerName: "مركز النور",
      className: "حلقة الفجر",
      studentName: "أحمد",
      month: "2026-10",
      months: ["2026-10", "2026-09"],
      // The exam is left out of the averages.
      memorizationAverage: 9,
      behaviorAverage: 8,
      counts: { present: 2, absent: 0, excused: 1, evaluated: 1, exams: 1, postponed: 1 },
    });
    expect(report.rows).toEqual([
      {
        date: "2026-10-01",
        kind: "homework",
        surah: 112,
        fromAyah: 1,
        toAyah: 4,
        memorization: 9,
        behavior: 8,
        excuseNote: "",
      },
      {
        date: "2026-10-02",
        kind: "excused",
        surah: null,
        fromAyah: null,
        toAyah: null,
        memorization: null,
        behavior: null,
        excuseNote: "مريض",
      },
      {
        date: "2026-10-05",
        kind: "exam",
        surah: 67,
        fromAyah: 1,
        toAyah: 10,
        memorization: 3,
        behavior: null,
        excuseNote: "",
      },
      {
        date: "2026-10-05",
        kind: "postponed",
        surah: 113,
        fromAyah: 1,
        toAyah: 10,
        memorization: null,
        behavior: null,
        excuseNote: "",
      },
    ]);
    // Nothing internal: no record ids, tenant or teacher's notes.
    const text = JSON.stringify(report);
    for (const secret of [ahmad.id, cls.id, oct1.id, TENANT, "ملاحظة المعلم", PARENT_ID]) {
      expect(text).not.toContain(secret);
    }
    expect(result.token).toBe(parentToken(SECRET, ahmad.id, PARENT_ID));
  });

  it("shows another month on request", async () => {
    const result = await ask({ parentId: PARENT_ID, month: "2026-09" });
    expect(result.ok && result.report).toMatchObject({
      month: "2026-09",
      memorizationAverage: 7,
      rows: [{ date: "2026-09-30", kind: "homework", surah: 114 }],
    });
  });

  it("remembers the phone with its token, until the parent ID changes", async () => {
    const token = parentToken(SECRET, ahmad.id, PARENT_ID);
    expect((await ask({ token })).ok).toBe(true);
    expect(await ask({ token: "forged" })).toMatchObject({ error: "PARENT_ID_REQUIRED" });

    await db
      .collection(COLLECTIONS.students)
      .updateOne({ _id: ahmad.id as never }, { $set: { parentId: "999999999" } });
    try {
      expect(await ask({ token })).toMatchObject({ error: "PARENT_ID_REQUIRED" });
      expect((await ask({ parentId: "999999999" })).ok).toBe(true);
    } finally {
      await db
        .collection(COLLECTIONS.students)
        .updateOne({ _id: ahmad.id as never }, { $set: { parentId: PARENT_ID } });
    }
  });

  it("stops checking numbers from an IP after 10 wrong ones", async () => {
    const from = ip();
    for (let i = 0; i < 10; i++) {
      expect(await ask({ ip: from, parentId: "11111111" })).toMatchObject({
        error: "WRONG_PARENT_ID",
      });
    }
    // Even the right number is refused there now; another place still works.
    expect(await ask({ ip: from, parentId: PARENT_ID })).toMatchObject({
      status: 429,
      error: "TOO_MANY_ATTEMPTS",
    });
    expect((await ask({ parentId: PARENT_ID })).ok).toBe(true);
  });

  it("stops checking numbers for a student after 30 wrong ones from anywhere", async () => {
    for (let i = 0; i < 30; i++) {
      expect(await ask({ parentId: "11111111" })).toMatchObject({ error: "WRONG_PARENT_ID" });
    }
    expect(await ask({ parentId: PARENT_ID })).toMatchObject({ error: "TOO_MANY_ATTEMPTS" });
    // A remembered phone isn't locked out.
    expect((await ask({ token: parentToken(SECRET, ahmad.id, PARENT_ID) })).ok).toBe(true);
  });

  it("limits all requests from one IP", async () => {
    const from = ip();
    for (let i = 0; i < 60; i++) await ask({ ip: from });
    expect(await ask({ ip: from, parentId: PARENT_ID })).toMatchObject({
      status: 429,
      error: "RATE_LIMITED",
    });
  });
});
