// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { ScorePicker } from "./score-picker";

installDomPolyfills();

const pressed = () =>
  screen
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.textContent);

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
  it("shows the tapped score before the write lands, then follows the stored value", async () => {
    const write = deferred();
    const onChange = vi.fn(() => write.promise);
    const view = renderArabic(<ScorePicker label="الحفظ" value={7} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(onChange).toHaveBeenCalledWith(3);
    expect(pressed()).toEqual(["3"]);

    // The live query catches up.
    view.rerender(<ScorePicker label="الحفظ" value={3} onChange={onChange} />);
    await act(async () => write.resolve());
    expect(pressed()).toEqual(["3"]);

    // Later, a sync brings back the old score: it shows, not the stale tap.
    view.rerender(<ScorePicker label="الحفظ" value={7} onChange={onChange} />);
    expect(pressed()).toEqual(["7"]);
  });

  it("tapping the selected score clears it at once", async () => {
    const onChange = vi.fn(() => new Promise<void>(() => {}));
    renderArabic(<ScorePicker label="الحفظ" value={7} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "7" }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(pressed()).toEqual([]);
  });

  it("goes back to the stored value when the write fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const write = deferred();
    renderArabic(<ScorePicker label="الحفظ" value={7} onChange={() => write.promise} />);

    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(pressed()).toEqual(["3"]);
    await act(async () => write.reject(new Error("QuotaExceededError")));
    expect(pressed()).toEqual(["7"]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
