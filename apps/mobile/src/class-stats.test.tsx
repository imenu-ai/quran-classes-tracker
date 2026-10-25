import { fireEvent, screen, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { createClass } from "@qct/core/data/entities/classes";
import { addHomework, rateHomework, setStudentAttendance } from "@qct/core/data/entities/homework";
import { startLesson } from "@qct/core/data/entities/lessons";
import { createStudent } from "@qct/core/data/entities/students";
import ar from "@qct/core/messages/ar.json";
import type { AppServices } from "@/data/app-data";
import { createTestServices, renderWithApp } from "@/test/app-services";
import ClassStatsScreen from "./app/(tabs)/(home)/class-stats/[id]";

jest.mock("expo-router", () => jest.requireActual("@/test/expo-router-mock"));

const params = useLocalSearchParams as jest.Mock;
const button = (name: string) => screen.getByRole("button", { name });

/**
 * A class with two students over two lessons (September and October):
 * أحمد comes to both and gets a 9; خالد misses September and gets a 7.
 */
async function setup(services: AppServices) {
  const cls = await createClass(services.store, "حلقة الفجر");
  const student = (fullName: string) =>
    createStudent(services.store, {
      classId: cls.id,
      fullName,
      birthYear: 2015,
      note: "",
      memorizationDirection: "forward",
      parentId: "",
    });
  const ahmad = await student("أحمد");
  const khalid = await student("خالد");
  const september = await startLesson(services.store, cls.id, "2026-09-10");
  const october = await startLesson(services.store, cls.id, "2026-10-05");
  await setStudentAttendance(services.store, september.id, ahmad.id, "present");
  await setStudentAttendance(services.store, september.id, khalid.id, "absent");
  for (const [who, mark] of [
    [ahmad, 9],
    [khalid, 7],
  ] as const) {
    await setStudentAttendance(services.store, october.id, who.id, "present");
    const item = await addHomework(services.store, {
      studentId: who.id,
      lessonId: october.id,
      portion: { surah: 78, fromAyah: 1, toAyah: 5 },
      note: "",
      evaluateNow: true,
    });
    await rateHomework(services.store, item, october.id, "memorizationRate", mark);
  }
  params.mockReturnValue({ id: cls.id });
  return { cls, ahmad, khalid };
}

beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({});
});

describe("class statistics", () => {
  it("shows all time: the attendance rate, the averages and the ranking", async () => {
    const services = createTestServices({ session: { permissions: ["reports.view"] } });
    const { ahmad } = await setup(services);
    await renderWithApp(<ClassStatsScreen />, services);
    expect(await screen.findByText(`${ar.classStats.period}: ${ar.classStats.allTime}`));
    expect(screen.getByText(/75/)).toBeOnTheScreen();
    expect(screen.getByText("حضور 3 · غياب 1 · بعذر 0")).toBeOnTheScreen();
    expect(screen.getByText("8.0")).toBeOnTheScreen();
    // أحمد first (attended every lesson), then خالد.
    const first = screen.getByLabelText("المرتبة 1");
    const ranked = screen
      .getAllByRole("button")
      .filter((b) => within(b).queryByText(/^(أحمد|خالد)$/));
    expect(within(ranked[0]!).getByText("أحمد")).toBeOnTheScreen();
    expect(within(ranked[1]!).getByText("خالد")).toBeOnTheScreen();
    expect(first).toBeOnTheScreen();
    await fireEvent.press(ranked[0]!);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/student/[id]",
      params: { id: ahmad.id },
    });
  });

  it("narrows to a month from the period menu", async () => {
    const services = createTestServices({ session: { permissions: ["reports.view"] } });
    await setup(services);
    await renderWithApp(<ClassStatsScreen />, services);
    await fireEvent.press(await screen.findByRole("button", { name: "سبتمبر 2026" }));
    expect(await screen.findByText(`${ar.classStats.period}: سبتمبر 2026`)).toBeOnTheScreen();
    expect(screen.getByText("حضور 1 · غياب 1 · بعذر 0")).toBeOnTheScreen();
    await fireEvent.press(button("يناير 2026"));
    expect(await screen.findByText(ar.classStats.noLessons)).toBeOnTheScreen();
    await fireEvent.press(button(ar.classStats.allTime));
    expect(await screen.findByText("حضور 3 · غياب 1 · بعذر 0")).toBeOnTheScreen();
  });

  it("is closed to users who may not view reports", async () => {
    const services = createTestServices();
    await setup(services);
    await renderWithApp(<ClassStatsScreen />, services);
    expect(await screen.findByText(ar.classStats.notAllowed)).toBeOnTheScreen();
    expect(screen.queryByText(ar.classStats.ranking)).toBeNull();
  });
});
