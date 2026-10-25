import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useFormatter, useTranslations } from "use-intl";
import { clearAttendance } from "@qct/core/data/entities/attendance";
import {
  deleteHomework,
  postponeHomework,
  rateHomework,
  setStudentAttendance,
  undoEvaluation,
  undoPostpone,
} from "@qct/core/data/entities/homework";
import { todayLessonId } from "@qct/core/data/entities/today";
import { localDateToUtcDate } from "@qct/core/domain/dates/local-date";
import { isExam, postponedLessonsOf, type HomeworkRecord } from "@qct/core/shared/schemas/homework";
import type { StudentRecord } from "@qct/core/shared/schemas/student";
import { useAccess } from "@/data/access";
import { useApp } from "@/data/app-data";
import { onHomeworkCreated } from "@/data/homework-events";
import { useStudentToday } from "@/data/queries";
import { usePortionLabel } from "@/i18n/portion";
import { useTheme } from "@/theme/theme";
import { AttendanceToggle, ExcuseNoteInput } from "./attendance";
import { Button } from "./button";
import { HomeworkItem } from "./homework-item";
import { IconButton } from "./icons";
import { Text } from "./text";

export type HomeworkFormKind = "next" | "recite" | "exam";

/**
 * Today, for one student (the web's StudentToday): attendance, the homework
 * due with its marks (or postponing), exams, and homework for the next day.
 * Today's lesson is created behind the scenes on the first thing recorded.
 * Without `lessons.run` everything is shown, not changed.
 */
export function TodayCard({ student }: Readonly<{ student: StudentRecord }>) {
  const t = useTranslations();
  const format = useFormatter();
  const { store } = useApp();
  const { colors } = useTheme();
  const canRun = useAccess().can("lessons.run");
  const label = usePortionLabel();
  const today = useStudentToday(student);
  // Items start closed; this holds the ones the teacher opened, by id.
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const setOpen = (id: string, open: boolean) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  // An item recited on the spot opens: it was added to be marked.
  useEffect(
    () =>
      onHomeworkCreated((item) => {
        if (item.studentId === student.id && item.evaluatedLessonId !== null) {
          setOpenIds((current) => new Set(current).add(item.id));
        }
      }),
    [student.id],
  );

  if (!today) return null;

  const { date, lesson, attendance, homework } = today;
  /** Today's lesson id, creating the lesson on the first write. */
  const lessonId = () => todayLessonId(store, student.classId, date);
  const absent = attendance !== null && attendance.status !== "present";
  const items = [...homework.evaluatedHere, ...homework.toRecite];
  const postponedToday = (item: HomeworkRecord) =>
    lesson !== null && postponedLessonsOf(item).includes(lesson.id);
  const openForm = (kind: HomeworkFormKind) =>
    router.push({ pathname: "/homework-form", params: { studentId: student.id, kind } });
  const editItem = (item: HomeworkRecord) =>
    router.push({
      pathname: "/homework-form",
      params: { studentId: student.id, kind: "edit", itemId: item.id },
    });

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.titleRow}>
        <Text weight="bold" size={22} accessibilityRole="header">
          {t("today.title")}
        </Text>
        <Text tone="muted">{format.dateTime(localDateToUtcDate(date), "lessonDate")}</Text>
      </View>

      {!canRun ? (
        <View style={[styles.note, { backgroundColor: colors.muted }]}>
          <Text tone="muted" size={14}>
            {t("today.viewOnly")}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <AttendanceToggle
          label={t("glossary.attendance")}
          value={attendance?.status ?? null}
          disabled={!canRun}
          onChange={(status) =>
            void (async () => {
              if (status === null) {
                if (lesson) await clearAttendance(store, lesson.id, student.id);
                return;
              }
              await setStudentAttendance(store, await lessonId(), student.id, status);
            })()
          }
        />
        {attendance?.status === "excused" && lesson ? (
          <ExcuseNoteInput
            lessonId={lesson.id}
            studentId={student.id}
            saved={attendance.excuseNote}
            disabled={!canRun}
          />
        ) : null}
      </View>

      {absent ? (
        <View style={[styles.note, { backgroundColor: colors.muted }]}>
          <Text tone="muted" size={14}>
            {t("today.absentNote")}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <Text weight="semibold" size={18}>
              {t("today.homework")}
            </Text>
            {items.length === 0 ? (
              <View style={[styles.note, { backgroundColor: colors.muted }]}>
                <Text tone="muted">{t("evaluation.noPending")}</Text>
                {canRun ? (
                  <Button
                    variant="plain"
                    label={t("evaluation.reciteNow")}
                    onPress={() => openForm("recite")}
                  />
                ) : null}
              </View>
            ) : (
              items.map((item) => (
                <HomeworkItem
                  key={item.id}
                  item={item}
                  label={label(item)}
                  open={openIds.has(item.id)}
                  onToggle={() => setOpen(item.id, !openIds.has(item.id))}
                  exam={isExam(item)}
                  evaluated={lesson !== null && item.evaluatedLessonId === lesson.id}
                  postponed={postponedToday(item)}
                  readOnly={!canRun}
                  onEdit={() => editItem(item)}
                  onRate={async (field, score) =>
                    rateHomework(store, item, await lessonId(), field, score)
                  }
                  onUndo={() => {
                    if (lesson) void undoEvaluation(store, item, lesson.id);
                  }}
                  onPostpone={() =>
                    void (async () => postponeHomework(store, item, await lessonId()))()
                  }
                  onUndoPostpone={() => {
                    if (lesson) void undoPostpone(store, item, lesson.id);
                  }}
                />
              ))
            )}
            {canRun ? <ExamButton label={t("exam.add")} onPress={() => openForm("exam")} /> : null}
          </View>

          <View style={[styles.next, { borderColor: colors.border }]}>
            <Text weight="semibold" size={18}>
              {t("today.nextTitle")}
            </Text>
            {homework.nextHomework.map((item) => (
              <View key={item.id} style={[styles.nextItem, { backgroundColor: colors.background }]}>
                <Text weight="medium" style={styles.nextLabel} numberOfLines={2}>
                  {label(item)}
                </Text>
                {canRun ? (
                  <>
                    <IconButton
                      sf="pencil"
                      md="edit"
                      label={t("homework.editTitle")}
                      onPress={() => editItem(item)}
                    />
                    <IconButton
                      sf="trash"
                      md="delete"
                      label={t("evaluation.deleteHomework")}
                      color={colors.destructive}
                      onPress={() => void deleteHomework(store, item.id)}
                    />
                  </>
                ) : null}
              </View>
            ))}
            {canRun ? (
              <Button variant="plain" label={t("today.addNext")} onPress={() => openForm("next")} />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

/** "إضافة اختبار" in the exam colour. */
function ExamButton({ label, onPress }: Readonly<{ label: string; onPress: () => void }>) {
  const { colors } = useTheme();
  return <Button variant="plain" label={label} onPress={onPress} color={colors.exam} />;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 18 },
  titleRow: { gap: 2 },
  section: { gap: 10 },
  note: { borderRadius: 10, padding: 12, gap: 10 },
  next: { borderWidth: 2, borderStyle: "dashed", borderRadius: 12, padding: 14, gap: 10 },
  nextItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingStart: 12,
  },
  nextLabel: { flex: 1 },
});
