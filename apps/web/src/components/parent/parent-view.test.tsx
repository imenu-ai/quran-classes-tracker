// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParentReport } from "@/shared/parent";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { ParentView } from "./parent-view";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

installDomPolyfills();

const STUDENT = "01928c5e-7b3a-7cde-8f00-00000000bb01";

const report: ParentReport = {
  centerName: "مركز النور",
  className: "حلقة الفجر",
  studentName: "أحمد",
  month: "2026-10",
  months: ["2026-10", "2026-09"],
  rows: [
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
      toAyah: 5,
      memorization: null,
      behavior: null,
      excuseNote: "",
    },
  ],
  memorizationAverage: 9,
  behaviorAverage: 8,
  counts: { present: 2, absent: 0, excused: 1, evaluated: 1, exams: 1, postponed: 1 },
};

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("ParentView", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    replace.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sent = (call: number) => JSON.parse(fetchMock.mock.calls[call]![1].body as string);

  it("says an unset or unknown link isn't valid", async () => {
    fetchMock.mockReturnValueOnce(json(404, { error: "INVALID_LINK" }));
    renderArabic(<ParentView studentId={STUDENT} month={null} />);
    expect(await screen.findByText("هذا الرابط غير صالح")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("asks for the ID number, explains a wrong one, then shows the month", async () => {
    fetchMock
      .mockReturnValueOnce(json(401, { error: "PARENT_ID_REQUIRED" }))
      .mockReturnValueOnce(json(401, { error: "WRONG_PARENT_ID" }))
      .mockReturnValueOnce(json(200, report));
    renderArabic(<ParentView studentId={STUDENT} month={null} />);

    const input = await screen.findByRole("textbox", { name: "رقم هوية ولي الأمر" });
    await userEvent.type(input, "11111");
    await userEvent.click(screen.getByRole("button", { name: "عرض" }));
    expect(await screen.findByText("رقم الهوية غير صحيح")).toBeTruthy();
    expect(sent(1)).toEqual({ studentId: STUDENT, parentId: "11111" });

    await userEvent.clear(input);
    await userEvent.type(input, "401234567");
    await userEvent.click(screen.getByRole("button", { name: "عرض" }));
    expect(await screen.findByRole("heading", { level: 1, name: "أحمد" })).toBeTruthy();
    expect(screen.getByText("مركز النور")).toBeTruthy();
    expect(screen.getByText("حلقة الفجر")).toBeTruthy();
  });

  it("shows the month: rows, the exam's one mark, averages and counts", async () => {
    fetchMock.mockReturnValueOnce(json(200, report));
    renderArabic(<ParentView studentId={STUDENT} month={null} />);

    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(rows[1]?.textContent).toMatch(/الإخلاص 1–4.*9.*8/);
    expect(rows[2]?.textContent).toContain("غائب بعذر");
    expect(rows[2]?.textContent).toContain("مريض");
    expect(rows[3]?.textContent).toContain("اختبار");
    expect(rows[3]?.className).toContain("bg-exam");
    expect(rows[4]?.textContent).toContain("مؤجل");

    const summary = screen.getByRole("region", { name: "المعدل" });
    expect(summary.textContent).toContain("9.0");
    expect(summary.textContent).toContain("8.0");
    const count = (name: string) =>
      within(summary).getByText(name).closest("div")?.querySelector("dd")?.textContent;
    expect(count("الاختبارات")).toBe("1");
    expect(count("الغياب بعذر")).toBe("1");
  });

  it("keeps a picked month in the URL, and asks for it", async () => {
    fetchMock.mockReturnValueOnce(json(200, report));
    const { rerender } = renderArabic(<ParentView studentId={STUDENT} month={null} />);
    await userEvent.selectOptions(
      await screen.findByRole("combobox", { name: "الشهر" }),
      "2026-09",
    );
    expect(replace).toHaveBeenCalledWith(`/parent?s=${STUDENT}&month=2026-09`, { scroll: false });

    fetchMock.mockReturnValueOnce(json(200, { ...report, month: "2026-09", rows: [] }));
    rerender(<ParentView studentId={STUDENT} month="2026-09" />);
    expect(await screen.findByText("لا يوجد سجل لهذا الشهر")).toBeTruthy();
    expect(sent(1)).toEqual({ studentId: STUDENT, month: "2026-09" });
  });

  it("forgets this phone on sign-out", async () => {
    fetchMock.mockReturnValueOnce(json(200, report)).mockReturnValueOnce(json(200, { ok: true }));
    renderArabic(<ParentView studentId={STUDENT} month={null} />);
    await userEvent.click(await screen.findByRole("button", { name: "خروج من هذا الجهاز" }));

    expect(fetchMock.mock.calls[1]![0]).toBe(`/api/parent?s=${STUDENT}`);
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ method: "DELETE" });
    expect(await screen.findByRole("textbox", { name: "رقم هوية ولي الأمر" })).toBeTruthy();
  });

  it("says when there's no connection", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderArabic(<ParentView studentId={STUDENT} month={null} />);
    expect(await screen.findByText(/لا يوجد اتصال بالإنترنت/)).toBeTruthy();
  });
});
