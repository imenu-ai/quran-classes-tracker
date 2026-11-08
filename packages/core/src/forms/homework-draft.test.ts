import { describe, expect, it } from "vitest";
import { homeworkRecord } from "../test/records";
import { checkHomeworkDraft, startHomeworkDraft, switchEntryMode } from "./homework-draft";

const STUDENT = "01928c5e-7b3a-7cde-8f00-00000000bb01";
const page293 = [
  { surah: 17, fromAyah: 105, toAyah: 111 },
  { surah: 18, fromAyah: 1, toAyah: 4 },
];

describe("startHomeworkDraft", () => {
  it("continues by ayahs after an ayah homework", () => {
    const draft = startHomeworkDraft({
      kind: "next",
      history: [homeworkRecord(STUDENT, { surah: 78, fromAyah: 1, toAyah: 10 })],
      direction: "forward",
    });
    expect(draft).toMatchObject({ mode: "ayahs", suggested: true });
    expect(draft.portions[0]).toMatchObject({ surah: 78, from: "11", to: "20" });
  });

  it("continues by pages after a page homework, the same number of pages", () => {
    const history = [homeworkRecord(STUDENT, { portions: page293, pages: { from: 293, to: 293 } })];
    expect(startHomeworkDraft({ kind: "next", history, direction: "forward" })).toMatchObject({
      mode: "pages",
      pages: { from: "294", to: "294" },
      suggested: true,
    });
    expect(startHomeworkDraft({ kind: "recite", history, direction: "backward" })).toMatchObject({
      mode: "pages",
      pages: { from: "292", to: "292" },
    });
  });

  it("opens an item as it was given, and an exam empty by ayahs", () => {
    const item = homeworkRecord(STUDENT, { portions: page293, pages: { from: 293, to: 293 } });
    expect(
      startHomeworkDraft({ kind: "edit", item, history: [item], direction: "forward" }),
    ).toMatchObject({ mode: "pages", pages: { from: "293", to: "293" }, suggested: false });
    expect(
      startHomeworkDraft({ kind: "exam", history: [item], direction: "forward" }),
    ).toMatchObject({ mode: "ayahs", pages: { from: "", to: "" }, suggested: false });
  });
});

describe("switching and saving", () => {
  it("saves pages with their portions, and ayahs without pages", () => {
    const draft = startHomeworkDraft({ kind: "exam", history: [], direction: "forward" });
    const byPages = { ...switchEntryMode(draft, "pages"), pages: { from: "293", to: "293" } };
    expect(checkHomeworkDraft(byPages)).toEqual({
      ok: true,
      portions: page293,
      pages: { from: 293, to: 293 },
    });
    // Back to ayahs: the pages' suras, to adjust; saved without pages.
    const byAyahs = switchEntryMode(byPages, "ayahs");
    expect(byAyahs.portions.map((p) => [p.surah, p.from, p.to])).toEqual([
      [17, "105", "111"],
      [18, "1", "4"],
    ]);
    expect(checkHomeworkDraft(byAyahs)).toEqual({ ok: true, portions: page293, pages: null });
    expect(checkHomeworkDraft({ ...byPages, pages: { from: "", to: "" } })).toEqual({ ok: false });
  });
});
