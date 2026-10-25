import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";
import { retryRejected } from "@qct/core/data/outbox";
import { discardRejected } from "@qct/core/data/sync/rejected";
import type { ErrorCode } from "@qct/core/shared/schemas/errors";
import { SYNC_REJECTION_CODES } from "@qct/core/shared/sync/protocol";
import { useApp, useSyncStatus } from "@/data/app-data";
import { useLocalQuery } from "@/data/use-local-query";
import { useErrorMessage } from "@/i18n/use-error-message";
import { useTheme } from "@/theme/theme";
import { Button } from "./button";
import { Section } from "./section";
import { SyncIndicator } from "./sync-indicator";
import { Text } from "./text";

/**
 * Sync details (the web's SyncSection): the state, what's waiting, when it
 * last synced, a manual sync, and the changes the server refused, each to
 * retry or discard.
 */
export function SyncSection() {
  const t = useTranslations();
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const { db, engine } = useApp();
  const { colors } = useTheme();
  const status = useSyncStatus();
  const now = useNow();
  const pending = useLocalQuery((d) => d.count("outbox"), [], ["outbox"]) ?? 0;
  const rejected = useLocalQuery((d) => d.all("rejected"), [], ["rejected"]) ?? [];

  const reason = (code: string, params: Record<string, string | number>) =>
    (SYNC_REJECTION_CODES as readonly string[]).includes(code)
      ? t(`syncErrors.${code as (typeof SYNC_REJECTION_CODES)[number]}`)
      : errorMessage({ code: code as ErrorCode, params });

  const confirmDiscard = (recordId: string) =>
    Alert.alert(t("settings.discardConfirmTitle"), t("settings.discardConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.discard"),
        style: "destructive",
        onPress: () => void discardRejected(db, recordId).then(() => engine.syncNow()),
      },
    ]);

  return (
    <Section title={t("settings.syncTitle")}>
      <SyncIndicator />
      <Detail label={t("settings.pending")} value={String(pending)} />
      <Detail
        label={t("settings.lastSynced")}
        value={
          status.lastSyncedAt ? format.relativeTime(status.lastSyncedAt, now) : t("settings.never")
        }
      />
      <Button
        variant="plain"
        label={t("settings.syncNow")}
        disabled={status.state === "syncing"}
        onPress={() => void engine.syncNow()}
      />
      {rejected.length > 0 ? (
        <View style={[styles.rejected, { borderColor: colors.warning }]}>
          <Text weight="medium">{t("settings.rejectedTitle")}</Text>
          <Text tone="muted" size={14}>
            {t("settings.rejectedHint")}
          </Text>
          {rejected.map((entry) => (
            <View key={entry.recordId} style={[styles.entry, { borderColor: colors.border }]}>
              <Text size={14}>
                {t(`tables.${entry.table}`)}: {reason(entry.code, entry.params)}
              </Text>
              <View style={styles.actions}>
                <View style={styles.action}>
                  <Button
                    variant="plain"
                    label={t("settings.retry")}
                    onPress={() =>
                      void retryRejected(db, entry.recordId, Date.now()).then(() =>
                        engine.syncNow(),
                      )
                    }
                  />
                </View>
                <View style={styles.action}>
                  <Button
                    variant="plain"
                    color={colors.destructive}
                    label={t("settings.discard")}
                    onPress={() => confirmDiscard(entry.recordId)}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Section>
  );
}

/** The time, every 30 s: "last synced a minute ago" stays true while the screen is open. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Detail({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View style={styles.detail}>
      <Text tone="muted" style={styles.detailLabel}>
        {label}
      </Text>
      {/* Regular weight: sized to its text (see Text on Android's clipping). */}
      <Text>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { flexDirection: "row", gap: 12, alignItems: "center" },
  detailLabel: { flex: 1 },
  rejected: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  entry: { borderTopWidth: 1, paddingTop: 8, gap: 8 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
});
