"use client";

import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useApp } from "@/client/app-context";
import { isLocalDate, todayInTimeZone } from "@qct/core/domain/dates/local-date";

/** The student page for a day: today without a date, a past day with one. */
export const studentDayHref = (studentId: string, date: string | null) =>
  date ? `/student?id=${studentId}&date=${date}` : `/student?id=${studentId}`;

/**
 * "إضافة جلسة": pick a past day (or today) in the phone's date picker and
 * open the student's session for it, to record what happened that day.
 */
export function AddSession({ studentId }: { studentId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { session } = useApp();
  const id = useId();
  const today = todayInTimeZone(session.timezone);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const future = isLocalDate(date) && date > today;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLocalDate(date) || future) return;
    setOpen(false);
    router.push(studentDayHref(studentId, date === today ? null : date));
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-12 self-start text-base"
        onClick={() => {
          setDate(today);
          setOpen(true);
        }}
      >
        <CalendarPlus aria-hidden />
        {t("day.add")}
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-md flex-col">
            <DrawerHeader>
              <DrawerTitle>{t("day.pickTitle")}</DrawerTitle>
              <DrawerDescription>{t("day.pickHint")}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <Field data-invalid={future ? true : undefined}>
                <FieldLabel htmlFor={id}>{t("glossary.date")}</FieldLabel>
                <Input
                  id={id}
                  type="date"
                  max={today}
                  className="h-12 text-base"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
                {future && <FieldError>{t("day.futureNotAllowed")}</FieldError>}
              </Field>
            </div>
            <DrawerFooter className="flex-row border-t">
              <Button
                type="submit"
                size="lg"
                className="h-12 flex-1"
                disabled={!isLocalDate(date) || future}
              >
                {t("day.open")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12"
                onClick={() => setOpen(false)}
              >
                {t("common.cancel")}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
