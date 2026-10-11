// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { homeworkRecord } from "@/test/records";
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
        postponed={false}
        onEdit={vi.fn()}
        onRate={vi.fn(async () => {})}
        onUndo={vi.fn(async () => {})}
        onPostpone={vi.fn(async () => {})}
        onUndoPostpone={vi.fn(async () => {})}
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
    expect(screen.getByRole("button", { name: "تأجيل التسميع" })).toBeTruthy();
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

  it("shows مؤجل on the closed row when postponed", () => {
    renderArabic(<Harness postponed />);
    expect(screen.getByRole("button", { name: /الفلق 1–5/ }).textContent).toContain("مؤجل");
  });
});
