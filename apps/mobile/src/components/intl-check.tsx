import { I18nManager, StyleSheet, View } from "react-native";
import { useFormatter, useTranslations } from "use-intl";
import { v7 as uuidv7 } from "uuid";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

const COUNTS = [0, 1, 2, 3, 11, 100];

/**
 * Development builds only: the formats Hermes needed polyfills for (Arabic
 * plurals, dates, percentages, ids, the direction), to check them on a device.
 */
export function IntlCheck() {
  const t = useTranslations();
  const format = useFormatter();
  const { colors } = useTheme();
  const now = new Date();
  const lines = [
    ...COUNTS.map((count) => t("classes.studentCount", { count })),
    t("sync.pending", { count: 3 }),
    format.dateTime(now, "lessonDate"),
    format.dateTime(now, "weekday"),
    format.number(0.9, "percent"),
    format.number(7.25, "average"),
    `${I18nManager.isRTL ? "rtl" : "ltr"} · ${uuidv7().slice(0, 13)}`,
  ];
  return (
    <View style={[styles.box, { borderColor: colors.border }]} testID="intl-check">
      {lines.map((line, i) => (
        <Text key={i} tone={i < COUNTS.length ? "default" : "muted"}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
});
