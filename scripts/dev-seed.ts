/**
 * Fills a teacher's tenant with sample data for development.
 * Usage: pnpm dev:seed --username demo
 *
 * Writes through the real push service, so records get proper server
 * versions and pass the same validation as data from the app.
 */
import { parseArgs } from "node:util";
import { v7 as uuidv7 } from "uuid";
import { getAyahCount } from "@/domain/quran/surahs";
import { COLLECTIONS } from "@/server/collections";
import { closeMongoClient, getDb } from "@/server/db";
import { ensureIndexes } from "@/server/indexes";
import { pushChanges } from "@/server/sync/push";
import type { PushMutation } from "@/shared/sync/protocol";
import { loadEnv } from "./load-env";

const DEVICE = "dev-seed";

/** Deterministic pseudo-random numbers so every seed looks the same. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

const CLASSES = [
  { name: "حلقة الفجر", students: ["أحمد خالد", "محمد يوسف", "عمر سعيد", "Yusuf Ahmad"] },
  { name: "حلقة العصر", students: ["علي حسن", "إبراهيم محمود", "سلمان عادل"] },
];

// Lesson dates (Sunday/Tuesday/Thursday rhythm) across September and October 2026.
const LESSON_DATES = [
  "2026-09-06",
  "2026-09-08",
  "2026-09-10",
  "2026-09-13",
  "2026-09-15",
  "2026-09-20",
  "2026-09-27",
  "2026-10-01",
];

function buildMutations(): PushMutation[] {
  const random = seededRandom(42);
  const mutations: PushMutation[] = [];
  let clock = Date.UTC(2026, 8, 1);
  const base = () => {
    clock += 1_000;
    return {
      id: uuidv7(),
      tenantId: "set-by-server",
      createdAt: clock,
      updatedAt: clock,
      updatedBy: DEVICE,
      deletedAt: null,
      serverVersion: 0,
    };
  };
  const add = (table: PushMutation["table"], record: object) =>
    mutations.push({ table, record: record as Record<string, unknown> });

  CLASSES.forEach((cls, classIndex) => {
    const classRecord = { ...base(), name: cls.name, archivedAt: null };
    add("classes", classRecord);

    const students = cls.students.map((fullName, i) => {
      const student = {
        ...base(),
        classId: classRecord.id,
        fullName,
        birthYear: 2012 + ((i + classIndex) % 5),
        note: "",
        memorizationDirection: i % 2 === 0 ? "forward" : "backward",
        archivedAt: null,
      };
      add("students", student);
      // Where each student is in the mushaf.
      return { student, surah: student.memorizationDirection === "forward" ? 78 : 114, ayah: 1 };
    });

    const pending = new Map<string, Record<string, unknown>>();
    for (const date of LESSON_DATES) {
      const lesson = { ...base(), classId: classRecord.id, date, note: "" };
      add("lessons", lesson);

      for (const position of students) {
        const roll = random();
        const status = roll < 0.8 ? "present" : roll < 0.9 ? "absent" : "excused";
        add("attendance", {
          ...base(),
          lessonId: lesson.id,
          studentId: position.student.id,
          status,
          excuseNote: status === "excused" ? "مريض" : "",
        });
        if (status !== "present") continue;

        // Evaluate the homework assigned at the previous lesson.
        // An update after this lesson exists, as the app would write it.
        const previous = pending.get(position.student.id);
        if (previous) {
          clock += 1_000;
          add("homework", {
            ...previous,
            updatedAt: clock,
            evaluatedLessonId: lesson.id,
            memorizationRate: 6 + Math.floor(random() * 5),
            behaviorRate: 7 + Math.floor(random() * 4),
          });
        }

        // Assign the next portion (within one sura).
        const ayahCount = getAyahCount(position.surah)!;
        const fromAyah = position.ayah;
        const toAyah = Math.min(ayahCount, fromAyah + 4);
        const homework = {
          ...base(),
          studentId: position.student.id,
          surah: position.surah,
          fromAyah,
          toAyah,
          note: "",
          assignedLessonId: lesson.id,
          evaluatedLessonId: null,
          memorizationRate: null,
          behaviorRate: null,
        };
        add("homework", homework);
        pending.set(position.student.id, homework);

        if (toAyah >= ayahCount) {
          position.surah += position.student.memorizationDirection === "forward" ? 1 : -1;
          position.ayah = 1;
        } else {
          position.ayah = toAyah + 1;
        }
      }
    }
  });
  return mutations;
}

async function main() {
  loadEnv();
  const { values } = parseArgs({ options: { username: { type: "string" } }, strict: true });
  if (!values.username) {
    console.error("Usage: pnpm dev:seed --username <username>");
    process.exitCode = 1;
    return;
  }

  const db = getDb();
  await ensureIndexes(db);
  const user = await db
    .collection(COLLECTIONS.users)
    .findOne({ username: values.username.toLowerCase() });
  if (!user) {
    console.error(`No user "${values.username}". Create one with pnpm user:create first.`);
    process.exitCode = 1;
    return;
  }
  const tenantId = String(user.tenantId);
  if ((await db.collection(COLLECTIONS.classes).countDocuments({ tenantId })) > 0) {
    console.log("This tenant already has classes; nothing seeded.");
    return;
  }

  const mutations = buildMutations();
  let applied = 0;
  for (let i = 0; i < mutations.length; i += 200) {
    const results = await pushChanges(db, tenantId, mutations.slice(i, i + 200));
    const rejected = results.filter((r) => r.status === "rejected");
    if (rejected.length > 0) throw new Error(`Seed rejected: ${JSON.stringify(rejected[0])}`);
    applied += results.length;
  }
  console.log(`Seeded ${applied} records for "${values.username}".`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeMongoClient);
