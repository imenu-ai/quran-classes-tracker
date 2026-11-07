import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { createClass } from "@qct/core/data/entities/classes";
import { addHomework } from "@qct/core/data/entities/homework";
import { startLesson } from "@qct/core/data/entities/lessons";
import { createStudent } from "@qct/core/data/entities/students";
import ar from "@qct/core/messages/ar.json";
import { AddSession } from "@/components/add-session";
import { createTestServices, renderWithApp } from "@/test/app-services";
import HomeworkFormScreen from "./app/homework-form";
import StudentDayScreen from "./app/student-day";

jest.mock("expo-router", () => jest.requireActual("@/test/expo-router-mock"));
// The native date picker as a plain view that reports a picked date.
jest.mock("@expo/ui/community/datetime-picker", () => {
  const { View } = jest.requireActual("react-native");
  return {
    DateTimePicker: (props: { testID?: string }) => <View {...props} />,
  };
});

const params = useLocalSearchParams as jest.Mock;
const DAY = "2026-10-05";

async function setup() {
  const services = createTestServices({ session: { permissions: ["lessons.run"] } });
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

beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({});
});

describe("a session on an earlier day", () => {
  it("opens the picked past day, and ignores today or later", async () => {
    const { services, student } = await setup();
    await renderWithApp(<AddSession studentId={student.id} />, services);
    // iOS (Jest's platform): the compact picker sits beside the label.
    expect(screen.getByText(ar.day.add)).toBeOnTheScreen();
    await act(async () => {
      screen.getByTestId("session.date").props.onValueChange({}, new Date(2026, 9, 5, 12));
    });
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/student-day",
      params: { studentId: student.id, date: DAY },
    });
    await act(async () => {
      screen.getByTestId("session.date").props.onValueChange({}, new Date(2999, 0, 1, 12));
    });
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("records on that day's lesson and suggests from homework up to it", async () => {
    const { services, cls, student } = await setup();
    const before = await startLesson(services.store, cls.id, "2026-10-01");
    await addHomework(services.store, {
      studentId: student.id,
      lessonId: before.id,
      portions: [{ surah: 78, fromAyah: 1, toAyah: 10 }],
      note: "",
      evaluateNow: false,
    });
    // Homework given after that day: not due then, and not what it continues from.
    const after = await startLesson(services.store, cls.id, "2026-10-09");
    await addHomework(services.store, {
      studentId: student.id,
      lessonId: after.id,
      portions: [{ surah: 80, fromAyah: 1, toAyah: 10 }],
      note: "",
      evaluateNow: false,
    });

    params.mockReturnValue({ studentId: student.id, date: DAY });
    const view = await renderWithApp(<StudentDayScreen />, services);
    expect(await screen.findByText(ar.day.title)).toBeOnTheScreen();
    expect(screen.getByText("النبأ 1–10")).toBeOnTheScreen();
    expect(screen.queryByText("عبس 1–10")).toBeNull();
    await fireEvent.press(screen.getByRole("radio", { name: ar.glossary.present }));
    await waitFor(async () => {
      const lessons = await services.db.all("lessons");
      expect(lessons.map((l) => l.date).sort()).toEqual(["2026-10-01", DAY, "2026-10-09"]);
    });
    await fireEvent.press(screen.getByRole("button", { name: ar.today.addNext }));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/homework-form",
      params: { studentId: student.id, kind: "next", date: DAY },
    });
    await view.unmount();

    params.mockReturnValue({ studentId: student.id, kind: "next", date: DAY });
    await renderWithApp(<HomeworkFormScreen />, services);
    expect(await screen.findByText(ar.homework.suggested)).toBeOnTheScreen();
    // After النبأ 1–10 (given before that day), not after عبس.
    expect(screen.getByLabelText(ar.glossary.fromAyah)).toHaveDisplayValue("11");
    await fireEvent.press(screen.getByRole("button", { name: ar.common.save }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    const dayLesson = (await services.db.all("lessons")).find((l) => l.date === DAY);
    const homework = await services.db.all("homework");
    expect(homework.find((h) => h.assignedLessonId === dayLesson?.id)).toMatchObject({
      portions: [{ surah: 78, fromAyah: 11, toAyah: 20 }],
    });
  });
});
