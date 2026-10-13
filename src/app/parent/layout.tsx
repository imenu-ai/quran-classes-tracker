import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("parent");
  // A private page behind a parent's ID number: never in search results.
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The parent page: no sign-in and no app navigation. */
export default function ParentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
