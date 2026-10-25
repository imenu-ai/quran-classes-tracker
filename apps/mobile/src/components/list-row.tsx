import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { Chevron } from "./icons";
import { Text } from "./text";

/**
 * A card-like row that opens a page: the main text (user text: a class or
 * student name), a muted line under it, and the chevron. At least 64 pt tall.
 */
export function ListRow({
  title,
  subtitle,
  onPress,
  testID,
}: Readonly<{ title: string; subtitle?: ReactNode; onPress: () => void; testID?: string }>) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        { borderColor: colors.border, backgroundColor: pressed ? colors.accent : colors.card },
      ]}
    >
      <View style={styles.texts}>
        <Text weight="semibold" size={17} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text tone="muted" size={14}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Chevron />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  texts: { flex: 1, gap: 2 },
});
