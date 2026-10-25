import { Pressable, StyleSheet } from "react-native";
import { Text } from "./text";

/** A link in running text (sign-in, the legal links), with a 44 pt tap target. */
export function TextLink({
  label,
  onPress,
  tone = "primary",
}: Readonly<{ label: string; onPress: () => void; tone?: "primary" | "muted" }>) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8} style={styles.link}>
      <Text tone={tone} weight="medium">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: "center" },
});
