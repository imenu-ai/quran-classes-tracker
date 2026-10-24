import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button } from "@/components/button";
import { DevSyncCheck } from "@/components/dev-sync-check";
import { IntlCheck } from "@/components/intl-check";
import { Screen } from "@/components/screen";
import { SyncIndicator } from "@/components/sync-indicator";
import { Text } from "@/components/text";
import { useApp } from "@/data/app-data";
import { useTheme } from "@/theme/theme";

/** The signed-in account, sync and sign-out (profile and center settings: 2.11). */
export default function SettingsScreen() {
  const t = useTranslations();
  const { session, db, engine, signOut } = useApp();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const leave = () => {
    setBusy(true);
    void signOut().finally(() => setBusy(false));
  };

  // Signing out deletes this device's copy, so unsynced changes would be
  // lost: say so, and offer to sync them first.
  async function confirmSignOut() {
    const pending = await db.count("outbox");
    if (pending === 0) return leave();
    Alert.alert(t("auth.logout"), t("auth.logoutPending", { count: pending }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("sync.syncNow"), onPress: () => void engine.syncNow() },
      { text: t("auth.logoutAnyway"), style: "destructive", onPress: leave },
    ]);
  }

  return (
    <Screen>
      <SyncIndicator />
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text weight="semibold" size={18}>
          {session.name}
        </Text>
        <Text tone="muted" style={styles.ltr}>
          {session.username}
        </Text>
        <Text>{session.tenantName}</Text>
        <Text tone="muted">
          {t("settings.centerCode")}: <Text style={styles.ltr}>{session.centerCode}</Text>
        </Text>
      </View>
      <Button
        variant="plain"
        label={t("auth.logout")}
        busy={busy}
        onPress={() => void confirmSignOut()}
      />
      {__DEV__ ? <DevSyncCheck /> : null}
      {__DEV__ ? <IntlCheck /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  // Latin user names and codes keep their own order inside Arabic text.
  ltr: { writingDirection: "ltr" },
});
