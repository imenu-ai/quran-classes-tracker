import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useFormatter, useTranslations } from "use-intl";
import { ALL_TIME, type StatsPeriod, type StudentStanding } from "@qct/core/domain/stats/class";
import { EmptyState } from "@/components/empty-state";
import { Chevron, useToolbarIcon } from "@/components/icons";
import { Loading } from "@/components/loading";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useAccess } from "@/data/access";
import { useClass, useClassStatistics } from "@/data/queries";
import { useTheme } from "@/theme/theme";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * A class's statistics (§0 #34–36), like the web's: its attendance rate and
 * average marks, then its students ranked best first. All time by default,
 * or one year or month, chosen from the native header menu.
 */
export default function ClassStatsScreen() {
  const t = useTranslations("classStats");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const canView = useAccess().can("reports.view");
  const cls = useClass(id);
  const [period, setPeriod] = useState<StatsPeriod>(ALL_TIME);
  const view = useClassStatistics(id, period);
  const periodIcon = useToolbarIcon("calendar", "calendar_month");

  if (!canView) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("title") }} />
        <EmptyState title={t("notAllowed")} />
      </Screen>
    );
  }
  if (cls === undefined || view === undefined) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("title") }} />
        <Loading />
      </Screen>
    );
  }
  if (!cls || cls.deletedAt !== null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("title") }} />
        <EmptyState title={tCommon("noValue")} />
      </Screen>
    );
  }

  const { statistics, students, years } = view;
  // The chosen year stays offered even when it has no lessons.
  const yearOptions =
    period.year !== null && !years.includes(period.year) ? [period.year, ...years] : years;
  const percent = (rate: number | null) =>
    rate === null ? tCommon("noValue") : format.number(rate, "percent");
  const average = (value: number | null) =>
    value === null ? tCommon("noValue") : format.number(value, "average");
  const monthName = (month: number) =>
    format.dateTime(new Date(Date.UTC(2026, month - 1, 1)), "monthName");
  const periodLabel =
    period.year === null
      ? t("allTime")
      : period.month === null
        ? `${period.year} · ${t("allMonths")}`
        : `${monthName(period.month)} ${period.year}`;

  return (
    <>
      <Stack.Screen options={{ title: t("title") }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon={periodIcon} accessibilityLabel={t("period")}>
          <Stack.Toolbar.Label>{t("period")}</Stack.Toolbar.Label>
          <Stack.Toolbar.MenuAction isOn={period.year === null} onPress={() => setPeriod(ALL_TIME)}>
            {t("allTime")}
          </Stack.Toolbar.MenuAction>
          {yearOptions.map((year) => (
            <Stack.Toolbar.Menu key={year} title={String(year)}>
              <Stack.Toolbar.Label>{String(year)}</Stack.Toolbar.Label>
              <Stack.Toolbar.MenuAction
                isOn={period.year === year && period.month === null}
                onPress={() => setPeriod({ year, month: null })}
              >
                {`${year} · ${t("allMonths")}`}
              </Stack.Toolbar.MenuAction>
              {MONTHS.map((month) => (
                <Stack.Toolbar.MenuAction
                  key={month}
                  isOn={period.year === year && period.month === month}
                  onPress={() => setPeriod({ year, month })}
                >
                  {`${monthName(month)} ${year}`}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <Screen>
        <Text tone="muted">{cls.name}</Text>
        <Text weight="semibold" accessibilityLabel={`${t("period")}: ${periodLabel}`}>
          {t("period")}: {periodLabel}
        </Text>

        {statistics.lessonDays === 0 ? (
          <EmptyState title={t("noLessons")} />
        ) : (
          <>
            <Summary
              rate={percent(statistics.rate)}
              counts={t("attendanceCounts", {
                present: statistics.present,
                absent: statistics.absent,
                excused: statistics.excused,
              })}
              memorization={average(statistics.memorizationAverage)}
              behavior={average(statistics.behaviorAverage)}
            />
            <View style={styles.ranking}>
              <Text weight="semibold" size={18} accessibilityRole="header">
                {t("ranking")}
              </Text>
              <Text tone="muted" size={14}>
                {t("rankingHint")}
              </Text>
              {statistics.students.map((standing, index) => (
                <RankedStudent
                  key={standing.studentId}
                  rank={index + 1}
                  name={students.get(standing.studentId)?.fullName ?? ""}
                  standing={standing}
                  percent={percent}
                  average={average}
                />
              ))}
            </View>
          </>
        )}
      </Screen>
    </>
  );
}

function Summary({
  rate,
  counts,
  memorization,
  behavior,
}: Readonly<{ rate: string; counts: string; memorization: string; behavior: string }>) {
  const t = useTranslations("classStats");
  const { colors } = useTheme();
  return (
    <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.block}>
        <Text tone="muted" size={14}>
          {t("attendanceRate")}
        </Text>
        <Text weight="bold" size={36} tone="primary">
          {rate}
        </Text>
        <Text tone="muted" size={14}>
          {counts}
        </Text>
      </View>
      <View style={[styles.averages, { borderColor: colors.border }]}>
        <View style={styles.half}>
          <Text tone="muted" size={14}>
            {t("memorizationAverage")}
          </Text>
          <Text weight="semibold" size={24}>
            {memorization}
          </Text>
        </View>
        <View style={styles.half}>
          <Text tone="muted" size={14}>
            {t("behaviorAverage")}
          </Text>
          <Text weight="semibold" size={24}>
            {behavior}
          </Text>
        </View>
      </View>
    </View>
  );
}

function RankedStudent({
  rank,
  name,
  standing,
  percent,
  average,
}: Readonly<{
  rank: number;
  name: string;
  standing: StudentStanding;
  percent: (rate: number | null) => string;
  average: (value: number | null) => string;
}>) {
  const t = useTranslations("classStats");
  const { colors } = useTheme();
  const top = rank <= 3;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/student/[id]", params: { id: standing.studentId } })}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { borderColor: colors.border, backgroundColor: pressed ? colors.accent : colors.card },
      ]}
    >
      <View
        accessibilityLabel={t("rank", { rank })}
        style={[styles.rank, { backgroundColor: top ? colors.primary : colors.muted }]}
      >
        <Text
          weight="bold"
          style={[styles.centered, { color: top ? colors.primaryForeground : colors.foreground }]}
        >
          {rank}
        </Text>
      </View>
      <View style={styles.texts}>
        <Text weight="semibold" numberOfLines={2}>
          {name}
        </Text>
        <Text tone="muted" size={14}>
          {t("studentAttendance", { attended: standing.attended, possible: standing.possible })}
        </Text>
        <Text tone="muted" size={14}>
          {percent(standing.rate)}
        </Text>
      </View>
      <View style={styles.mark}>
        <Text tone="muted" size={12} style={styles.centered}>
          {t("memorizationShort")}
        </Text>
        <Text weight="semibold" style={styles.centered}>
          {average(standing.memorizationAverage)}
        </Text>
      </View>
      <View style={styles.mark}>
        <Text tone="muted" size={12} style={styles.centered}>
          {t("behaviorShort")}
        </Text>
        <Text weight="semibold" style={styles.centered}>
          {average(standing.behaviorAverage)}
        </Text>
      </View>
      <Chevron />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  block: { gap: 2 },
  averages: { flexDirection: "row", gap: 12, borderTopWidth: 1, paddingTop: 12 },
  half: { flex: 1, gap: 2 },
  ranking: { gap: 8 },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  rank: { width: 36, height: 36, borderRadius: 18, justifyContent: "center" },
  texts: { flex: 1, gap: 2 },
  // Fixed widths: the marks line up from row to row.
  mark: { width: 48, gap: 2 },
  // Full width of their fixed box, so the text is never sized to itself.
  centered: { alignSelf: "stretch", textAlign: "center" },
});
