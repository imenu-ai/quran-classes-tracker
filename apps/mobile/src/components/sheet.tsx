import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { CONTENT_WIDTH } from "./screen";
import { Text } from "./text";

/**
 * The body of a short form sheet (presentation "formSheet", sized to its
 * content): a title, an optional line under it, then the content. A sheet
 * has no native header, so the title is drawn here.
 */
export function Sheet({
  title,
  description,
  children,
}: Readonly<{ title: string; description?: ReactNode; children: ReactNode }>) {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: bottom + 16 }]}
    >
      <Text weight="bold" size={20} accessibilityRole="header">
        {title}
      </Text>
      {description ? <Text tone="muted">{description}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // A form's width on a tablet (Android shows sheets edge to edge there).
  sheet: { width: "100%", maxWidth: CONTENT_WIDTH.form, alignSelf: "center", padding: 20, gap: 12 },
});
