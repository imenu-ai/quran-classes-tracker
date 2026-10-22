import { describe, expect, it } from "vitest";
import { classRecord, studentRecord } from "@/test/records";
import { searchStudents } from "./search";

const fajr = classRecord({ name: "حلقة الفجر" });
const students = [
  studentRecord(fajr.id, { fullName: "مُحَمَّد يوسف" }),
  studentRecord(fajr.id, { fullName: "أحمد محمود" }),
  studentRecord(fajr.id, { fullName: "يوسف محمد" }),
  studentRecord(fajr.id, { fullName: "عبد الله أسامة" }),
  studentRecord(fajr.id, { fullName: "Yusuf Ahmad" }),
  studentRecord(fajr.id, { fullName: "محمد القديم", archivedAt: 5 }),
  studentRecord(fajr.id, { fullName: "محمد المحذوف", deletedAt: 5 }),
];

const names = (query: string) =>
  searchStudents(students, [fajr], query, "ar").map((r) => r.student.fullName);

describe("searchStudents", () => {
  it('"محمد" matches "مُحَمَّد" (tashkeel ignored)', () => {
    expect(names("محمد")).toContain("مُحَمَّد يوسف");
  });

  it("ranks name-start, then word-start; archived after active", () => {
    expect(names("محمد")).toEqual([
      "مُحَمَّد يوسف", // the name starts with it
      "محمد القديم", // the name starts with it, but archived
      "يوسف محمد", // a later word starts with it
    ]);
  });

  it("matches partial names and ignores hamza forms", () => {
    expect(names("يوس")).toEqual(["يوسف محمد", "مُحَمَّد يوسف"]);
    expect(names("احمد")).toEqual(["أحمد محمود"]);
    expect(names("اسامه")).toEqual(["عبد الله أسامة"]);
  });

  it("matches across spaces and is case-insensitive for Latin names", () => {
    expect(names("عبدالله")).toEqual(["عبد الله أسامة"]);
    expect(names("yusuf")).toEqual(["Yusuf Ahmad"]);
  });

  it("never returns deleted students and flags archived ones", () => {
    expect(names("المحذوف")).toEqual([]);
    const [archived] = searchStudents(students, [fajr], "القديم", "ar");
    expect(archived).toMatchObject({ archived: true, className: "حلقة الفجر" });
  });

  it("returns nothing for an empty query", () => {
    expect(names("   ")).toEqual([]);
  });
});
