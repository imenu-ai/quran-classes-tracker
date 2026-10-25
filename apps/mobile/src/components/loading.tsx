import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

/** While local data loads (usually a few milliseconds, so it stays quiet). */
export function Loading() {
  const t = useTranslations("common");
  const { colors } = useTheme();
  return (
    <View style={styles.box} accessibilityLabel={t("loading")} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

/** A small muted label, e.g. "مؤرشفة" on an archived class. */
export function Badge({ label }: Readonly<{ label: string }>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
      <Text size={13} weight="medium" style={{ color: colors.secondaryForeground }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingVertical: 48, alignItems: "center" },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
});
