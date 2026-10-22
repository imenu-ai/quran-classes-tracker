import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "@/components/providers";
import { toAppLocale } from "@/i18n/config";
import { getDirection } from "@/i18n/direction";
import { FONT_BY_LOCALE } from "./fonts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: t("name"),
    applicationName: t("name"),
    description: t("description"),
    // iOS: runs as a standalone app from the Home Screen.
    appleWebApp: { capable: true, title: t("shortName"), statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lay out under the notch / home indicator; the shell pads with safe-area insets.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfefd" },
    { media: "(prefers-color-scheme: dark)", color: "#0a110f" },
  ],
};

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
