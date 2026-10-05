"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useApp } from "@/client/app-context";
import { isLocalDate, todayInTimeZone, type LocalDate } from "@/domain/dates/local-date";

/**
 * Asks for a lesson date (today or earlier). `onSubmit` returns an error
 * message key to show, or null when done.
 */
export function LessonDateDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initialDate,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  initialDate?: LocalDate;
  onSubmit: (date: LocalDate) => Promise<"dateTaken" | null>;
}) {
  const t = useTranslations();
  const { session } = useApp();
  const inputId = useId();
  const today = todayInTimeZone(session.timezone);
  const [date, setDate] = useState<string>(initialDate ?? today);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(initialDate ?? today);
      setError(null);
    }
  }, [open, initialDate, today]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLocalDate(date)) return setError(t("errors.validation.INVALID_FORMAT"));
    if (date > today) return setError(t("lessons.dateInFuture"));
    setBusy(true);
    try {
      const problem = await onSubmit(date);
      if (problem) setError(t(`lessons.${problem}`));
      else onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={inputId}>{t("glossary.date")}</FieldLabel>
            <Input
              id={inputId}
              type="date"
              className="h-12"
              max={today}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="submit" className="h-11" disabled={busy}>
              {submitLabel}
            </Button>
            <AlertDialogCancel type="button" className="h-11">
              {t("common.cancel")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
