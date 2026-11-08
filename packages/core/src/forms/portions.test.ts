import { describe, expect, it } from "vitest";
import { checkPortions, emptyPortionDraft, portionDrafts, type PortionDraft } from "./portions";

const draft = (surah: number | null, from: string, to: string, whole = false): PortionDraft => ({
  ...emptyPortionDraft(),
  surah,
  from,
  to,
  whole,
});

describe("checkPortions", () => {
  it("accepts several suras, a whole one counting to its last ayah", () => {
    const result = checkPortions([draft(67, "1", "30"), draft(112, "", "", true)]);
    expect(result).toMatchObject({
      ok: true,
      value: [
        { surah: 67, fromAyah: 1, toAyah: 30 },
        { surah: 112, fromAyah: 1, toAyah: 4 },
      ],
    });
  });

  it("reports each sura's errors in its place", () => {
    const result = checkPortions([
      draft(67, "1", "30"),
      draft(68, "1", "60"),
      draft(null, "", "", true),
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toEqual({});
    expect(result.errors[1]?.toAyah?.code).toBe("AYAH_OUT_OF_RANGE");
    expect(result.errors[2]?.surah?.code).toBe("REQUIRED");
  });

  it("needs at least one sura", () => {
    expect(checkPortions([]).ok).toBe(false);
  });
});

describe("portionDrafts", () => {
  it("shows a portion covering its sura as whole, with unique keys", () => {
    const drafts = portionDrafts([
      { surah: 112, fromAyah: 1, toAyah: 4 },
      { surah: 113, fromAyah: 1, toAyah: 3 },
    ]);
    expect(drafts.map((d) => d.whole)).toEqual([true, false]);
    expect(new Set(drafts.map((d) => d.key)).size).toBe(2);
    expect(portionDrafts([])).toHaveLength(1);
  });
});
