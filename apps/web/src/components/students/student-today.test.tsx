// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { NOT_MEMORIZED } from "@qct/core/shared/schemas/homework";
import { homeworkRecord } from "@qct/core/test/records";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { HomeworkItem } from "./student-today";

installDomPolyfills();

const STUDENT = "01928c5e-7b3a-7cde-8f00-00000000bb01";

function Harness(props: Partial<Parameters<typeof HomeworkItem>[0]>) {
  const [open, setOpen] = useState(false);
  return (
    <ul>
      <HomeworkItem
        item={homeworkRecord(STUDENT)}
        label="الفلق 1–5"
        open={open}
        onToggle={() => setOpen((value) => !value)}
        evaluated={false}
        marks={{ memorization: null, behavior: null }}
        choices={{ marks: true, notMemorized: true }}
        onEdit={vi.fn()}
        onRate={vi.fn(async () => {})}
        onUndo={vi.fn(async () => {})}
        {...props}
      />
    </ul>
  );
}

describe("HomeworkItem", () => {
  it("starts closed, showing only the portion, and opens on tap", async () => {
    renderArabic(<Harness />);
    const header = screen.getByRole("button", { name: /الفلق 1–5/ });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("combobox")).toBeNull();

    await userEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("combobox", { name: "تقييم الحفظ" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "تقييم السلوك" })).toBeTruthy();
    // No postpone button: "لم يحفظ" is the memorization picker's first entry.
    expect(screen.queryByRole("button", { name: "تأجيل التسميع" })).toBeNull();
    const memorization = screen.getByRole("combobox", { name: "تقييم الحفظ" }) as HTMLSelectElement;
    expect([...memorization.options].slice(0, 3).map((o) => o.textContent)).toEqual([
      "—",
      "لم يحفظ",
      "0",
    ]);
    const behavior = screen.getByRole("combobox", { name: "تقييم السلوك" }) as HTMLSelectElement;
    expect([...behavior.options].map((o) => o.textContent)).not.toContain("لم يحفظ");
  });

  it("passes not memorized to onRate", async () => {
    const onRate = vi.fn(async () => {});
    renderArabic(<Harness onRate={onRate} />);
    await userEvent.click(screen.getByRole("button", { name: /الفلق 1–5/ }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "تقييم الحفظ" }), "لم يحفظ");
    expect(onRate).toHaveBeenCalledWith("memorizationRate", NOT_MEMORIZED);
  });

  it("shows the marks on the closed row once marked", () => {
    renderArabic(
      <Harness
        evaluated
        item={homeworkRecord(STUDENT, {
          evaluatedLessonId: "01928c5e-7b3a-7cde-8f00-00000000aa01",
          memorizationRate: 9,
          behaviorRate: 10,
        })}
      />,
    );
    expect(screen.getByRole("button", { name: /الفلق 1–5/ }).textContent).toContain("9 · 10");
  });

  it("shows لم يحفظ on the closed row, with that day's behavior mark", async () => {
    const view = renderArabic(<Harness marks={{ memorization: NOT_MEMORIZED, behavior: null }} />);
    const header = screen.getByRole("button", { name: /الفلق 1–5/ });
    expect(header.textContent).toContain("لم يحفظ");
    view.rerender(<Harness marks={{ memorization: NOT_MEMORIZED, behavior: 8.5 }} />);
    expect(header.textContent).toContain("لم يحفظ · 8.5");

    await userEvent.click(header);
    expect(screen.getByText("لم يحفظ، فيبقى الواجب لليوم التالي.")).toBeTruthy();
  });

  it("offers only — and لم يحفظ where marks can't be given", async () => {
    renderArabic(
      <Harness
        marks={{ memorization: NOT_MEMORIZED, behavior: 6 }}
        choices={{ marks: false, notMemorized: true }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /الفلق 1–5/ }));
    const memorization = screen.getByRole("combobox", { name: "تقييم الحفظ" }) as HTMLSelectElement;
    expect([...memorization.options].map((o) => o.textContent)).toEqual(["—", "لم يحفظ"]);
  });

  it("shows an exam with its badge and one mark, and no not memorized", async () => {
    renderArabic(
      <Harness
        exam
        evaluated
        choices={{ marks: true, notMemorized: false }}
        item={homeworkRecord(STUDENT, {
          kind: "exam",
          evaluatedLessonId: "01928c5e-7b3a-7cde-8f00-00000000aa01",
          memorizationRate: 6,
        })}
      />,
    );
    const header = screen.getByRole("button", { name: /الفلق 1–5/ });
    expect(header.textContent).toContain("اختبار");
    expect(header.textContent).toContain("6");

    await userEvent.click(header);
    expect(
      screen.getAllByRole("combobox").map((box) => box.getAttribute("id") !== null),
    ).toHaveLength(1);
    const mark = screen.getByRole("combobox", { name: "درجة الاختبار" }) as HTMLSelectElement;
    expect([...mark.options].map((o) => o.textContent)).not.toContain("لم يحفظ");
  });
});
