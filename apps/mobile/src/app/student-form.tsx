import { useEffect, useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { createStudent, updateStudent, type StudentInput } from "@qct/core/data/entities/students";
import { LocalValidationError } from "@qct/core/data/local-store";
import { parseIntegerInput } from "@qct/core/domain/text/digits";
import { NAME_MAX, NOTE_MAX } from "@qct/core/shared/schemas/base";
import type { FieldError } from "@qct/core/shared/schemas/errors";
import {
  MEMORIZATION_DIRECTIONS,
  normalizeParentId,
  type MemorizationDirection,
  type StudentRecord,
} from "@qct/core/shared/schemas/student";
import { Button } from "@/components/button";
import { ChoiceList } from "@/components/choice-list";
import { Loading } from "@/components/loading";
import { PickerField } from "@/components/picker-field";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { useApp } from "@/data/app-data";
import { useActiveClasses, useClass, useStudent } from "@/data/queries";
import { useErrorMessage } from "@/i18n/use-error-message";

type FieldName =
  "fullName" | "birthYear" | "classId" | "memorizationDirection" | "note" | "parentId";

interface FormState {
  fullName: string;
  birthYear: string;
  classId: string;
  memorizationDirection: MemorizationDirection;
  note: string;
  parentId: string;
}

const initialState = (classId: string, existing?: StudentRecord | null): FormState => ({
  fullName: existing?.fullName ?? "",
  birthYear: existing ? String(existing.birthYear) : "",
  classId: existing?.classId ?? classId,
  memorizationDirection: existing?.memorizationDirection ?? "forward",
  note: existing?.note ?? "",
  parentId: existing?.parentId ?? "",
});

/**
 * Adds a student (`?classId=` pre-selects the class) or edits one (`?id=`),
 * with the same fields and validation as the web's form.
 */
export default function StudentFormScreen() {
  const { id, classId } = useLocalSearchParams<{ id?: string; classId?: string }>();
  const existing = useStudent(id ?? null);
  // Editing waits for the student, so the form starts from their values.
  if (id && existing === undefined) {
    return (
      <Screen width="form">
        <Loading />
      </Screen>
    );
  }
  return <StudentForm classId={classId ?? ""} existing={existing ?? undefined} />;
}

function StudentForm({
  classId,
  existing,
}: Readonly<{ classId: string; existing?: StudentRecord }>) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const { store } = useApp();
  const activeClasses = useActiveClasses() ?? [];
  const currentClass = useClass(existing?.classId ?? null);
  const [form, setForm] = useState<FormState>(() => initialState(classId, existing));
  const [errors, setErrors] = useState<Partial<Record<FieldName, FieldError>>>({});
  const [busy, setBusy] = useState(false);

  // A student synced away meanwhile: nothing left to edit.
  useEffect(() => {
    if (existing?.deletedAt) router.back();
  }, [existing?.deletedAt]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    // An edited field's old error no longer applies.
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  async function save() {
    const input: StudentInput = {
      classId: form.classId,
      fullName: form.fullName,
      birthYear: parseIntegerInput(form.birthYear),
      note: form.note,
      memorizationDirection: form.memorizationDirection,
      parentId: normalizeParentId(form.parentId),
    };
    setBusy(true);
    try {
      if (existing) await updateStudent(store, existing.id, input);
      else await createStudent(store, input);
      router.back();
    } catch (caught) {
      if (!(caught instanceof LocalValidationError)) throw caught;
      const byField: Partial<Record<FieldName, FieldError>> = {};
      for (const error of caught.errors) byField[error.path as FieldName] ??= error;
      setErrors(byField);
    } finally {
      setBusy(false);
    }
  }

  const error = (field: FieldName) => (errors[field] ? errorMessage(errors[field]) : null);
  // A student's current class stays selectable even if it has been archived.
  const classOptions =
    currentClass && !activeClasses.some((c) => c.id === currentClass.id)
      ? [currentClass, ...activeClasses]
      : activeClasses;

  return (
    <Screen width="form">
      <Stack.Screen options={{ title: t(existing ? "students.editTitle" : "students.addTitle") }} />
      <TextField
        testID="student.name"
        label={t("students.fullName")}
        value={form.fullName}
        onChangeText={(value) => set("fullName", value)}
        error={error("fullName")}
        maxLength={NAME_MAX}
        autoComplete="off"
      />
      <TextField
        testID="student.birth-year"
        label={t("students.birthYear")}
        value={form.birthYear}
        onChangeText={(value) => set("birthYear", value)}
        error={error("birthYear")}
        keyboardType="number-pad"
        maxLength={4}
        autoComplete="off"
      />
      <PickerField
        label={t("students.class")}
        value={form.classId}
        onChange={(value) => set("classId", value)}
        options={classOptions.map((c) => ({ value: c.id, label: c.name }))}
        error={error("classId")}
      />
      <ChoiceList
        label={t("students.direction")}
        value={form.memorizationDirection}
        onChange={(value) => set("memorizationDirection", value)}
        options={MEMORIZATION_DIRECTIONS.map((direction) => ({
          value: direction,
          label: t(`students.${direction}`),
        }))}
      />
      <TextField
        label={t("students.note")}
        value={form.note}
        onChangeText={(value) => set("note", value)}
        error={error("note")}
        maxLength={NOTE_MAX}
        multiline
        style={{ minHeight: 80, paddingVertical: 10, textAlignVertical: "top" }}
      />
      <TextField
        testID="student.parent-id"
        label={t("students.parentId")}
        hint={errors.parentId ? undefined : t("students.parentIdHint")}
        value={form.parentId}
        onChangeText={(value) => set("parentId", value)}
        error={error("parentId")}
        keyboardType="number-pad"
        maxLength={30}
        autoComplete="off"
      />
      <Button
        label={t(existing ? "common.save" : "students.add")}
        busy={busy}
        onPress={() => void save()}
      />
      <Button variant="plain" label={t("common.cancel")} onPress={() => router.back()} />
    </Screen>
  );
}
