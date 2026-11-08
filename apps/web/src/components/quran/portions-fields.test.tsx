// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { checkPortions, portionDrafts, type PortionDraft } from "@qct/core/forms/portions";
import { installDomPolyfills, renderArabic } from "@/test/dom";
import { PortionsFields } from "./portions-fields";

installDomPolyfills();

let latest: PortionDraft[] = [];

function Harness({ initial }: { initial: PortionDraft[] }) {
  const [drafts, setDrafts] = useState(initial);
  latest = drafts;
  const check = checkPortions(drafts);
  return (
    <PortionsFields
      value={drafts}
      onChange={setDrafts}
      errors={check.errors}
      visibleErrors={new Set()}
    />
  );
}

describe("PortionsFields", () => {
  it("adds and removes suras; a whole sura hides its ayah fields", async () => {
    renderArabic(<Harness initial={portionDrafts([{ surah: 67, fromAyah: 1, toAyah: 10 }])} />);
    expect(screen.getAllByRole("textbox", { name: "من آية" })).toHaveLength(1);
    // One sura: nothing to remove.
    expect(screen.queryByRole("button", { name: "حذف هذه السورة" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "إضافة سورة" }));
    expect(screen.getAllByRole("textbox", { name: "من آية" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "حذف هذه السورة" })).toHaveLength(2);

    const [firstWhole] = screen.getAllByRole("checkbox", { name: "السورة كاملة" });
    await userEvent.click(firstWhole!);
    expect(screen.getAllByRole("textbox", { name: "من آية" })).toHaveLength(1);
    expect(latest[0]?.whole).toBe(true);

    await userEvent.click(screen.getAllByRole("button", { name: "حذف هذه السورة" })[1]!);
    expect(latest).toHaveLength(1);
    expect(checkPortions(latest)).toMatchObject({
      ok: true,
      value: [{ surah: 67, fromAyah: 1, toAyah: 30 }],
    });
  });

  it("opens a saved whole sura as whole", () => {
    renderArabic(<Harness initial={portionDrafts([{ surah: 112, fromAyah: 1, toAyah: 4 }])} />);
    expect(
      (screen.getByRole("checkbox", { name: "السورة كاملة" }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.queryByRole("textbox", { name: "من آية" })).toBeNull();
  });
});
