import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from "expo-router";
import { useAppLocale } from "@/i18n/locale";
import { COLORS, type ColorScheme, type ThemeColors } from "./colors";
import { fontsFor, type ThemeFonts } from "./fonts";

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  fonts: ThemeFonts;
}

/** Light or dark (following the phone's setting), with the locale's fonts. */
export function useTheme(): Theme {
  const scheme: ColorScheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, colors: COLORS[scheme], fonts: fontsFor(useAppLocale()) };
}

/** The same colors for the native headers and tab bars. */
export function navigationTheme({ scheme, colors, fonts }: Theme): NavigationTheme {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.foreground,
      border: colors.border,
      notification: colors.destructive,
    },
    fonts: {
      regular: { fontFamily: fonts.regular, fontWeight: "normal" },
      medium: { fontFamily: fonts.medium, fontWeight: "normal" },
      bold: { fontFamily: fonts.bold, fontWeight: "normal" },
      heavy: { fontFamily: fonts.bold, fontWeight: "normal" },
    },
  };
}
