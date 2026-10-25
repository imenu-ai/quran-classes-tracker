import { I18nManager } from "react-native";
import { screen } from "@testing-library/react-native";
import type { ReactTestRendererJSON } from "react-test-renderer";
import { useLocalSearchParams } from "expo-router";
import { createClass } from "@qct/core/data/entities/classes";
import { addHomework, rateHomework } from "@qct/core/data/entities/homework";
import { startLesson } from "@qct/core/data/entities/lessons";
import { createStudent } from "@qct/core/data/entities/students";
import en from "@qct/core/messages/en.json";
import { createTestServices, renderWithApp } from "@/test/app-services";
import ClassScreen from "./app/(tabs)/(home)/class/[id]";
import ClassStatsScreen from "./app/(tabs)/(home)/class-stats/[id]";
import HomeScreen from "./app/(tabs)/(home)/index";
import SettingsScreen from "./app/(tabs)/settings/index";
import StudentScreen from "./screens/student-screen";

jest.mock("expo-router", () => jest.requireActual("@/test/expo-router-mock"));

const params = useLocalSearchParams as jest.Mock;
const ARABIC = /[\u0600-\u06FF]/;

/** Every text and label on the screen, to catch Arabic left in an English UI. */
function shownTexts(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): string[] {
  if (node === null) return [];
  if (Array.isArray(node)) return node.flatMap(shownTexts);
  const labels = [node.props.accessibilityLabel, node.props.placeholder].filter(
    (value): value is string => typeof value === "string",
  );
  const children = (node.children ?? []).flatMap((child) =>
    typeof child === "string" ? [child] : shownTexts(child),
  );
  return [...labels, ...children];
}

const arabicOnScreen = () =>
  shownTexts(screen.toJSON() as ReactTestRendererJSON | null).filter((text) => ARABIC.test(text));

/** An English-speaking admin with a class, a student and a marked recitation, all in Latin. */
async function setup() {
  const services = createTestServices({
    session: { locale: "en", role: "admin", name: "Adam", tenantName: "Light Center" },
  });
  const cls = await createClass(services.store, "Fajr");
  const student = await createStudent(services.store, {
    classId: cls.id,
    fullName: "Omar Ali",
    birthYear: 2015,
    note: "",
    memorizationDirection: "forward",
    parentId: "",
  });
  const lesson = await startLesson(services.store, cls.id, "2026-10-01");
  const item = await addHomework(services.store, {
    studentId: student.id,
    lessonId: lesson.id,
    portion: { surah: 78, fromAyah: 1, toAyah: 10 },
    note: "",
    evaluateNow: true,
  });
  await rateHomework(services.store, item, lesson.id, "memorizationRate", 9);
  return { services, cls, student };
}

beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({});
});

// The hidden English version (PLAN.md §2.14): the main screens render in
// English, left to right, with nothing left in Arabic. The direction itself
// is the app's start-up setting, left to right outside Arabic.
describe("English, left to right", () => {
  it("runs left to right", () => {
    expect(I18nManager.isRTL).toBe(false);
  });

  it("the check finds Arabic where there is some", async () => {
    const { services } = await setup();
    await renderWithApp(<HomeScreen />, services, "ar");
    await screen.findByText("Fajr");
    expect(arabicOnScreen()).not.toEqual([]);
  });

  it("the classes", async () => {
    const { services } = await setup();
    await renderWithApp(<HomeScreen />, services, "en");
    expect(await screen.findByText("Fajr")).toBeOnTheScreen();
    expect(screen.getByText("1 student")).toBeOnTheScreen();
    expect(arabicOnScreen()).toEqual([]);
  });

  it("a class", async () => {
    const { services, cls } = await setup();
    params.mockReturnValue({ id: cls.id });
    await renderWithApp(<ClassScreen />, services, "en");
    expect(await screen.findByText("Omar Ali")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: en.students.add })).toBeOnTheScreen();
    expect(arabicOnScreen()).toEqual([]);
  });

  it("a student: today, the recitations and the month table", async () => {
    const { services, student } = await setup();
    params.mockReturnValue({ id: student.id });
    await renderWithApp(<StudentScreen />, services, "en");
    expect(await screen.findByRole("radio", { name: en.glossary.present })).toBeOnTheScreen();
    expect(await screen.findByText("October 2026")).toBeOnTheScreen();
    expect(arabicOnScreen()).toEqual([]);
  });

  it("the class statistics", async () => {
    const { services, cls } = await setup();
    params.mockReturnValue({ id: cls.id });
    await renderWithApp(<ClassStatsScreen />, services, "en");
    expect(await screen.findByText("Omar Ali")).toBeOnTheScreen();
    expect(arabicOnScreen()).toEqual([]);
  });

  it("the settings", async () => {
    const { services } = await setup();
    await renderWithApp(<SettingsScreen />, services, "en");
    expect(await screen.findByText(en.settings.syncTitle)).toBeOnTheScreen();
    expect(arabicOnScreen()).toEqual([]);
  });
});
