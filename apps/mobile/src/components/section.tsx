import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

/** A titled card grouping one part of a screen (a settings section, a form part). */
export function Section({ title, children }: Readonly<{ title?: string; children: ReactNode }>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      {title ? (
        <Text weight="semibold" size={17} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
});
