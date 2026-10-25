import { Share } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { createClass } from "@qct/core/data/entities/classes";
import { addHomework, setStudentAttendance } from "@qct/core/data/entities/homework";
import { startLesson } from "@qct/core/data/entities/lessons";
import { createStudent } from "@qct/core/data/entities/students";
import { loadPrintSheets } from "@qct/core/data/entities/print";
import { todayInTimeZone } from "@qct/core/domain/dates/local-date";
import ar from "@qct/core/messages/ar.json";
import { buildSheetsHtml, type SheetText } from "@/print/month-sheet-html";
import { createTestServices, renderWithApp, TEST_SESSION } from "@/test/app-services";
import ParentLinkScreen from "./app/parent-link";
import PrintStudentsScreen from "./app/print-students";

jest.mock("expo-router", () => jest.requireActual("@/test/expo-router-mock"));
jest.mock("expo-print", () => ({
  printAsync: jest.fn(async () => {}),
  printToFileAsync: jest.fn(async () => ({ uri: "file:///cache/Print/random.pdf" })),
}));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-file-system", () => ({
  File: jest.fn(() => ({
    parentDirectory: {},
    uri: "file:///cache/Print/named.pdf",
    move: jest.fn(),
  })),
}));
// Reading the bundled font needs the native asset system; the sheet works without it.
jest.mock("@/print/fonts", () => ({ embeddedFontCss: async () => "" }));

const params = useLocalSearchParams as jest.Mock;
const button = (name: string) => screen.getByRole("button", { name });
const month = todayInTimeZone(TEST_SESSION.timezone).slice(0, 7);

async function setup(parentId = "123456789") {
  const services = createTestServices({ session: { permissions: ["lessons.run"] } });
  const cls = await createClass(services.store, "حلقة الفجر");
  const student = (fullName: string) =>
    createStudent(services.store, {
      classId: cls.id,
      fullName,
      birthYear: 2015,
      note: "",
      memorizationDirection: "forward",
      parentId,
    });
  const ahmad = await student("أحمد <علي>");
  const khalid = await student("خالد");
  const lesson = await startLesson(services.store, cls.id, todayInTimeZone(TEST_SESSION.timezone));
  await setStudentAttendance(services.store, lesson.id, khalid.id, "absent");
  await addHomework(services.store, {
    studentId: ahmad.id,
    lessonId: lesson.id,
    portion: { surah: 78, fromAyah: 1, toAyah: 5 },
    note: "",
    evaluateNow: true,
  });
  return { services, cls, ahmad, khalid };
}

beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({});
});

describe("the printed sheet", () => {
  it("is one page per student, with the QR, the rows, and user text escaped", async () => {
    const { services, cls, ahmad, khalid } = await setup();
    const data = await loadPrintSheets(services.db, cls.id, [ahmad.id, khalid.id], month);
    const text: SheetText = {
      t: (key) => key,
      day: (date) => date,
      month: (key) => key,
      date: (date) => date,
      average: (value) => (value === null ? "—" : String(value)),
      portion: (item) => `${item.surah} ${item.fromAyah}–${item.toAyah}`,
    };
    const html = buildSheetsHtml({
      sheets: data!.sheets,
      centerName: "مركز & النور",
      className: cls.name,
      userName: "معلم",
      month,
      printedOn: `${month}-01`,
      parentUrl: (id) => `https://example.test/parent?s=${id}`,
      fontCss: "",
      text,
    });
    expect(html.match(/<article class="sheet/g)).toHaveLength(2);
    expect(html).toContain(".sheet + .sheet { break-before: page;");
    expect(html.match(/<svg /g)).toHaveLength(2);
    expect(html).toContain("<bdi>أحمد &#60;علي&#62;</bdi>");
    expect(html).toContain("مركز &#38; النور");
    expect(html).toContain("78 1–5");
    expect(html).toContain('<tr class="absence">');
    expect(html).toContain('dir="rtl"');
  });
});

describe("printing", () => {
  it("prints the chosen students, or shares one PDF named after the class", async () => {
    const { services, cls } = await setup();
    params.mockReturnValue({ classId: cls.id });
    await renderWithApp(<PrintStudentsScreen />, services);
    expect(await screen.findByText("2 من 2")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("checkbox", { name: "خالد" }));
    expect(screen.getByText("1 من 2")).toBeOnTheScreen();

    await fireEvent.press(button(ar.print.pageTitle));
    await waitFor(() => expect(Print.printAsync).toHaveBeenCalledTimes(1));
    const { html } = (Print.printAsync as jest.Mock).mock.calls[0]![0] as { html: string };
    expect(html).toContain("أحمد &#60;علي&#62;");
    expect(html).not.toContain("خالد");

    await fireEvent.press(screen.getByRole("checkbox", { name: ar.print.selectAll }));
    expect(screen.getByText("2 من 2")).toBeOnTheScreen();
    await fireEvent.press(button(ar.print.sharePdf));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///cache/Print/named.pdf",
      expect.objectContaining({ mimeType: "application/pdf" }),
    );
  });
});

describe("the parent link", () => {
  it("shows the QR and the link, copies and shares it", async () => {
    const { services, ahmad } = await setup();
    const share = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: "sharedAction", activityType: undefined });
    params.mockReturnValue({ studentId: ahmad.id });
    await renderWithApp(<ParentLinkScreen />, services);
    expect(await screen.findByText(ar.parentLink.hint)).toBeOnTheScreen();
    expect(screen.getByLabelText(ar.parentLink.qr)).toBeOnTheScreen();
    await fireEvent.press(button(ar.parentLink.copy));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      expect.stringContaining(`/parent?s=${ahmad.id}`),
    );
    expect(await screen.findByText(ar.parentLink.copied)).toBeOnTheScreen();
    await fireEvent.press(button(ar.parentLink.share));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining(`/parent?s=${ahmad.id}`) }),
    );
  });

  it("says when no parent ID is set, so the link won't work", async () => {
    const { services, ahmad } = await setup("");
    params.mockReturnValue({ studentId: ahmad.id });
    await renderWithApp(<ParentLinkScreen />, services);
    expect(await screen.findByText(ar.parentLink.notSet)).toBeOnTheScreen();
  });
});
