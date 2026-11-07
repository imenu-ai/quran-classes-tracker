// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HomeworkPortion, PageRange } from "@qct/core/shared/schemas/homework";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { usePortionLabel } from "./use-portion-label";

installDomPolyfills();

function Label(props: { portions: HomeworkPortion[]; pages?: PageRange | null }) {
  const label = usePortionLabel();
  return <p>{label(props)}</p>;
}

const text = (props: Parameters<typeof Label>[0]) => {
  const view = renderArabic(<Label {...props} />);
  const value = screen.getByRole("paragraph").textContent;
  view.unmount();
  return value;
};

describe("usePortionLabel", () => {
  it("names each sura with its range, or كاملة for a whole one", () => {
    expect(text({ portions: [{ surah: 78, fromAyah: 31, toAyah: 35 }] })).toBe("النبأ 31–35");
    expect(text({ portions: [{ surah: 113, fromAyah: 1, toAyah: 5 }] })).toBe("الفلق كاملة");
    expect(
      text({
        portions: [
          { surah: 67, fromAyah: 1, toAyah: 30 },
          { surah: 68, fromAyah: 1, toAyah: 15 },
        ],
      }),
    ).toBe("الملك كاملة، القلم 1–15");
  });

  it("puts the pages first when it was given as pages", () => {
    expect(
      text({
        portions: [
          { surah: 17, fromAyah: 105, toAyah: 111 },
          { surah: 18, fromAyah: 1, toAyah: 4 },
        ],
        pages: { from: 293, to: 293 },
      }),
    ).toBe("ص 293 · الإسراء 105–111، الكهف 1–4");
    expect(
      text({ portions: [{ surah: 2, fromAyah: 1, toAyah: 16 }], pages: { from: 2, to: 3 } }),
    ).toBe("ص 2–3 · البقرة 1–16");
  });
});
