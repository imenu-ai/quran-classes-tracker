"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useApp } from "@/client/app-context";
import { useActiveClasses, useClass } from "@/client/data/classes";
import { createStudent, updateStudent, type StudentInput } from "@/client/data/students";
import { LocalValidationError } from "@/client/db/local-store";
import { parseIntegerInput } from "@/domain/text/digits";
import { useErrorMessage } from "@/i18n/use-error-message";
import type { FieldError as FieldErrorData } from "@/shared/schemas/errors";
import { NAME_MAX, NOTE_MAX } from "@/shared/schemas/base";
import {
  MEMORIZATION_DIRECTIONS,
  type MemorizationDirection,
  type StudentRecord,
} from "@/shared/schemas/student";

type FieldName = "fullName" | "birthYear" | "classId" | "memorizationDirection" | "note";

interface FormState {
  fullName: string;
  birthYear: string;
  classId: string;
  memorizationDirection: MemorizationDirection;
  note: string;
}

const initialState = (classId: string, existing?: StudentRecord): FormState => ({
  fullName: existing?.fullName ?? "",
  birthYear: existing ? String(existing.birthYear) : "",
  classId: existing?.classId ?? classId,
  memorizationDirection: existing?.memorizationDirection ?? "forward",
  note: existing?.note ?? "",
});

/** Bottom sheet to add a student (class pre-selected) or edit one. */
export function StudentFormDrawer({
  open,
  onOpenChange,
  classId,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected class when adding. */
  classId: string;
  existing?: StudentRecord;
}) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const { store } = useApp();
  const activeClasses = useActiveClasses() ?? [];
  const currentClass = useClass(existing?.classId ?? null);
  const ids = {
    fullName: useId(),
    birthYear: useId(),
    classId: useId(),
    direction: useId(),
    note: useId(),
  };
  const [form, setForm] = useState<FormState>(() => initialState(classId, existing));
  const [errors, setErrors] = useState<Partial<Record<FieldName, FieldErrorData>>>({});

  useEffect(() => {
    if (open) {
      setForm(initialState(classId, existing));
      setErrors({});
    }
  }, [open, classId, existing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    // An edited field's old error no longer applies.
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: StudentInput = {
      classId: form.classId,
      fullName: form.fullName,
      birthYear: parseIntegerInput(form.birthYear),
      note: form.note,
      memorizationDirection: form.memorizationDirection,
    };
    try {
      if (existing) await updateStudent(store, existing.id, input);
      else await createStudent(store, input);
      toast.success(t(existing ? "students.saved" : "students.added"));
      onOpenChange(false);
    } catch (caught) {
      if (!(caught instanceof LocalValidationError)) throw caught;
      const byField: Partial<Record<FieldName, FieldErrorData>> = {};
      for (const error of caught.errors) byField[error.path as FieldName] ??= error;
      setErrors(byField);
    }
  }

  const error = (field: FieldName) =>
    errors[field] ? <FieldError>{errorMessage(errors[field])}</FieldError> : null;

  // A student's current class stays selectable even if it has been archived.
  const classOptions =
    currentClass && !activeClasses.some((c) => c.id === currentClass.id)
      ? [currentClass, ...activeClasses]
      : activeClasses;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent>
        {/* Header and buttons stay put; only the fields scroll (keyboard-friendly on iOS). */}
        <form
          onSubmit={onSubmit}
          noValidate
          className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col"
        >
          <DrawerHeader>
            <DrawerTitle>{t(existing ? "students.editTitle" : "students.addTitle")}</DrawerTitle>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
            <Field data-invalid={errors.fullName ? true : undefined}>
              <FieldLabel htmlFor={ids.fullName}>{t("students.fullName")}</FieldLabel>
              <Input
                id={ids.fullName}
                dir="auto"
                autoComplete="off"
                className="h-12"
                maxLength={NAME_MAX}
                value={form.fullName}
                onChange={(event) => set("fullName", event.target.value)}
                aria-invalid={errors.fullName ? true : undefined}
              />
              {error("fullName")}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={errors.birthYear ? true : undefined}>
                <FieldLabel htmlFor={ids.birthYear}>{t("students.birthYear")}</FieldLabel>
                <Input
                  id={ids.birthYear}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  className="h-12"
                  value={form.birthYear}
                  onChange={(event) => set("birthYear", event.target.value)}
                  aria-invalid={errors.birthYear ? true : undefined}
                />
                {error("birthYear")}
              </Field>

              <Field data-invalid={errors.classId ? true : undefined}>
                <FieldLabel htmlFor={ids.classId}>{t("students.class")}</FieldLabel>
                <Select value={form.classId} onValueChange={(value) => set("classId", value)}>
                  <SelectTrigger id={ids.classId} className="h-12 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        <bdi>{cls.name}</bdi>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {error("classId")}
              </Field>
            </div>

            <Field>
              <FieldLabel id={ids.direction}>{t("students.direction")}</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                aria-labelledby={ids.direction}
                className="w-full flex-col items-stretch"
                value={form.memorizationDirection}
                onValueChange={(value) => {
                  if (value) set("memorizationDirection", value as MemorizationDirection);
                }}
              >
                {MEMORIZATION_DIRECTIONS.map((direction) => (
                  <ToggleGroupItem
                    key={direction}
                    value={direction}
                    className="h-auto min-h-11 justify-start py-2 text-start whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-accent"
                  >
                    {t(`students.${direction}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <Field data-invalid={errors.note ? true : undefined}>
              <FieldLabel htmlFor={ids.note}>{t("students.note")}</FieldLabel>
              <Textarea
                id={ids.note}
                dir="auto"
                rows={2}
                maxLength={NOTE_MAX}
                value={form.note}
                onChange={(event) => set("note", event.target.value)}
              />
              {error("note")}
            </Field>
          </div>

          <DrawerFooter className="flex-row border-t">
            <Button type="submit" size="lg" className="h-12 flex-1">
              {t(existing ? "common.save" : "students.add")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
