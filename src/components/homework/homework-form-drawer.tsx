"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AyahRangeFields } from "@/components/quran/ayah-range-fields";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useApp } from "@/client/app-context";
import { addHomework, updateHomework } from "@/client/data/homework";
import {
  checkAyahRange,
  type AyahRangeDraft,
  type AyahRangeField,
} from "@/client/forms/ayah-range";
import { latestPortion, suggestNextHomework } from "@/domain/homework/suggestion";
import { NOTE_MAX } from "@/shared/schemas/base";
import type { HomeworkRecord } from "@/shared/schemas/homework";
import type { StudentRecord } from "@/shared/schemas/student";

export type HomeworkFormMode =
  { kind: "next" } | { kind: "recite" } | { kind: "edit"; item: HomeworkRecord };

const ALL_FIELDS: AyahRangeField[] = ["surah", "fromAyah", "toAyah"];

/**
 * Add homework for the next lesson, "recite now", or edit a portion. New
 * homework is pre-filled with the suggestion after the student's latest
 * portion (from the sura map, in their memorization direction).
 */
export function HomeworkFormDrawer({
  open,
  onOpenChange,
  mode,
  student,
  history,
  lessonId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: HomeworkFormMode;
  student: StudentRecord;
  history: readonly HomeworkRecord[];
  /**
   * The lesson new homework belongs to, or a function that provides it at
   * save time (today's lesson is only created when something is recorded).
   */
  lessonId: string | (() => Promise<string>);
}) {
  const t = useTranslations();
  const { store } = useApp();
  const noteId = useId();
  const [draft, setDraft] = useState<AyahRangeDraft>({ surah: null, from: "", to: "" });
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState<Set<AyahRangeField>>(new Set());
  const [suggested, setSuggested] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(new Set());
    if (mode.kind === "edit") {
      const { item } = mode;
      setDraft({ surah: item.surah, from: String(item.fromAyah), to: String(item.toAyah) });
      setNote(item.note);
      setSuggested(false);
      return;
    }
    const suggestion = suggestNextHomework(latestPortion(history), student.memorizationDirection);
    setDraft(
      suggestion
        ? {
            surah: suggestion.surah,
            from: String(suggestion.fromAyah),
            to: String(suggestion.toAyah),
          }
        : { surah: null, from: "", to: "" },
    );
    setNote("");
    setSuggested(suggestion !== null);
    // Only when the drawer opens; later history changes must not reset typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const check = checkAyahRange(draft);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!check.ok) {
      setTouched(new Set(ALL_FIELDS));
      return;
    }
    if (mode.kind === "edit") {
      await updateHomework(store, mode.item.id, check.value, note);
    } else {
      await addHomework(store, {
        studentId: student.id,
        lessonId: typeof lessonId === "string" ? lessonId : await lessonId(),
        portion: check.value,
        note,
        evaluateNow: mode.kind === "recite",
      });
    }
    toast.success(t("homework.saved"));
    onOpenChange(false);
  }

  const title =
    mode.kind === "edit"
      ? t("homework.editTitle")
      : mode.kind === "recite"
        ? t("homework.reciteTitle")
        : t("homework.addTitle");

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent>
        <form
          onSubmit={submit}
          noValidate
          className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col"
        >
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <p dir="auto" className="text-sm text-muted-foreground">
              {student.fullName}
            </p>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
            {suggested && (
              <p className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                <Sparkles aria-hidden className="size-4 shrink-0" />
                {t("homework.suggested")}
              </p>
            )}
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
            <Field>
              <FieldLabel htmlFor={noteId}>{t("glossary.notes")}</FieldLabel>
              <Input
                id={noteId}
                dir="auto"
                className="h-11"
                maxLength={NOTE_MAX}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          </div>
          <DrawerFooter className="flex-row border-t">
            <Button type="submit" size="lg" className="h-12 flex-1">
              {t("common.save")}
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
