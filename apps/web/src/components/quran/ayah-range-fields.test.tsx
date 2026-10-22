// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  checkAyahRange,
  type AyahRangeDraft,
  type AyahRangeField,
} from "@/client/forms/ayah-range";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { AyahRangeFields } from "./ayah-range-fields";
import { SurahPicker } from "./surah-picker";

installDomPolyfills();

/** Same wiring as the homework form: errors show once a field is touched. */
function Harness({ initial }: { initial: AyahRangeDraft }) {
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState<Set<AyahRangeField>>(new Set());
  return (
    <AyahRangeFields
      value={draft}
      errors={checkAyahRange(draft).errors}
      visibleErrors={touched}
      onChange={(next, field) => {
        setDraft(next);
        setTouched((current) => new Set(current).add(field));
      }}
    />
  );
}

describe("AyahRangeFields", () => {
  it("shows the allowed range and limits input length for the chosen sura", () => {
    renderArabic(<Harness initial={{ surah: 108, from: "", to: "" }} />);
    expect(screen.getByRole("button", { name: "السورة" }).textContent).toBe(
      "108 · الكوثر · 3 آيات",
    );
    expect(screen.getByText("من 1 إلى 3")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "من آية" }).getAttribute("maxlength")).toBe("1");
  });

  it("shows the Arabic error as soon as the value is out of range", async () => {
    const user = userEvent.setup();
    renderArabic(<Harness initial={{ surah: 108, from: "1", to: "" }} />);
    await user.type(screen.getByRole("textbox", { name: "إلى آية" }), "4");
    expect(await screen.findByText("سورة الكوثر تحتوي على 3 آيات فقط")).toBeTruthy();

    await user.clear(screen.getByRole("textbox", { name: "إلى آية" }));
    await user.type(screen.getByRole("textbox", { name: "إلى آية" }), "3");
    await waitFor(() => expect(screen.queryByText(/تحتوي على/)).toBeNull());
  });

  it("reports from > to and a zero ayah", async () => {
    const user = userEvent.setup();
    renderArabic(<Harness initial={{ surah: 2, from: "", to: "5" }} />);
    await user.type(screen.getByRole("textbox", { name: "من آية" }), "9");
    // FROM_AFTER_TO belongs to "toAyah", which isn't touched yet: touch it.
    await user.type(screen.getByRole("textbox", { name: "إلى آية" }), "{Backspace}5");
    expect(
      await screen.findByText("آية البداية يجب أن تكون قبل أو تساوي آية النهاية"),
    ).toBeTruthy();

    await user.clear(screen.getByRole("textbox", { name: "من آية" }));
    await user.type(screen.getByRole("textbox", { name: "من آية" }), "0");
    expect(await screen.findByText("رقم الآية غير صحيح")).toBeTruthy();
  });
});

describe("SurahPicker", () => {
  it('finds "الإسراء" when typing "الاسراء" and returns its number', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderArabic(<SurahPicker value={null} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /اختر السورة/ }));
    await user.type(await screen.findByRole("combobox"), "الاسراء");
    const option = await screen.findByRole("option", { name: "17 · الإسراء · 111 آية" });
    await user.click(option);
    expect(onChange).toHaveBeenCalledWith(17);
  });

  it("searches by number", async () => {
    const user = userEvent.setup();
    renderArabic(<SurahPicker value={null} onChange={() => {}} />);
    await user.click(screen.getByRole("button", { name: /اختر السورة/ }));
    await user.type(await screen.findByRole("combobox"), "114");
    expect(await screen.findByRole("option", { name: "114 · الناس · 6 آيات" })).toBeTruthy();
  });
});
