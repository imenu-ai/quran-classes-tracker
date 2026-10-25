import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFormatter, useTranslations } from "use-intl";
import { monthKey, todayInTimeZone } from "@qct/core/domain/dates/local-date";
import type { StudentRecord } from "@qct/core/shared/schemas/student";
import { CheckboxList } from "@/components/checkbox-list";
import { Loading } from "@/components/loading";
import { PrintButtons } from "@/components/month-table";
import { PickerField } from "@/components/picker-field";
import { Screen } from "@/components/screen";
import { Section } from "@/components/section";
import { Text } from "@/components/text";
import { useApp } from "@/data/app-data";
import { useClassStudents } from "@/data/queries";
import { useLocalQuery } from "@/data/use-local-query";

const ALL = "all";

/**
 * Prints several students' month sheets, like the web's drawer: pick the
 * month and the students ("تحديد الكل" in one tap; everyone is selected at
 * first), then print, one A4 page each, or share them as one PDF.
 */
export default function PrintStudentsScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { session } = useApp();
  const students = useClassStudents(classId);
  const lessonMonths = useLocalQuery(
    async (db) =>
      (await db.query("lessons", "classId", { equals: classId }))
        .filter((lesson) => lesson.deletedAt === null)
        .map((lesson) => monthKey(lesson.date)),
    [classId],
    ["lessons"],
  );
  if (!students || !lessonMonths) {
    return (
      <Screen width="form">
        <Loading />
      </Screen>
    );
  }
  const currentMonth = monthKey(todayInTimeZone(session.timezone));
  // This month first, then every month with lessons, newest first.
  const months = [...new Set([currentMonth, ...lessonMonths])].sort((a, b) => b.localeCompare(a));
  return (
    <PrintForm
      classId={classId}
      students={students.active}
      months={months}
      defaultMonth={currentMonth}
    />
  );
}

function PrintForm({
  classId,
  students,
  months,
  defaultMonth,
}: Readonly<{
  classId: string;
  students: readonly StudentRecord[];
  months: readonly string[];
  defaultMonth: string;
}>) {
  const t = useTranslations("print");
  const format = useFormatter();
  const [month, setMonth] = useState(defaultMonth);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(students.map((student) => student.id)),
  );
  const all = students.length > 0 && students.every((student) => selected.has(student.id));
  const chosen = students.filter((student) => selected.has(student.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (students.length === 0) {
    return (
      <Screen width="form">
        <Text tone="muted">{t("noStudents")}</Text>
      </Screen>
    );
  }

  return (
    <Screen width="form">
      <PickerField
        label={t("month")}
        value={month}
        onChange={setMonth}
        options={months.map((key) => ({
          value: key,
          label: format.dateTime(new Date(`${key}-01T00:00:00Z`), "month"),
        }))}
      />
      <Section title={t("students")}>
        <View style={styles.all}>
          <View style={styles.allBox}>
            <CheckboxList
              label={t("selectAll")}
              options={[{ value: ALL, label: t("selectAll") }]}
              selected={new Set(all ? [ALL] : [])}
              onToggle={() =>
                setSelected(all ? new Set() : new Set(students.map((student) => student.id)))
              }
            />
          </View>
          <Text tone="muted" size={14}>
            {t("selectedCount", { selected: chosen.length, total: students.length })}
          </Text>
        </View>
        <CheckboxList
          label={t("students")}
          options={students.map((student) => ({ value: student.id, label: student.fullName }))}
          selected={selected}
          onToggle={toggle}
        />
      </Section>
      <PrintButtons
        classId={classId}
        studentIds={chosen.map((student) => student.id)}
        month={month}
        printLabel={t("pageTitle")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  all: { flexDirection: "row", alignItems: "center", gap: 8 },
  allBox: { flex: 1 },
});
