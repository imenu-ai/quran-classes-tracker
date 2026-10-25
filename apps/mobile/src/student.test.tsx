import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { createClass } from "@qct/core/data/entities/classes";
import { addHomework, setStudentAttendance } from "@qct/core/data/entities/homework";
import { startLesson } from "@qct/core/data/entities/lessons";
import { createStudent } from "@qct/core/data/entities/students";
import { todayInTimeZone } from "@qct/core/domain/dates/local-date";
import ar from "@qct/core/messages/ar.json";
import { MonthTable } from "@/components/month-table";
import { TodayCard } from "@/components/today-card";
import type { AppServices } from "@/data/app-data";
import { createTestServices, renderWithApp, TEST_SESSION } from "@/test/app-services";
import EditDaySheet from "./app/edit-day";
import HomeworkFormScreen from "./app/homework-form";
import { loadStudentProfile } from "@qct/core/data/entities/profile";

jest.mock("expo-router", () => jest.requireActual("@/test/expo-router-mock"));

const params = useLocalSearchParams as jest.Mock;
const button = (name: string) => screen.getByRole("button", { name });
const radio = (name: string) => screen.getByRole("radio", { name });
const today = () => todayInTimeZone(TEST_SESSION.timezone);
const PAST = "2026-10-01";

/** A teacher who runs lessons (or not), with a class and one student in it. */
async function setup(permissions: AppServices["session"]["permissions"] = ["lessons.run"]) {
  const services = createTestServices({ session: { permissions } });
  const cls = await createClass(services.store, "حلقة الفجر");
  const student = await createStudent(services.store, {
    classId: cls.id,
    fullName: "أحمد علي",
    birthYear: 2015,
    note: "",
    memorizationDirection: "forward",
    parentId: "",
  });
  return { services, cls, student };
}

/** Homework assigned in a past lesson: due today. */
async function homeworkDue(services: AppServices, classId: string, studentId: string) {
  const lesson = await startLesson(services.store, classId, PAST);
  return addHomework(services.store, {
    studentId,
    lessonId: lesson.id,
    portion: { surah: 78, fromAyah: 1, toAyah: 10 },
    note: "",
    evaluateNow: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({});
});

describe("today's attendance", () => {
  it("records attendance, creating today's lesson; tapping it again clears it", async () => {
    const { services, student } = await setup();
    await renderWithApp(<TodayCard student={student} />, services);
    await fireEvent.press(await screen.findByRole("radio", { name: ar.glossary.present }));
    await waitFor(async () => expect(await services.db.count("attendance")).toBe(1));
    const [lesson] = await services.db.all("lessons");
    expect(lesson?.date).toBe(today());
    expect(await screen.findByRole("radio", { name: ar.glossary.present, selected: true }));
    await fireEvent.press(radio(ar.glossary.present));
    await waitFor(async () => {
      const [record] = await services.db.all("attendance");
      expect(record?.deletedAt).not.toBeNull();
    });
  });

  it("an absent student has no homework part; excused adds the note", async () => {
    const { services, student, cls } = await setup();
    await homeworkDue(services, cls.id, student.id);
    await renderWithApp(<TodayCard student={student} />, services);
    expect(await screen.findByText("النبأ 1–10")).toBeOnTheScreen();
    await fireEvent.press(radio(ar.glossary.excused));
    expect(await screen.findByText(ar.today.absentNote)).toBeOnTheScreen();
    expect(screen.queryByText("النبأ 1–10")).toBeNull();
    const note = await screen.findByLabelText(ar.attendance.excuseNotePlaceholder);
    await fireEvent.changeText(note, "مريض");
    await fireEvent(note, "blur");
    await waitFor(async () => {
      const [record] = await services.db.all("attendance");
      expect(record?.excuseNote).toBe("مريض");
    });
  });
});

describe("homework due today", () => {
  it("opens to the mark wheels; a mark shows in the closed line", async () => {
    const { services, student, cls } = await setup();
    const item = await homeworkDue(services, cls.id, student.id);
    await renderWithApp(<TodayCard student={student} />, services);
    await fireEvent.press(await screen.findByText("النبأ 1–10"));
    const memorization = screen.getByLabelText(ar.glossary.memorizationRate);
    await act(async () => {
      fireEvent(memorization, "valueChange", "9");
    });
    await waitFor(async () =>
      expect((await services.db.get("homework", item.id))?.memorizationRate).toBe(9),
    );
    expect(await screen.findByText("9 · —")).toBeOnTheScreen();
  });

  it("postpones the recitation, and undoes it", async () => {
    const { services, student, cls } = await setup();
    const item = await homeworkDue(services, cls.id, student.id);
    await renderWithApp(<TodayCard student={student} />, services);
    await fireEvent.press(await screen.findByText("النبأ 1–10"));
    await fireEvent.press(button(ar.today.postpone));
    expect(await screen.findByText(ar.today.postponed)).toBeOnTheScreen();
    expect((await services.db.get("homework", item.id))?.postponedLessonIds).toHaveLength(1);
    await fireEvent.press(button(ar.today.undoPostpone));
    await waitFor(async () =>
      expect((await services.db.get("homework", item.id))?.postponedLessonIds).toHaveLength(0),
    );
  });

  it("with nothing due, offers to recite now, an exam and next-day homework", async () => {
    const { services, student } = await setup();
    await renderWithApp(<TodayCard student={student} />, services);
    expect(await screen.findByText(ar.evaluation.noPending)).toBeOnTheScreen();
    await fireEvent.press(button(ar.evaluation.reciteNow));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/homework-form",
      params: { studentId: student.id, kind: "recite" },
    });
    await fireEvent.press(button(ar.exam.add));
    await fireEvent.press(button(ar.today.addNext));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/homework-form",
      params: { studentId: student.id, kind: "next" },
    });
  });

  it("is view-only without lessons.run", async () => {
    const { services, student, cls } = await setup([]);
    await homeworkDue(services, cls.id, student.id);
    await renderWithApp(<TodayCard student={student} />, services);
    expect(await screen.findByText(ar.today.viewOnly)).toBeOnTheScreen();
    expect(radio(ar.glossary.present)).toBeDisabled();
    expect(screen.queryByRole("button", { name: ar.exam.add })).toBeNull();
    expect(screen.queryByRole("button", { name: ar.today.addNext })).toBeNull();
    await fireEvent.press(screen.getByText("النبأ 1–10"));
    expect(screen.queryByRole("button", { name: ar.today.postpone })).toBeNull();
  });
});

describe("the homework form", () => {
  it("suggests the portion after the latest one and adds it to today's lesson", async () => {
    const { services, student, cls } = await setup();
    await homeworkDue(services, cls.id, student.id);
    params.mockReturnValue({ studentId: student.id, kind: "next" });
    await renderWithApp(<HomeworkFormScreen />, services);
    expect(await screen.findByText(ar.homework.suggested)).toBeOnTheScreen();
    expect(screen.getByLabelText(ar.glossary.fromAyah)).toHaveDisplayValue("11");
    await fireEvent.press(button(ar.common.save));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const lessons = await services.db.all("lessons");
    const todays = lessons.find((l) => l.date === today());
    const items = await services.db.all("homework");
    expect(items.find((h) => h.fromAyah === 11)).toMatchObject({
      surah: 78,
      assignedLessonId: todays?.id,
      evaluatedLessonId: null,
    });
  });

  it("shows an ayah outside the sura as soon as it's typed", async () => {
    const { services, student } = await setup();
    params.mockReturnValue({ studentId: student.id, kind: "exam" });
    await renderWithApp(<HomeworkFormScreen />, services);
    await fireEvent.press(await screen.findByRole("button", { name: /^السورة/ }));
    await fireEvent.changeText(screen.getByLabelText(ar.homework.searchSurah), "الكوثر");
    await fireEvent.press(await screen.findByText("108 · الكوثر · 3 آيات"));
    expect(screen.getByText("من 1 إلى 3")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(ar.glossary.fromAyah), "1");
    await fireEvent.changeText(screen.getByLabelText(ar.glossary.toAyah), "5");
    expect(await screen.findByText("سورة الكوثر تحتوي على 3 آيات فقط")).toBeOnTheScreen();
    await fireEvent.press(button(ar.common.save));
    expect(router.back).not.toHaveBeenCalled();
    expect(await services.db.count("homework")).toBe(0);
  });
});

describe("the month table", () => {
  it("opens to the month's rows; tapping one edits that day", async () => {
    const { services, student, cls } = await setup();
    const lesson = await startLesson(services.store, cls.id, today());
    await setStudentAttendance(services.store, lesson.id, student.id, "absent");
    const profile = await loadStudentProfile(services.db, student.id);
    await renderWithApp(<MonthTable profile={profile} student={student} editable />, services);
    await fireEvent.press(screen.getByText(/الحفظ — · السلوك — · الحضور 0/));
    expect(screen.getByText(ar.glossary.absent)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: /^تعديل سجل/ }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/edit-day",
      params: {
        studentId: student.id,
        kind: "absence",
        id: expect.any(String),
        lessonId: lesson.id,
      },
    });
  });

  it("corrects a past absence to present in the edit sheet", async () => {
    const { services, student, cls } = await setup();
    const lesson = await startLesson(services.store, cls.id, PAST);
    await setStudentAttendance(services.store, lesson.id, student.id, "absent");
    const [record] = await services.db.all("attendance");
    params.mockReturnValue({
      studentId: student.id,
      kind: "absence",
      id: record!.id,
      lessonId: lesson.id,
    });
    await renderWithApp(<EditDaySheet />, services);
    expect(await screen.findByText(ar.profile.editAttendanceTitle)).toBeOnTheScreen();
    await fireEvent.press(radio(ar.glossary.present));
    await waitFor(async () =>
      expect((await services.db.get("attendance", record!.id))?.status).toBe("present"),
    );
    // Still open on the same day, although it left the table.
    expect(radio(ar.glossary.present)).toBeOnTheScreen();
  });
});
