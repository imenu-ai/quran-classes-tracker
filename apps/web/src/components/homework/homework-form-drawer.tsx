"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageRangeFields } from "@/components/quran/page-range-fields";
import { allTouched, PortionsFields } from "@/components/quran/portions-fields";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { addExam, addHomework, updateHomework } from "@qct/core/data/entities/homework";
import {
  checkHomeworkDraft,
  startHomeworkDraft,
  switchEntryMode,
  type EntryMode,
  type HomeworkDraft,
} from "@qct/core/forms/homework-draft";
import { checkPageRange, type PageRangeField } from "@qct/core/forms/pages";
import { checkPortions, portionDrafts } from "@qct/core/forms/portions";
import { NOTE_MAX } from "@qct/core/shared/schemas/base";
import { isExam, type HomeworkRecord } from "@qct/core/shared/schemas/homework";
import type { StudentRecord } from "@qct/core/shared/schemas/student";

export type HomeworkFormMode =
  { kind: "next" } | { kind: "recite" } | { kind: "exam" } | { kind: "edit"; item: HomeworkRecord };

/**
 * Add homework for the next lesson, "recite now", or edit a portion: one or
 * more suras with their ayahs, or whole pages of the mushaf. New homework is
 * pre-filled with the suggestion after the student's latest (by pages when
 * that was by pages), in their memorization direction.
 */
export function HomeworkFormDrawer({
  open,
  onOpenChange,
  mode,
  student,
  history,
  lessonId,
  onCreated,
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
  /** Called with new homework once it's saved (not for edits). */
  onCreated?: (item: HomeworkRecord) => void;
}) {
  const t = useTranslations();
  const { store } = useApp();
  const noteId = useId();
  const [draft, setDraft] = useState<HomeworkDraft>(() => ({
    mode: "ayahs",
    portions: portionDrafts([]),
    pages: { from: "", to: "" },
    suggested: false,
  }));
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [touchedPages, setTouchedPages] = useState<ReadonlySet<PageRangeField>>(new Set());

  useEffect(() => {
    if (!open) return;
    setTouched(new Set());
    setTouchedPages(new Set());
    setDraft(
      startHomeworkDraft({
        kind: mode.kind,
        item: mode.kind === "edit" ? mode.item : undefined,
        history,
        direction: student.memorizationDirection,
      }),
    );
    setNote(mode.kind === "edit" ? mode.item.note : "");
    // Only when the drawer opens; later history changes must not reset typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const portionsCheck = checkPortions(draft.portions);
  const pagesCheck = checkPageRange(draft.pages);
  const exam = mode.kind === "exam" || (mode.kind === "edit" && isExam(mode.item));
  const change = (next: Partial<HomeworkDraft>) =>
    setDraft((current) => ({ ...current, ...next, suggested: false }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const check = checkHomeworkDraft(draft);
    if (!check.ok) {
      setTouched(allTouched(draft.portions));
      setTouchedPages(new Set(["fromPage", "toPage"]));
      return;
    }
    if (mode.kind === "edit") {
      await updateHomework(store, mode.item.id, check.portions, note, check.pages);
    } else {
      const lesson = typeof lessonId === "string" ? lessonId : await lessonId();
      const created =
        mode.kind === "exam"
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
              evaluateNow: mode.kind === "recite",
            });
      onCreated?.(created);
    }
    toast.success(exam ? t("exam.saved") : t("homework.saved"));
    onOpenChange(false);
  }

  const title =
    mode.kind === "edit"
      ? exam
        ? t("exam.editTitle")
        : t("homework.editTitle")
      : mode.kind === "recite"
        ? t("homework.reciteTitle")
        : mode.kind === "exam"
          ? t("exam.addTitle")
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
            {draft.suggested && (
              <p className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
                <Sparkles aria-hidden className="size-4 shrink-0" />
                {t("homework.suggested")}
              </p>
            )}
            <ToggleGroup
              type="single"
              variant="outline"
              className="w-full"
              aria-label={t("homework.entryMode")}
              value={draft.mode}
              onValueChange={(value) =>
                value && setDraft((current) => switchEntryMode(current, value as EntryMode))
              }
            >
              {(["ayahs", "pages"] as const).map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="h-11 flex-1 data-[state=on]:border-primary data-[state=on]:bg-accent"
                >
                  {t(value === "ayahs" ? "homework.byAyahs" : "homework.byPages")}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
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
