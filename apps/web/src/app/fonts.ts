import localFont from "next/font/local";
import type { Locale } from "@qct/core/i18n/config";

// The font files live in the repo (./fonts, OFL.txt), converted to WOFF2
// from the TTFs the mobile app bundles: next/font/google downloads them at
// build time, and a Google Fonts answer with extensionless file URLs once
// broke the Amplify build. One file per weight holds every script, so no
// unicode-range subsets.

// IBM Plex Sans Arabic also contains Latin glyphs, so mixed Arabic/English
// text (names, notes) renders in one family.
const plexSansArabic = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-arabic-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-arabic-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-arabic-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ibm-plex-sans-arabic-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-app",
});

const plexSans = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ibm-plex-sans-700.woff2", weight: "700", style: "normal" },
  ],
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
