// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ar from "@qct/core/messages/ar.json";
import en from "@qct/core/messages/en.json";
import { PUBLISHER, SUPPORT_EMAIL } from "@qct/core/shared/legal";
import { LegalDocument, PRIVACY_SECTIONS, SUPPORT_SECTIONS } from "./legal-document";

const privacy = { namespace: "privacy", sections: PRIVACY_SECTIONS } as const;

describe("LegalDocument", () => {
  it("shows the privacy policy in both languages, the visitor's first, each in its direction", () => {
    const { container } = render(<LegalDocument document={privacy} locale="ar" />);
    const [first, second] = container.querySelectorAll("article");
    expect(first?.getAttribute("lang")).toBe("ar");
    expect(first?.getAttribute("dir")).toBe("rtl");
    expect(second?.getAttribute("lang")).toBe("en");
    expect(second?.getAttribute("dir")).toBe("ltr");

    const arabic = within(first as HTMLElement);
    expect(arabic.getByRole("heading", { level: 1, name: ar.privacy.title })).toBeTruthy();
    for (const id of PRIVACY_SECTIONS) {
      expect(arabic.getByRole("heading", { name: ar.privacy.sections[id].title })).toBeTruthy();
    }
    // Placeholders filled, paragraphs split.
    expect(
      arabic.getByText(`ينشر التطبيقَ ${PUBLISHER}، في إسرائيل.`, { exact: false }),
    ).toBeTruthy();
    expect(arabic.getByText(/«خروج من هذا الجهاز»/)).toBeTruthy();
    expect(arabic.getByText("المركز: اسمه ومنطقته الزمنية ورمزه.")).toBeTruthy();

    const english = within(second as HTMLElement);
    expect(english.getByRole("heading", { level: 1, name: en.privacy.title })).toBeTruthy();
    expect(english.getByRole("link", { name: SUPPORT_EMAIL }).getAttribute("href")).toBe(
      `mailto:${SUPPORT_EMAIL}`,
    );
    expect(screen.getByRole("link", { name: en.privacy.title }).getAttribute("href")).toBe("#en");
  });

  it("puts English first for an English visitor", () => {
    const { container } = render(
      <LegalDocument document={{ namespace: "support", sections: SUPPORT_SECTIONS }} locale="en" />,
    );
    const [first] = container.querySelectorAll("article");
    expect(first?.getAttribute("lang")).toBe("en");
    expect(
      within(first as HTMLElement).getByRole("heading", { name: en.support.title }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: ar.support.title }).getAttribute("href")).toBe("#ar");
  });
});
