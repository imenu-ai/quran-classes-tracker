import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

/** A full-width action, at least 48 pt tall. `busy` shows a spinner and blocks taps. */
export function Button({
  label,
  onPress,
  busy = false,
  variant = "primary",
}: Readonly<{
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: "primary" | "plain";
}>) {
  const { colors } = useTheme();
  const primary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: colors.primary }
          : { borderColor: colors.border, borderWidth: 1 },
        (pressed || busy) && styles.dimmed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.primaryForeground : colors.primary} />
      ) : (
        <Text
          weight="semibold"
          style={{ color: primary ? colors.primaryForeground : colors.foreground }}
        >
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
  dimmed: { opacity: 0.7 },
});
