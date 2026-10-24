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
      // Android's default ("highQuality") line breaking measured Arabic in the
      // custom font narrower than it then laid it out, so the last word wrapped
      // onto a clipped second line ("تسجيل الخروج" showed as "تسجيل").
      textBreakStrategy="simple"
      {...props}
      style={[{ fontFamily: fonts[weight], color, fontSize: size, lineHeight: size * 1.5 }, style]}
    />
  );
}
