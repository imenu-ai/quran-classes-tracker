import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { addExam, addHomework, updateHomework } from "@qct/core/data/entities/homework";
import { todayLessonId } from "@qct/core/data/entities/today";
import { todayInTimeZone } from "@qct/core/domain/dates/local-date";
import { latestPortion, suggestNextHomework } from "@qct/core/domain/homework/suggestion";
import {
  checkAyahRange,
  type AyahRangeDraft,
  type AyahRangeField,
} from "@qct/core/forms/ayah-range";
import { NOTE_MAX } from "@qct/core/shared/schemas/base";
import { isExam, type HomeworkRecord } from "@qct/core/shared/schemas/homework";
import type { StudentRecord } from "@qct/core/shared/schemas/student";
import { AyahRangeFields } from "@/components/ayah-range-fields";
import { Button } from "@/components/button";
import { Loading } from "@/components/loading";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useApp } from "@/data/app-data";
import { emitHomeworkCreated } from "@/data/homework-events";
import { useStudent, useStudentHomework } from "@/data/queries";
import { useTheme } from "@/theme/theme";

type Kind = "next" | "recite" | "exam" | "edit";

const ALL_FIELDS: AyahRangeField[] = ["surah", "fromAyah", "toAyah"];

/**
 * Homework for the next lesson, "recite now", an exam, or a portion's edit
 * (`?kind=` and, to edit, `?itemId=`), like the web's homework drawer. New
 * homework starts from the suggestion after the student's latest portion.
 * `?lessonId=` attaches it to that lesson; otherwise to today's, created
 * on save.
 */
export default function HomeworkFormScreen() {
  const { studentId, kind, itemId, lessonId } = useLocalSearchParams<{
    studentId: string;
    kind: Kind;
    itemId?: string;
    lessonId?: string;
  }>();
  const student = useStudent(studentId);
  const history = useStudentHomework(studentId);
  if (!student || !history) {
    return (
      <Screen width="form">
        <Loading />
      </Screen>
    );
  }
  const item = itemId ? history.find((h) => h.id === itemId) : undefined;
  // The portion was deleted meanwhile (another device): nothing to edit.
  if (kind === "edit" && !item) return <Gone />;
  return (
    <HomeworkForm kind={kind} student={student} history={history} item={item} lessonId={lessonId} />
  );
}

function Gone() {
  const t = useTranslations("common");
  return (
    <Screen width="form">
      <Button variant="plain" label={t("close")} onPress={() => router.back()} />
    </Screen>
  );
}

function initialDraft(
  kind: Kind,
  history: readonly HomeworkRecord[],
  student: StudentRecord,
  item?: HomeworkRecord,
): { draft: AyahRangeDraft; note: string; suggested: boolean } {
  if (item) {
    return {
      draft: { surah: item.surah, from: String(item.fromAyah), to: String(item.toAyah) },
      note: item.note,
      suggested: false,
    };
  }
  // An exam reviews any part: nothing is suggested for it.
  const suggestion =
    kind === "exam"
      ? null
      : suggestNextHomework(latestPortion(history), student.memorizationDirection);
  return {
    draft: suggestion
      ? {
          surah: suggestion.surah,
          from: String(suggestion.fromAyah),
          to: String(suggestion.toAyah),
        }
      : { surah: null, from: "", to: "" },
    note: "",
    suggested: suggestion !== null,
  };
}

function HomeworkForm({
  kind,
  student,
  history,
  item,
  lessonId,
}: Readonly<{
  kind: Kind;
  student: StudentRecord;
  history: readonly HomeworkRecord[];
  item?: HomeworkRecord;
  lessonId?: string;
}>) {
  const t = useTranslations();
  const { store, session } = useApp();
  const { colors } = useTheme();
  // Only from what was there when the form opened; later changes must not reset typing.
  const [initial] = useState(() => initialDraft(kind, history, student, item));
  const [draft, setDraft] = useState(initial.draft);
  const [note, setNote] = useState(initial.note);
  const [suggested, setSuggested] = useState(initial.suggested);
  const [touched, setTouched] = useState<ReadonlySet<AyahRangeField>>(new Set());
  const [busy, setBusy] = useState(false);

  const check = checkAyahRange(draft);
  const exam = kind === "exam" || (item !== undefined && isExam(item));
  const title = item
    ? exam
      ? t("exam.editTitle")
      : t("homework.editTitle")
    : kind === "recite"
      ? t("homework.reciteTitle")
      : kind === "exam"
        ? t("exam.addTitle")
        : t("homework.addTitle");

  async function save() {
    if (!check.ok) {
      setTouched(new Set(ALL_FIELDS));
      return;
    }
    setBusy(true);
    try {
      if (item) {
        await updateHomework(store, item.id, check.value, note);
      } else {
        const lesson =
          lessonId ??
          (await todayLessonId(store, student.classId, todayInTimeZone(session.timezone)));
        const created =
          kind === "exam"
            ? await addExam(store, {
                studentId: student.id,
                lessonId: lesson,
                portion: check.value,
                note,
              })
            : await addHomework(store, {
                studentId: student.id,
                lessonId: lesson,
                portion: check.value,
                note,
                evaluateNow: kind === "recite",
              });
        emitHomeworkCreated(created);
      }
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen width="form">
      <Stack.Screen options={{ title }} />
      <Text tone="muted">{student.fullName}</Text>
      {suggested ? (
        <View style={[styles.suggested, { backgroundColor: colors.accent }]}>
          <Text size={14} style={{ color: colors.accentForeground }}>
            {t("homework.suggested")}
          </Text>
        </View>
      ) : null}
      <AyahRangeFields
        value={draft}
        errors={check.errors}
        visibleErrors={touched}
        onChange={(next, field) => {
          setDraft(next);
          setSuggested(false);
          setTouched((current) => new Set(current).add(field));
        }}
      />
      <TextField
        label={t("glossary.notes")}
        value={note}
        onChangeText={setNote}
        maxLength={NOTE_MAX}
      />
      <Button label={t("common.save")} busy={busy} onPress={() => void save()} />
      <Button variant="plain" label={t("common.cancel")} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  suggested: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
});
