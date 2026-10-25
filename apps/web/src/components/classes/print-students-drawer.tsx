"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { printHref } from "@/client/data/print";
import { nativeSelectClass } from "@/lib/native-select";
import type { StudentRecord } from "@qct/core/shared/schemas/student";

/**
 * Prints several students' month sheets: pick the month and the students
 * ("select all" in one tap; everyone is selected at first), then open the
 * print page with one A4 page per student.
 */
export function PrintStudentsDrawer({
  open,
  onOpenChange,
  classId,
  students,
  months,
  defaultMonth,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  /** In the order they're listed and printed. */
  students: readonly StudentRecord[];
  /** "YYYY-MM", newest first. */
  months: readonly string[];
  defaultMonth: string;
}) {
  const t = useTranslations("print");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const monthId = useId();
  const [month, setMonth] = useState(defaultMonth);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setMonth(defaultMonth);
    setSelected(new Set(students.map((student) => student.id)));
    // Only when the drawer opens; later list changes must not reset the choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const all = students.length > 0 && students.every((student) => selected.has(student.id));
  const some = !all && students.some((student) => selected.has(student.id));
  const chosen = students.filter((student) => selected.has(student.id));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (chosen.length === 0) return;
    router.push(
      printHref(
        classId,
        month,
        chosen.map((student) => student.id),
      ),
    );
  }

  const monthLabel = (key: string) => format.dateTime(new Date(`${key}-01T00:00:00Z`), "month");

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent>
        <form onSubmit={submit} className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
          <DrawerHeader>
            <DrawerTitle>{t("printStudents")}</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={monthId} className="text-sm font-medium text-muted-foreground">
                {t("month")}
              </label>
              <select
                id={monthId}
                className={nativeSelectClass}
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              >
                {months.map((key) => (
                  <option key={key} value={key}>
                    {monthLabel(key)}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="flex flex-col rounded-xl border px-4 py-1">
              <legend className="sr-only">{t("students")}</legend>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 border-b font-semibold">
                <input
                  type="checkbox"
                  checked={all}
                  // Some, not all: shown as a dash.
                  ref={(input) => {
                    if (input) input.indeterminate = some;
                  }}
                  onChange={() =>
                    setSelected(all ? new Set() : new Set(students.map((student) => student.id)))
                  }
                  className="size-5 shrink-0 accent-primary"
                />
                <span className="flex-1">{t("selectAll")}</span>
                <span className="text-sm font-normal text-muted-foreground tabular-nums">
                  {t("selectedCount", { selected: chosen.length, total: students.length })}
                </span>
              </label>
              {students.map((student) => (
                <label key={student.id} className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(student.id)}
                    onChange={() => toggle(student.id)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span dir="auto" className="truncate">
                    {student.fullName}
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
          <DrawerFooter className="flex-row border-t">
            <Button type="submit" size="lg" className="h-12 flex-1" disabled={chosen.length === 0}>
              {t("show")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
