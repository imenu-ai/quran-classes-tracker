import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslations } from "use-intl";
import { getIndicator, type IndicatorTone } from "@qct/core/data/sync/indicator";
import { useApp, useSyncStatus } from "@/data/app-data";
import { useLocalQuery } from "@/data/use-local-query";
import type { ThemeColors } from "@/theme/colors";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

const DOT: Record<IndicatorTone, keyof ThemeColors> = {
  ok: "success",
  busy: "primary",
  muted: "mutedForeground",
  warning: "warning",
  danger: "destructive",
};

/**
 * The always-visible sync state (PLAN.md §2.7), like the web's: connected,
 * offline, syncing, changes waiting, rejected changes. A tap syncs now. When
 * the session is gone it asks to sign in again; local changes stay on the
 * device and go out once the user has.
 */
export function SyncIndicator() {
  const t = useTranslations("sync");
  const { engine } = useApp();
  const { colors } = useTheme();
  const { state } = useSyncStatus();
  const counts = useLocalQuery(
    async (db) => ({ pending: await db.count("outbox"), rejected: await db.count("rejected") }),
    [],
    ["outbox", "rejected"],
  );
  const indicator = getIndicator({
    state,
    pending: counts?.pending ?? 0,
    rejected: counts?.rejected ?? 0,
  });
  const label = indicator.messages
    .map((message) =>
      "count" in message ? t(message.key, { count: message.count }) : t(message.key),
    )
    .join(" · ");
  const needsLogin = state === "needsLogin";

  return (
    <Pressable
      onPress={() => (needsLogin ? router.push("/sign-in-again") : void engine.syncNow())}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={needsLogin ? t("signInAgain") : t("syncNow")}
      testID="sync-indicator"
      style={({ pressed }) => [
        styles.box,
        { borderColor: needsLogin ? colors.destructive : colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: colors[DOT[indicator.tone]] }]} />
        <Text tone="muted" size={14} style={styles.label}>
          {label}
        </Text>
      </View>
      {/* Its own line: beside the message it was squeezed and clipped on a 360 dp phone. */}
      {needsLogin ? (
        <Text tone="primary" weight="semibold" size={14}>
          {t("signInAgain")}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 44,
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1 },
  pressed: { opacity: 0.6 },
});
