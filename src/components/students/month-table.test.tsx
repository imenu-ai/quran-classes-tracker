// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { todayInTimeZone } from "@/domain/dates/local-date";
import { monthlyStats } from "@/domain/stats/monthly";
import { DEFAULT_TIME_ZONE } from "@/i18n/config";
import { attendanceRecord, homeworkRecord, lessonRecord, studentRecord } from "@/test/records";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { MonthTable } from "./month-table";

vi.mock("@/client/app-context", () => ({
  useApp: () => ({ session: { timezone: DEFAULT_TIME_ZONE }, store: {} }),
}));

installDomPolyfills();

const CLASS = "01928c5e-7b3a-7cde-8f00-00000000cc01";

function profileWithExam() {
  const student = studentRecord(CLASS);
  const date = todayInTimeZone(DEFAULT_TIME_ZONE);
  const first = lessonRecord(CLASS, { date });
  const second = lessonRecord(CLASS, { date });
  const homework = [
    homeworkRecord(student.id, {
      surah: 112,
      fromAyah: 1,
      toAyah: 4,
      assignedLessonId: first.id,
      evaluatedLessonId: first.id,
      memorizationRate: 9,
      behaviorRate: 9,
    }),
    homeworkRecord(student.id, {
      kind: "exam",
      surah: 67,
      fromAyah: 1,
      toAyah: 10,
      assignedLessonId: second.id,
      evaluatedLessonId: second.id,
      memorizationRate: 6,
    }),
  ];
  const attendance = [first, second].map((l) => attendanceRecord(l.id, student.id));
  const lessons = [first, second];
  return {
    student,
    profile: {
      homework,
      attendance,
      lessonsById: new Map(lessons.map((l) => [l.id, l])),
      pending: [],
      months: monthlyStats(homework, attendance, lessons),
    },
  };
}

/** The table starts closed: open it by tapping the month. */
async function openTable() {
  await userEvent.click(within(screen.getByRole("heading", { level: 2 })).getByRole("button"));
}

describe("MonthTable", () => {
  it("starts closed, showing the month's averages, and opens on tap", async () => {
    const { student, profile } = profileWithExam();
    renderArabic(<MonthTable profile={profile} student={student} editable />);

    const toggle = within(screen.getByRole("heading", { level: 2 })).getByRole("button");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toMatch(/الحفظ 9\.0 · السلوك 9\.0 · الحضور 2/);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: "الشهر السابق" })).toBeNull();

    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("table")).toBeTruthy();

    await userEvent.click(toggle);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an exam in its own row, with its badge and one mark, outside the averages", async () => {
    const { student, profile } = profileWithExam();
    renderArabic(<MonthTable profile={profile} student={student} editable />);
    await openTable();

    const examRow = screen.getByText("الملك 1–10").closest("tr")!;
    expect(examRow.className).toContain("bg-exam/10");
    expect(within(examRow).getByText("اختبار")).toBeTruthy();
    expect(within(examRow).getAllByRole("cell")).toHaveLength(3);
    expect(within(examRow).getAllByRole("cell")[2]?.textContent).toBe("6");

    const homeworkRow = screen.getByText("الإخلاص 1–4").closest("tr")!;
    expect(homeworkRow.className).not.toContain("bg-exam");

    const footer = document.querySelector("tfoot")!;
    expect(footer.textContent).not.toContain("7.5");
    expect(footer.textContent?.match(/9\.0/g)).toHaveLength(2);
  });

  it("edits an exam with one mark", async () => {
    const { student, profile } = profileWithExam();
    renderArabic(<MonthTable profile={profile} student={student} editable />);
    await openTable();

    await userEvent.click(screen.getByText("الملك 1–10"));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("تعديل الاختبار")).toBeTruthy();
    expect(within(sheet).getAllByRole("combobox")).toHaveLength(1);
    expect(within(sheet).getByRole("combobox", { name: "درجة الاختبار" })).toBeTruthy();
  });

  it("view-only (without lessons.run): the table opens, but rows don't", async () => {
    const { student, profile } = profileWithExam();
    renderArabic(<MonthTable profile={profile} student={student} editable={false} />);
    await openTable();

    expect(screen.queryByRole("button", { name: /تعديل/ })).toBeNull();
    await userEvent.click(screen.getByText("الملك 1–10"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
