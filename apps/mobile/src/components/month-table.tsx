import { useMemo, useState } from "react";
import { I18nManager, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useFormatter, useTranslations } from "use-intl";
import { localDateToUtcDate, monthKey, todayInTimeZone } from "@qct/core/domain/dates/local-date";
import {
  buildMonthHistory,
  type HistoryRow,
  type StudentProfile,
} from "@qct/core/domain/stats/month-sheet";
import { isExam } from "@qct/core/shared/schemas/homework";
import type { StudentRecord } from "@qct/core/shared/schemas/student";
import { useApp } from "@/data/app-data";
import { usePortionLabel } from "@/i18n/portion";
import { usePrintSheets, type PrintMode } from "@/print/use-print";
import { useTheme } from "@/theme/theme";
import { Button } from "./button";
import { Badge } from "./loading";
import { Text } from "./text";

const rowKey = (row: HistoryRow) =>
  row.kind === "absence" ? `a:${row.record.id}` : `${row.kind}:${row.item.id}:${row.lesson.id}`;

/**
 * The student's month as a simple table (the web's MonthTable): one row per
 * recorded day (a mark, a postponement or an absence), the month's averages
 * at the bottom, and arrows for other months. It starts closed, showing the
 * month and its averages; tapping that opens the table. When `editable`,
 * tapping a row opens the edit sheet for that day.
 */
export function MonthTable({
  profile,
  student,
  editable,
}: Readonly<{ profile: StudentProfile; student: StudentRecord; editable: boolean }>) {
  const t = useTranslations();
  const format = useFormatter();
  const { session } = useApp();
  const { colors } = useTheme();
  const label = usePortionLabel();
  const currentMonth = monthKey(todayInTimeZone(session.timezone));
  // Months with data, plus this month even before anything is recorded; newest first.
  const months = useMemo(
    () =>
      [...new Set([currentMonth, ...profile.months.map((m) => m.month)])].sort((a, b) =>
        b.localeCompare(a),
      ),
    [currentMonth, profile.months],
  );
  const [month, setMonth] = useState(currentMonth);
  const [open, setOpen] = useState(false);

  const rows = useMemo(
    () => buildMonthHistory(profile.homework, profile.attendance, profile.lessonsById, month),
    [profile, month],
  );
  const stats = profile.months.find((m) => m.month === month);
  const index = months.indexOf(month);
  const older = months[index + 1];
  const newer = index > 0 ? months[index - 1] : undefined;

  const monthLabel = (key: string) => format.dateTime(new Date(`${key}-01T00:00:00Z`), "month");
  const day = (date: string) => format.dateTime(localDateToUtcDate(date), "dayShort");
  const average = (value: number | null | undefined) =>
    value === null || value === undefined ? t("common.noValue") : format.number(value, "average");
  const score = (value: number | null) => (value === null ? t("common.noValue") : String(value));
  const edit = (row: HistoryRow) =>
    router.push({
      pathname: "/edit-day",
      params: {
        studentId: student.id,
        kind: row.kind,
        id: row.kind === "absence" ? row.record.id : row.item.id,
        lessonId: row.lesson.id,
      },
    });

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.header}>
        {open ? (
          <MonthArrow
            direction="back"
            label={t("profile.olderMonth")}
            disabled={!older}
            onPress={() => older && setMonth(older)}
          />
        ) : null}
        <Pressable
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={styles.toggle}
        >
          <View style={styles.titles}>
            <Text weight="semibold" size={18}>
              {monthLabel(month)}
            </Text>
            {/* Closed, the month at a glance; open, the table's footer has it. */}
            {!open ? (
              <Text tone="muted" size={14}>
                {t("profile.monthSummary", {
                  memorization: average(stats?.memorizationAverage),
                  behavior: average(stats?.behaviorAverage),
                  present: stats?.present ?? 0,
                })}
              </Text>
            ) : null}
          </View>
          <SymbolView
            name={{
              ios: open ? "chevron.up" : "chevron.down",
              android: open ? "expand_less" : "expand_more",
            }}
            size={20}
            tintColor={colors.mutedForeground}
          />
        </Pressable>
        {open ? (
          <MonthArrow
            direction="forward"
            label={t("profile.newerMonth")}
            disabled={!newer}
            onPress={() => newer && setMonth(newer)}
          />
        ) : null}
      </View>

      {open ? (
        <View style={[styles.body, { borderColor: colors.border }]}>
          <View style={[styles.row, { backgroundColor: colors.muted }]}>
            <Cell width={DATE_WIDTH}>
              <Text tone="muted" size={13} weight="medium">
                {t("profile.dateHeader")}
              </Text>
            </Cell>
            <Cell flex>
              <Text tone="muted" size={13} weight="medium">
                {t("glossary.homework")}
              </Text>
            </Cell>
            <Cell width={MARK_WIDTH} center>
              <Text tone="muted" size={13} weight="medium">
                {t("profile.memorizationShort")}
              </Text>
            </Cell>
            <Cell width={MARK_WIDTH} center>
              <Text tone="muted" size={13} weight="medium">
                {t("profile.behaviorShort")}
              </Text>
            </Cell>
          </View>

          {rows.length === 0 ? (
            <Text tone="muted" style={styles.empty}>
              {t("profile.noHistory")}
            </Text>
          ) : null}

          {rows.map((row) => {
            const exam = row.kind !== "absence" && isExam(row.item);
            return (
              <Pressable
                key={rowKey(row)}
                disabled={!editable}
                onPress={() => edit(row)}
                accessibilityRole={editable ? "button" : undefined}
                accessibilityLabel={
                  editable ? t("profile.editRow", { date: day(row.lesson.date) }) : undefined
                }
                style={({ pressed }) => [
                  styles.row,
                  { borderTopWidth: 1, borderColor: colors.border },
                  exam && { backgroundColor: `${colors.exam}1a` },
                  pressed && { backgroundColor: colors.accent },
                ]}
              >
                <Cell width={DATE_WIDTH}>
                  <Text weight="medium" size={14}>
                    {day(row.lesson.date)}
                  </Text>
                </Cell>
                {row.kind === "absence" ? (
                  <Cell flex>
                    <View style={styles.inline}>
                      <Badge
                        label={t(`glossary.${row.record.status}`)}
                        background={
                          row.record.status === "absent" ? colors.destructive : colors.warning
                        }
                        color={
                          row.record.status === "absent" ? "#ffffff" : colors.warningForeground
                        }
                      />
                      {row.record.excuseNote ? (
                        <Text tone="muted" size={14}>
                          {row.record.excuseNote}
                        </Text>
                      ) : null}
                    </View>
                  </Cell>
                ) : (
                  <>
                    <Cell flex>
                      <View style={styles.inline}>
                        <Text size={14}>{label(row.item)}</Text>
                        {exam ? (
                          <Badge
                            label={t("exam.badge")}
                            background={colors.exam}
                            color={colors.examForeground}
                          />
                        ) : null}
                      </View>
                    </Cell>
                    {exam ? (
                      // One exam mark, across both mark columns.
                      <Cell width={MARK_WIDTH * 2} center>
                        <Text weight="semibold" style={{ color: colors.exam }}>
                          {score(row.item.memorizationRate)}
                        </Text>
                      </Cell>
                    ) : row.kind === "postponed" ? (
                      <Cell width={MARK_WIDTH * 2} center>
                        <Badge
                          label={t("today.postponed")}
                          background={colors.warning}
                          color={colors.warningForeground}
                        />
                      </Cell>
                    ) : (
                      <>
                        <Cell width={MARK_WIDTH} center>
                          <Text weight="semibold">{score(row.item.memorizationRate)}</Text>
                        </Cell>
                        <Cell width={MARK_WIDTH} center>
                          <Text weight="semibold">{score(row.item.behaviorRate)}</Text>
                        </Cell>
                      </>
                    )}
                  </>
                )}
              </Pressable>
            );
          })}

          <View style={[styles.row, styles.footer, { borderColor: colors.border }]}>
            <Cell flex>
              <Text weight="semibold">{t("profile.average")}</Text>
            </Cell>
            <Cell width={MARK_WIDTH} center>
              <Text weight="semibold">{average(stats?.memorizationAverage)}</Text>
            </Cell>
            <Cell width={MARK_WIDTH} center>
              <Text weight="semibold">{average(stats?.behaviorAverage)}</Text>
            </Cell>
          </View>
          <Text tone="muted" size={14} style={styles.summary}>
            {t("profile.attendanceSummary", {
              present: stats?.present ?? 0,
              absent: stats?.absent ?? 0,
              excused: stats?.excused ?? 0,
            })}
          </Text>
          <PrintButtons classId={student.classId} studentIds={[student.id]} month={month} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Print the month's sheet (the system dialog), or share it as a PDF. Shared
 * with the class's student sheets.
 */
export function PrintButtons({
  classId,
  studentIds,
  month,
  printLabel,
}: Readonly<{
  classId: string;
  studentIds: readonly string[];
  month: string;
  printLabel?: string;
}>) {
  const t = useTranslations("print");
  const print = usePrintSheets();
  const [busy, setBusy] = useState<PrintMode | null>(null);
  const run = (mode: PrintMode) => {
    setBusy(mode);
    print(classId, studentIds, month, mode)
      .catch((error: unknown) => console.error("Printing failed", error))
      .finally(() => setBusy(null));
  };
  return (
    <View style={styles.print}>
      <View style={styles.printButton}>
        <Button
          variant="plain"
          label={printLabel ?? t("printMonth")}
          busy={busy === "print"}
          disabled={busy !== null || studentIds.length === 0}
          onPress={() => run("print")}
        />
      </View>
      <View style={styles.printButton}>
        <Button
          variant="plain"
          label={t("sharePdf")}
          busy={busy === "share"}
          disabled={busy !== null || studentIds.length === 0}
          onPress={() => run("share")}
        />
      </View>
    </View>
  );
}

const DATE_WIDTH = 76;
const MARK_WIDTH = 56;

/** A table cell: a fixed width (date, marks) or the rest of the row (the portion). */
function Cell({
  children,
  width,
  flex = false,
  center = false,
}: Readonly<{ children: React.ReactNode; width?: number; flex?: boolean; center?: boolean }>) {
  return (
    <View style={[styles.cell, flex ? styles.flex : { width }, center && styles.center]}>
      {children}
    </View>
  );
}

/** Previous or next month; the arrow points by direction (back is right in RTL). */
function MonthArrow({
  direction,
  label,
  disabled,
  onPress,
}: Readonly<{
  direction: "back" | "forward";
  label: string;
  disabled: boolean;
  onPress: () => void;
}>) {
  const { colors } = useTheme();
  const pointsLeft = (direction === "back") !== I18nManager.isRTL;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.arrow, (pressed || disabled) && styles.dimmed]}
    >
      <SymbolView
        name={{
          ios: pointsLeft ? "chevron.left" : "chevron.right",
          android: pointsLeft ? "chevron_left" : "chevron_right",
        }}
        size={20}
        tintColor={colors.foreground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  toggle: {
    flex: 1,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  titles: { flex: 1, gap: 2 },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dimmed: { opacity: 0.35 },
  body: { borderTopWidth: 1, paddingBottom: 12 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  cell: { paddingHorizontal: 6, paddingVertical: 10 },
  flex: { flex: 1 },
  center: { alignItems: "center" },
  inline: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  empty: { paddingVertical: 24, alignSelf: "stretch", textAlign: "center" },
  footer: { borderTopWidth: 2 },
  summary: { paddingHorizontal: 12, paddingTop: 10 },
  print: { flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingTop: 12 },
  printButton: { flex: 1 },
});
