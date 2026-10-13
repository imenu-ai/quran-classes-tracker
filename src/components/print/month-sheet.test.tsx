// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildMonthSheet } from "@/client/data/print";
import { buildStudentProfile } from "@/client/data/profile";
import {
  attendanceRecord,
  classRecord,
  homeworkRecord,
  lessonRecord,
  studentRecord,
} from "@/test/records";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { MonthSheet } from "./month-sheet";

installDomPolyfills();

const cls = classRecord();
const student = studentRecord(cls.id, { fullName: "أحمد التجريبي" });
const oct1 = lessonRecord(cls.id, { date: "2026-10-01" });
const oct2 = lessonRecord(cls.id, { date: "2026-10-02" });
const lessons = [oct1, oct2];
const profile = buildStudentProfile(
  [
    homeworkRecord(student.id, {
      surah: 112,
      fromAyah: 1,
      toAyah: 4,
      evaluatedLessonId: oct1.id,
      memorizationRate: 9,
      behaviorRate: 8,
    }),
    homeworkRecord(student.id, {
      kind: "exam",
      surah: 67,
      fromAyah: 1,
      toAyah: 10,
      assignedLessonId: oct2.id,
      evaluatedLessonId: oct2.id,
      memorizationRate: 4,
    }),
  ],
  [attendanceRecord(oct1.id, student.id), attendanceRecord(oct2.id, student.id)],
  lessons,
);

function renderSheet(month: string) {
  return renderArabic(
    <MonthSheet
      sheet={buildMonthSheet(student, profile, month)}
      centerName="مركز النور"
      className="حلقة الفجر"
      userName="الأستاذ محمد"
      month={month}
      printedOn="2026-10-13"
      parentUrl={`https://app.test/parent?s=${student.id}`}
    />,
  );
}

describe("MonthSheet", () => {
  it("names the center, class, student, month and who printed it", () => {
    renderSheet("2026-10");
    const sheet = screen.getByRole("article");
    expect(sheet.textContent).toContain("مركز النور");
    expect(sheet.textContent).toContain("كشف المتابعة الشهري");
    expect(sheet.textContent).toContain("حلقة الفجر");
    expect(sheet.textContent).toContain("أحمد التجريبي");
    expect(sheet.textContent).toContain("أكتوبر 2026");
    expect(sheet.textContent).toContain("الأستاذ محمد");
    expect(sheet.textContent).toContain("13 أكتوبر 2026");
  });

  it("carries a QR code of the student's parent link", () => {
    renderSheet("2026-10");
    const qr = screen.getByRole("img", { name: "تابع تقدّم ابنك" });
    expect(qr.getAttribute("data-qr-value")).toBe(`https://app.test/parent?s=${student.id}`);
  });

  it("lists the month oldest first, the exam marked, and averages without it", () => {
    renderSheet("2026-10");
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    // Header, two days, the averages.
    expect(rows).toHaveLength(4);
    expect(rows[1]?.textContent).toContain("الإخلاص 1–4");
    expect(rows[2]?.textContent).toContain("الملك 1–10");
    expect(rows[2]?.textContent).toContain("اختبار");
    expect(rows[2]?.className).toContain("bg-violet-50");
    expect(rows[3]?.textContent).toMatch(/9\.0.*8\.0/);
  });

  it("shows the month's counts", () => {
    renderSheet("2026-10");
    const count = (name: string) =>
      screen.getByText(name).closest("div")?.querySelector("dd")?.textContent;
    expect(count("أيام الحضور")).toBe("2");
    expect(count("أيام الغياب")).toBe("0");
    expect(count("الواجبات المسمّعة")).toBe("1");
    expect(count("الاختبارات")).toBe("1");
    expect(count("التسميع المؤجل")).toBe("0");
  });

  it("says so when the month has no record", () => {
    renderSheet("2026-11");
    expect(screen.getByText("لا يوجد سجل لهذا الشهر")).toBeTruthy();
    expect(screen.getByRole("article").textContent).toContain("نوفمبر 2026");
  });
});
