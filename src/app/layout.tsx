import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "@/components/providers";
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
  const direction = getDirection(locale);

  return (
    // suppressHydrationWarning: next-themes sets the theme class before hydration.
    <html
      lang={locale}
      dir={direction}
      className={FONT_BY_LOCALE[locale].variable}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <Providers direction={direction}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
