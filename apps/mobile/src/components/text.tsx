import { Text as NativeText, type TextProps } from "react-native";
import { useTheme } from "@/theme/theme";
import type { FontWeightName } from "@/theme/fonts";

type Tone = "default" | "muted" | "primary";

/**
 * Text in the locale's font and the theme's colors. It aligns with the
 * writing direction by itself; never set textAlign left/right.
 */
export function Text({
  weight = "regular",
  tone = "default",
  size = 16,
  style,
  ...props
}: TextProps & { weight?: FontWeightName; tone?: Tone; size?: number }) {
  const { colors, fonts } = useTheme();
  const color =
    tone === "muted"
      ? colors.mutedForeground
      : tone === "primary"
        ? colors.primary
        : colors.foreground;
  return (
    <NativeText
      {...props}
      style={[{ fontFamily: fonts[weight], color, fontSize: size, lineHeight: size * 1.5 }, style]}
    />
  );
}
