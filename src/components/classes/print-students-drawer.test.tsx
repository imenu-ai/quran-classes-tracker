// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { classRecord, studentRecord } from "@/test/records";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { PrintStudentsDrawer } from "./print-students-drawer";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

installDomPolyfills();

const cls = classRecord();
const students = ["أحمد", "خالد", "سالم"].map((fullName) => studentRecord(cls.id, { fullName }));

function renderDrawer() {
  push.mockClear();
  renderArabic(
    <PrintStudentsDrawer
      open
      onOpenChange={vi.fn()}
      classId={cls.id}
      students={students}
      months={["2026-10", "2026-09"]}
      defaultMonth="2026-09"
    />,
  );
  const selectAll = screen.getByRole("checkbox", { name: /تحديد الكل/ }) as HTMLInputElement;
  const box = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
  const show = screen.getByRole("button", { name: "عرض للطباعة" }) as HTMLButtonElement;
  return { selectAll, box, show };
}

describe("PrintStudentsDrawer", () => {
  it("starts on the default month with every student selected", async () => {
    const { selectAll, box } = renderDrawer();
    expect((screen.getByRole("combobox", { name: "الشهر" }) as HTMLSelectElement).value).toBe(
      "2026-09",
    );
    expect(selectAll.checked).toBe(true);
    expect(students.every((s) => box(s.fullName).checked)).toBe(true);
    expect(selectAll.closest("label")?.textContent).toContain("3 من 3");
  });

  it("selects none and all in one tap, with a dash when only some are", async () => {
    const { selectAll, box, show } = renderDrawer();
    await userEvent.click(selectAll);
    expect(students.some((s) => box(s.fullName).checked)).toBe(false);
    expect(show.disabled).toBe(true);

    await userEvent.click(box("خالد"));
    expect(selectAll.checked).toBe(false);
    expect(selectAll.indeterminate).toBe(true);
    expect(selectAll.closest("label")?.textContent).toContain("1 من 3");

    await userEvent.click(selectAll);
    expect(selectAll.checked).toBe(true);
    expect(selectAll.indeterminate).toBe(false);
  });

  it("opens the print page for the chosen month and students, in list order", async () => {
    const { box, show } = renderDrawer();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "الشهر" }), "2026-10");
    await userEvent.click(box("خالد"));
    await userEvent.click(show);

    expect(push).toHaveBeenCalledOnce();
    const url = new URL(push.mock.calls[0]![0] as string, "https://app.test");
    expect(url.pathname).toBe("/print");
    expect(url.searchParams.get("class")).toBe(cls.id);
    expect(url.searchParams.get("month")).toBe("2026-10");
    expect(url.searchParams.get("students")).toBe(`${students[0]!.id},${students[2]!.id}`);
  });
});
