import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { parentLink } from "@qct/core/shared/parent";
import { Button } from "@/components/button";
import { Loading } from "@/components/loading";
import { QrCode } from "@/components/qr-code";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { API_URL } from "@/config";
import { useStudent } from "@/data/queries";
import { useTheme } from "@/theme/theme";

/**
 * The student's parent link to hand out (the web's drawer): its QR code, the
 * link to copy or share through the share sheet. Without a parent ID the
 * link won't open the student, so that's said first.
 */
export default function ParentLinkScreen() {
  const t = useTranslations("parentLink");
  const { colors } = useTheme();
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const student = useStudent(studentId);
  const [copied, setCopied] = useState(false);

  if (!student) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  // The parent page is on the web, where the app's server is.
  const url = parentLink(API_URL, student.id);

  return (
    <Screen>
      <Text weight="semibold" size={18}>
        {student.fullName}
      </Text>
      {student.parentId === "" ? (
        <View style={[styles.note, { backgroundColor: `${colors.warning}26` }]}>
          <Text size={14}>{t("notSet")}</Text>
        </View>
      ) : (
        <Text tone="muted" size={14}>
          {t("hint")}
        </Text>
      )}
      <View style={[styles.qr, { borderColor: colors.border }]}>
        <QrCode value={url} label={t("qr")} size={208} />
      </View>
      <View style={[styles.link, { backgroundColor: colors.muted }]}>
        <Text size={14} selectable style={styles.ltr}>
          {url}
        </Text>
      </View>
      <Button
        label={copied ? t("copied") : t("copy")}
        onPress={() => {
          void Clipboard.setStringAsync(url).then(() => setCopied(true));
        }}
      />
      <Button
        variant="plain"
        label={t("share")}
        onPress={() => {
          // Cancelling the share sheet isn't an error worth reporting.
          void Share.share({
            title: t("shareTitle", { name: student.fullName }),
            message: url,
            url,
          }).catch(() => {});
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: 10, padding: 12 },
  // White behind the code in dark mode too: readers need the contrast.
  qr: {
    alignSelf: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    backgroundColor: "#ffffff",
  },
  link: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  // A URL reads left to right inside the Arabic screen.
  ltr: { writingDirection: "ltr" },
});
