import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from "@expo-google-fonts/ibm-plex-sans";
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import type { Locale } from "@qct/core/i18n/config";

/**
 * The fonts, loaded at start under these names (the same on iOS and Android).
 * A custom font has one family per weight in React Native, so styles pick a
 * family instead of setting fontWeight.
 */
export const FONT_FILES = {
  "PlexArabic-Regular": IBMPlexSansArabic_400Regular,
  "PlexArabic-Medium": IBMPlexSansArabic_500Medium,
  "PlexArabic-SemiBold": IBMPlexSansArabic_600SemiBold,
  "PlexArabic-Bold": IBMPlexSansArabic_700Bold,
  "Plex-Regular": IBMPlexSans_400Regular,
  "Plex-Medium": IBMPlexSans_500Medium,
  "Plex-SemiBold": IBMPlexSans_600SemiBold,
  "Plex-Bold": IBMPlexSans_700Bold,
};

export type FontWeightName = "regular" | "medium" | "semibold" | "bold";
export type ThemeFonts = Record<FontWeightName, keyof typeof FONT_FILES>;

/** The font comes from the locale (IBM Plex Sans Arabic for ar, IBM Plex Sans for en). */
export function fontsFor(locale: Locale): ThemeFonts {
  const family = locale === "ar" ? "PlexArabic" : "Plex";
  return {
    regular: `${family}-Regular`,
    medium: `${family}-Medium`,
    semibold: `${family}-SemiBold`,
    bold: `${family}-Bold`,
  };
}
