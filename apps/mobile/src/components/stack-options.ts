import type { ComponentProps } from "react";
import type { Stack } from "expo-router";
import { useTheme } from "@/theme/theme";

type StackOptions = NonNullable<ComponentProps<typeof Stack>["screenOptions"]>;

/**
 * Native stack headers in the locale's font. No large titles: on iOS in RTL,
 * react-native-screens forces right-to-left on the large-title view that iOS
 * already mirrors, so the title showed on the left with mirrored glyphs.
 */
export function useStackOptions(): StackOptions {
  const { colors, fonts } = useTheme();
  return {
    headerTitleStyle: { fontFamily: fonts.semibold, color: colors.foreground },
    headerTintColor: colors.primary,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  };
}
