import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

/** An error for the whole form (not one field), announced to screen readers. */
export function FormError({ message }: Readonly<{ message: string | null }>) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.box, { borderColor: colors.destructive }]}
    >
      <Text style={{ color: colors.destructive }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
});
