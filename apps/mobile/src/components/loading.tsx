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

/**
 * A figure space (U+2007) at each end. Android can lay a short label out a
 * fraction of a pixel narrower than it measured it, and then breaks the word
 * itself ("اختبار" showed as "اختبا", depending on where the badge sat).
 * The figure space is counted when measuring and can't be broken from the
 * word, so if anything goes it's the invisible trailing space.
 */
const padded = (label: string) => `\u2007${label}\u2007`;

/** A small label, e.g. "مؤرشفة" on an archived class; muted unless given colours. */
export function Badge({
  label,
  background,
  color,
}: Readonly<{ label: string; background?: string; color?: string }>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: background ?? colors.secondary }]}>
      <Text size={13} weight="medium" style={{ color: color ?? colors.secondaryForeground }}>
        {padded(label)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingVertical: 48, alignItems: "center" },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
});
