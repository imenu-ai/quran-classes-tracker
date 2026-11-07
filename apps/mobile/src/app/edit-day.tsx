import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { rateHomework, setStudentAttendance } from "@qct/core/data/entities/homework";
import type { HistoryRow, StudentProfile } from "@qct/core/domain/stats/month-sheet";
import {
  isExam,
  marksIn,
  memorizationChoices,
  notMemorizedIn,
} from "@qct/core/shared/schemas/homework";
import { AttendanceToggle, ExcuseNoteInput } from "@/components/attendance";
import { Button } from "@/components/button";
import { Loading } from "@/components/loading";
import { ScorePicker } from "@/components/score-picker";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { useApp } from "@/data/app-data";
import { useStudentProfile } from "@/data/queries";
import { useLessonDate, usePortionLabel } from "@/i18n/portion";

interface EditTarget {
  studentId: string;
  kind: HistoryRow["kind"];
  id: string;
  lessonId: string;
}

/**
 * The live record behind the sheet, looked up in ALL of the student's data
 * (not just the month's rows): turning an absence into "present" removes it
 * from the table, but the open sheet must keep showing it (as on the web).
 */
function resolveTarget(target: EditTarget, profile: StudentProfile): HistoryRow | null {
  const lesson = profile.lessonsById.get(target.lessonId);
  if (!lesson) return null;
  if (target.kind === "absence") {
    const record = profile.attendance.find((a) => a.id === target.id);
    return record ? { kind: "absence", lesson, record } : null;
  }
  const item = profile.homework.find((h) => h.id === target.id);
  if (!item) return null;
  if (target.kind === "notMemorized") {
    const behaviorRate = notMemorizedIn(item, lesson.id)?.behaviorRate ?? null;
    return { kind: "notMemorized", lesson, item, behaviorRate };
  }
  return { kind: "evaluation", lesson, item };
}

/**
 * Form sheet correcting one past day from the month table: the marks of an
 * evaluation or a "لم يحفظ", or an absence. Changes save as they're made.
 */
export default function EditDaySheet() {
  const t = useTranslations();
  const target = useLocalSearchParams<EditTarget & Record<string, string>>();
  const { store } = useApp();
  const profile = useStudentProfile(target.studentId);
  const label = usePortionLabel();
  const lessonDate = useLessonDate();

  if (profile === undefined) {
    return (
      <Sheet title={t("profile.editEvaluationTitle")}>
        <Loading />
      </Sheet>
    );
  }
  const row = profile ? resolveTarget(target, profile) : null;
  if (!row) {
    return (
      <Sheet title={t("profile.editEvaluationTitle")}>
        <Button variant="plain" label={t("common.close")} onPress={() => router.back()} />
      </Sheet>
    );
  }

  const exam = row.kind !== "absence" && isExam(row.item);
  // The pickers of a homework row (unused on an absence).
  const marks =
    row.kind === "absence"
      ? { memorization: null, behavior: null }
      : marksIn(row.item, row.lesson.id);
  const choices =
    row.kind === "absence"
      ? { marks: false, notMemorized: false }
      : memorizationChoices(row.item, row.lesson.id);
  const title = exam
    ? t("exam.editTitle")
    : row.kind === "evaluation"
      ? t("profile.editEvaluationTitle")
      : row.kind === "notMemorized"
        ? t("profile.editNotMemorizedTitle")
        : t("profile.editAttendanceTitle");

  return (
    <Sheet title={title} description={lessonDate(row.lesson.date)}>
      {row.kind === "absence" ? (
        <>
          <AttendanceToggle
            label={t("glossary.attendance")}
            value={row.record.status}
            required
            onChange={(status) => {
              if (status) {
                void setStudentAttendance(store, row.lesson.id, target.studentId, status);
              }
            }}
          />
          {row.record.status === "excused" ? (
            <ExcuseNoteInput
              lessonId={row.lesson.id}
              studentId={target.studentId}
              saved={row.record.excuseNote}
            />
          ) : null}
        </>
      ) : (
        <>
          <Text weight="semibold" size={18}>
            {label(row.item)}
          </Text>
          <Button
            variant="plain"
            label={t("evaluation.editRange")}
            onPress={() =>
              router.push({
                pathname: "/homework-form",
                params: {
                  studentId: target.studentId,
                  kind: "edit",
                  itemId: row.item.id,
                  lessonId: row.lesson.id,
                },
              })
            }
          />
          <View style={styles.pickers}>
            <ScorePicker
              label={exam ? t("exam.mark") : t("glossary.memorizationRate")}
              value={marks.memorization}
              notMemorized={choices.notMemorized}
              marks={choices.marks}
              onChange={(value) =>
                rateHomework(store, row.item, row.lesson.id, "memorizationRate", value)
              }
            />
            {exam ? (
              <View style={styles.spacer} />
            ) : (
              <ScorePicker
                label={t("glossary.behaviorRate")}
                value={marks.behavior}
                onChange={(value) =>
                  rateHomework(store, row.item, row.lesson.id, "behaviorRate", value)
                }
              />
            )}
          </View>
        </>
      )}
      <Button variant="plain" label={t("common.close")} onPress={() => router.back()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pickers: { flexDirection: "row", gap: 12 },
  spacer: { flex: 1 },
});
