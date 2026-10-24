import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useTheme } from "@/theme/theme";

/**
 * A scrolling screen body under the native header. Insets (notch, home
 * indicator, large titles, the tab bar) are left to the system.
 */
export function Screen({ children }: Readonly<{ children: ReactNode }>) {
  const { colors } = useTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
});
