import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { addExam, addHomework, updateHomework } from "@qct/core/data/entities/homework";
import { todayLessonId } from "@qct/core/data/entities/today";
import { todayInTimeZone } from "@qct/core/domain/dates/local-date";
import {
  checkHomeworkDraft,
  startHomeworkDraft,
  switchEntryMode,
  type EntryMode,
  type HomeworkDraft,
} from "@qct/core/forms/homework-draft";
import { checkPageRange, type PageRangeField } from "@qct/core/forms/pages";
import { checkPortions } from "@qct/core/forms/portions";
import { NOTE_MAX } from "@qct/core/shared/schemas/base";
import { isExam, type HomeworkRecord } from "@qct/core/shared/schemas/homework";
import type { StudentRecord } from "@qct/core/shared/schemas/student";
import { ChoiceList } from "@/components/choice-list";
import { PageRangeFields } from "@/components/page-range-fields";
import { allTouched, PortionsFields } from "@/components/portions-fields";
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
  const [draft, setDraft] = useState<HomeworkDraft>(() =>
    startHomeworkDraft({ kind, item, history, direction: student.memorizationDirection }),
  );
  const [note, setNote] = useState(item?.note ?? "");
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [touchedPages, setTouchedPages] = useState<ReadonlySet<PageRangeField>>(new Set());
  const [busy, setBusy] = useState(false);

  const portionsCheck = checkPortions(draft.portions);
  const pagesCheck = checkPageRange(draft.pages);
  const change = (next: Partial<HomeworkDraft>) =>
    setDraft((current) => ({ ...current, ...next, suggested: false }));
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
    const check = checkHomeworkDraft(draft);
    if (!check.ok) {
      setTouched(allTouched(draft.portions));
      setTouchedPages(new Set(["fromPage", "toPage"]));
      return;
    }
    setBusy(true);
    try {
      if (item) {
        await updateHomework(store, item.id, check.portions, note, check.pages);
      } else {
        const lesson =
          lessonId ??
          (await todayLessonId(store, student.classId, todayInTimeZone(session.timezone)));
        const created =
          kind === "exam"
            ? await addExam(store, {
                studentId: student.id,
                lessonId: lesson,
                portions: check.portions,
                pages: check.pages,
                note,
              })
            : await addHomework(store, {
                studentId: student.id,
                lessonId: lesson,
                portions: check.portions,
                pages: check.pages,
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
      {draft.suggested ? (
        <View style={[styles.suggested, { backgroundColor: colors.accent }]}>
          <Text size={14} style={{ color: colors.accentForeground }}>
            {t("homework.suggested")}
          </Text>
        </View>
      ) : null}
      <ChoiceList
        label={t("homework.entryMode")}
        value={draft.mode}
        options={[
          { value: "ayahs", label: t("homework.byAyahs") },
          { value: "pages", label: t("homework.byPages") },
        ]}
        onChange={(mode: EntryMode) => setDraft((current) => switchEntryMode(current, mode))}
      />
      {draft.mode === "pages" ? (
        <PageRangeFields
          value={draft.pages}
          check={pagesCheck}
          visibleErrors={touchedPages}
          onChange={(pages, field) => {
            change({ pages });
            setTouchedPages((current) => new Set(current).add(field));
          }}
        />
      ) : (
        <PortionsFields
          value={draft.portions}
          errors={portionsCheck.errors}
          visibleErrors={touched}
          onChange={(portions, field) => {
            change({ portions });
            if (field) setTouched((current) => new Set(current).add(field));
          }}
        />
      )}
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
