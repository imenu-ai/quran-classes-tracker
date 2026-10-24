import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { Button } from "@/components/button";
import { IntlCheck } from "@/components/intl-check";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useSession } from "@/session/session";
import { useTheme } from "@/theme/theme";

/** The signed-in account and sign-out (profile, sync and center settings: 2.11). */
export default function SettingsScreen() {
  const t = useTranslations();
  const { snapshot, signOut } = useSession();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      {snapshot ? (
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text weight="semibold" size={18}>
            {snapshot.name}
          </Text>
          <Text tone="muted" style={styles.ltr}>
            {snapshot.username}
          </Text>
          <Text>{snapshot.tenantName}</Text>
          <Text tone="muted">
            {t("settings.centerCode")}: <Text style={styles.ltr}>{snapshot.centerCode}</Text>
          </Text>
        </View>
      ) : null}
      <Button
        variant="plain"
        label={t("auth.logout")}
        busy={busy}
        onPress={() => {
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        }}
      />
      {__DEV__ ? <IntlCheck /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  // Latin user names and codes keep their own order inside Arabic text.
  ltr: { writingDirection: "ltr" },
});
