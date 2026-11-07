import { describe, expect, it } from "vitest";
import { suggestNextPages } from "../domain/homework/suggestion";
import { checkPageRange, pageRangeDraft } from "./pages";

describe("checkPageRange", () => {
  it("gives the pages and the suras and ayahs on them, from Arabic digits too", () => {
    expect(checkPageRange({ from: "٢٩٣", to: "293" })).toMatchObject({
      ok: true,
      value: { from: 293, to: 293 },
      portions: [
        { surah: 17, fromAyah: 105, toAyah: 111 },
        { surah: 18, fromAyah: 1, toAyah: 4 },
      ],
    });
  });

  it("reports each field's problem", () => {
    expect(checkPageRange({ from: "", to: "x" }).errors).toMatchObject({
      fromPage: { code: "REQUIRED" },
      toPage: { code: "NOT_INTEGER" },
    });
    expect(checkPageRange({ from: "0", to: "605" }).errors).toMatchObject({
      fromPage: { code: "TOO_SMALL", params: { minimum: 1 } },
      toPage: { code: "TOO_LARGE", params: { maximum: 604 } },
    });
    expect(checkPageRange({ from: "12", to: "11" }).errors).toMatchObject({
      toPage: { code: "PAGE_FROM_AFTER_TO" },
    });
  });

  it("fills a draft from saved pages", () => {
    expect(pageRangeDraft({ from: 12, to: 13 })).toEqual({ from: "12", to: "13" });
    expect(pageRangeDraft(null)).toEqual({ from: "", to: "" });
  });
});

describe("suggestNextPages", () => {
  it("continues with as many pages, forward or backward, within the mushaf", () => {
    expect(suggestNextPages({ from: 12, to: 13 }, "forward")).toEqual({ from: 14, to: 15 });
    expect(suggestNextPages({ from: 603, to: 603 }, "forward")).toEqual({ from: 604, to: 604 });
    expect(suggestNextPages({ from: 602, to: 603 }, "forward")).toEqual({ from: 604, to: 604 });
    expect(suggestNextPages({ from: 603, to: 604 }, "forward")).toBeNull();
    expect(suggestNextPages({ from: 604, to: 604 }, "backward")).toEqual({ from: 603, to: 603 });
    expect(suggestNextPages({ from: 2, to: 4 }, "backward")).toEqual({ from: 1, to: 1 });
    expect(suggestNextPages({ from: 1, to: 2 }, "backward")).toBeNull();
  });
});
