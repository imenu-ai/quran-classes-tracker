import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { toAppLocale } from "@/i18n/config";
import { getDirection } from "@/i18n/direction";
import { FONT_BY_LOCALE } from "./fonts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("name"), applicationName: t("name") };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = toAppLocale(await getLocale());

  return (
    <html lang={locale} dir={getDirection(locale)} className={FONT_BY_LOCALE[locale].variable}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
