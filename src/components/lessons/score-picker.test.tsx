// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { ScorePicker } from "./score-picker";

installDomPolyfills();

const select = () => screen.getByRole("combobox", { name: "الحفظ" }) as HTMLSelectElement;

/** A write that only settles when the test says so. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ScorePicker", () => {
  it("offers no mark and 1 to 10, showing the stored mark", () => {
    renderArabic(<ScorePicker label="الحفظ" value={7} onChange={vi.fn()} />);
    expect([...select().options].map((option) => option.textContent)).toEqual([
      "—",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);
    expect(select().value).toBe("7");
  });

  it("shows the chosen mark before the write lands, then follows the stored value", async () => {
    const write = deferred();
    const onChange = vi.fn(() => write.promise);
    const view = renderArabic(<ScorePicker label="الحفظ" value={7} onChange={onChange} />);

    await userEvent.selectOptions(select(), "3");
    expect(onChange).toHaveBeenCalledWith(3);
    expect(select().value).toBe("3");

    // The live query catches up.
    view.rerender(<ScorePicker label="الحفظ" value={3} onChange={onChange} />);
    await act(async () => write.resolve());
    expect(select().value).toBe("3");

    // Later, a sync brings back the old mark: it shows, not the stale choice.
    view.rerender(<ScorePicker label="الحفظ" value={7} onChange={onChange} />);
    expect(select().value).toBe("7");
  });

  it("choosing — clears the mark", async () => {
    const onChange = vi.fn(() => new Promise<void>(() => {}));
    renderArabic(<ScorePicker label="الحفظ" value={7} onChange={onChange} />);
    await userEvent.selectOptions(select(), "");
    expect(onChange).toHaveBeenCalledWith(null);
    expect(select().value).toBe("");
  });

  it("goes back to the stored mark when the write fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const write = deferred();
    renderArabic(<ScorePicker label="الحفظ" value={7} onChange={() => write.promise} />);

    await userEvent.selectOptions(select(), "3");
    expect(select().value).toBe("3");
    await act(async () => write.reject(new Error("QuotaExceededError")));
    expect(select().value).toBe("7");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
