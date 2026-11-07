import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { router } from "expo-router";
import { useTranslations } from "use-intl";
import { localDateToUtcDate, todayInTimeZone } from "@qct/core/domain/dates/local-date";
import { useApp } from "@/data/app-data";
import { useTheme } from "@/theme/theme";
import { Button } from "./button";
import { Text } from "./text";

/** The calendar day the teacher picked, as YYYY-MM-DD (the picker works in local days). */
const pickedDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

/** Today's calendar day as a local Date, for the picker's value and limit. */
const asLocalDay = (day: string) => {
  const utc = localDateToUtcDate(day);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12);
};

/**
 * "إضافة جلسة" (the web's AddSession): the system date picker, no later
 * than today, then the student's session for the picked day. Today stays on
 * the student page, where today's card already is.
 */
export function AddSession({ studentId }: Readonly<{ studentId: string }>) {
  const t = useTranslations("day");
  const { session } = useApp();
  const { colors } = useTheme();
  const today = todayInTimeZone(session.timezone);
  const [picking, setPicking] = useState(false);

  const open = (date: Date) => {
    setPicking(false);
    const day = pickedDay(date);
    if (day >= today) return;
    router.push({ pathname: "/student-day", params: { studentId, date: day } });
  };

  const picker = (
    <DateTimePicker
      testID="session.date"
      value={asLocalDay(today)}
      maximumDate={asLocalDay(today)}
      mode="date"
      display={Platform.OS === "ios" ? "compact" : "default"}
      accentColor={colors.primary}
      onValueChange={(_event, date) => open(date)}
      onDismiss={() => setPicking(false)}
    />
  );

  // iOS: the compact date button opens the calendar itself.
  if (Platform.OS === "ios") {
    return (
      <View style={styles.row}>
        <Text weight="medium" style={styles.label}>
          {t("add")}
        </Text>
        {picker}
      </View>
    );
  }
  // Android: the button opens the system date dialog.
  return (
    <View>
      <Button variant="plain" label={t("add")} onPress={() => setPicking(true)} />
      {picking ? picker : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  label: { flex: 1 },
});
