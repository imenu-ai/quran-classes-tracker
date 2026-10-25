import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LegalDocument, legalTitle, SUPPORT_SECTIONS } from "@/components/legal/legal-document";
import { toAppLocale } from "@qct/core/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  return { title: legalTitle("support", toAppLocale(await getLocale())) };
}

/** /support: how to get help, public, linked from the apps and the store listings. */
export default async function SupportPage() {
  return (
    <LegalDocument
      document={{ namespace: "support", sections: SUPPORT_SECTIONS }}
      locale={toAppLocale(await getLocale())}
    />
  );
}
