import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LegalDocument, legalTitle, PRIVACY_SECTIONS } from "@/components/legal/legal-document";
import { toAppLocale } from "@qct/core/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  return { title: legalTitle("privacy", toAppLocale(await getLocale())) };
}

/** /privacy: the privacy policy, public, linked from the apps and the store listings. */
export default async function PrivacyPage() {
  return (
    <LegalDocument
      document={{ namespace: "privacy", sections: PRIVACY_SECTIONS }}
      locale={toAppLocale(await getLocale())}
    />
  );
}
