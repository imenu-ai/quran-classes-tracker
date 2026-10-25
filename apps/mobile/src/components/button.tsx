import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

/**
 * A full-width action, at least 48 pt tall. `busy` shows a spinner and blocks
 * taps; `disabled` dims it. "destructive" is for archiving and the like.
 */
export function Button({
  label,
  onPress,
  busy = false,
  disabled = false,
  variant = "primary",
}: Readonly<{
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  variant?: "primary" | "plain" | "destructive";
}>) {
  const { colors } = useTheme();
  const filled = variant !== "plain";
  const background = variant === "destructive" ? colors.destructive : colors.primary;
  const foreground =
    variant === "destructive"
      ? "#ffffff"
      : variant === "primary"
        ? colors.primaryForeground
        : colors.foreground;
  const blocked = busy || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: blocked }}
      style={({ pressed }) => [
        styles.button,
        filled ? { backgroundColor: background } : { borderColor: colors.border, borderWidth: 1 },
        (pressed || busy) && styles.dimmed,
        disabled && styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={filled ? foreground : colors.primary} />
      ) : (
        <Text weight="semibold" style={[styles.label, { color: foreground }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  // The button's full width, not the label's own: Android sometimes draws
  // Arabic a little wider than it measured, and a label sized to its
  // measurement then lost its last word ("تسجيل الخروج" showed as "تسجيل").
  label: { alignSelf: "stretch", textAlign: "center" },
  dimmed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
