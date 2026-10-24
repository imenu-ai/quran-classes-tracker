import type { ComponentProps } from "react";
import type { Stack } from "expo-router";
import { useTheme } from "@/theme/theme";

type StackOptions = NonNullable<ComponentProps<typeof Stack>["screenOptions"]>;

/** Native stack headers in the locale's font; the first screen of a tab gets a large title. */
export function useStackOptions(): StackOptions {
  const { colors, fonts } = useTheme();
  return {
    headerTitleStyle: { fontFamily: fonts.semibold, color: colors.foreground },
    headerLargeTitleStyle: { fontFamily: fonts.bold, color: colors.foreground },
    headerTintColor: colors.primary,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  };
}
