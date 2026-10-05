import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import type { Locale } from "@/i18n/config";

// IBM Plex Sans Arabic also contains Latin glyphs, so mixed Arabic/English
// text (names, notes) renders in one family.
const plexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-app",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-app",
  // Only preload the font of the default locale.
  preload: false,
});

/** The font is chosen from the locale, never hardcoded in components. */
export const FONT_BY_LOCALE: Record<Locale, { variable: string }> = {
  ar: plexSansArabic,
  en: plexSans,
};
