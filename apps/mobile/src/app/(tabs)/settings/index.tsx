import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslations } from "use-intl";
import { Button } from "@/components/button";
import { ChoiceList } from "@/components/choice-list";
import { DevSyncCheck } from "@/components/dev-sync-check";
import { IntlCheck } from "@/components/intl-check";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { Section } from "@/components/section";
import { SyncSection } from "@/components/sync-section";
import { Text } from "@/components/text";
import { useApp } from "@/data/app-data";
import type { ThemePreference } from "@/device/device-store";
import { useThemePreference } from "@/theme/preference";

const THEMES: { value: ThemePreference; label: "themeSystem" | "themeLight" | "themeDark" }[] = [
  { value: "system", label: "themeSystem" },
  { value: "light", label: "themeLight" },
  { value: "dark", label: "themeDark" },
];

/**
 * Settings, like the web's: sync details, then the profile, password and
 * center (each its own screen), the theme, the account and sign-out.
 */
export default function SettingsScreen() {
  const t = useTranslations();
  const { session, db, engine, signOut } = useApp();
  const [theme, setTheme] = useThemePreference();
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
    <Screen width="narrow">
      <SyncSection />
      <ListRow
        title={t("settings.profileTitle")}
        subtitle={session.name}
        onPress={() => router.push("/settings/profile")}
      />
      <ListRow
        title={t("settings.passwordTitle")}
        onPress={() => router.push("/settings/password")}
      />
      <ListRow
        title={t("settings.centerTitle")}
        subtitle={session.tenantName}
        onPress={() => router.push("/settings/center")}
      />
      <Section title={t("settings.themeTitle")}>
        <ChoiceList
          label={t("settings.themeTitle")}
          hideLabel
          value={theme}
          onChange={setTheme}
          options={THEMES.map(({ value, label }) => ({ value, label: t(`settings.${label}`) }))}
        />
      </Section>
      <Section title={t("settings.account")}>
        <View style={styles.account}>
          <Text weight="semibold">{session.name}</Text>
          <Text tone="muted" style={styles.ltr}>
            {session.username}
          </Text>
        </View>
        <Button
          variant="plain"
          label={t("auth.logout")}
          busy={busy}
          onPress={() => void confirmSignOut()}
        />
      </Section>
      {__DEV__ ? <DevSyncCheck /> : null}
      {__DEV__ ? <IntlCheck /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: { gap: 2 },
  // Latin user names keep their own order inside Arabic text.
  ltr: { writingDirection: "ltr" },
});
