"use client";

import { ArchiveRestore, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { DirectionalIcon } from "@/components/directional-icon";
import { Button } from "@/components/ui/button";
import { useApp } from "@/client/app-context";
import { unarchiveStudent } from "@/client/data/students";
import { ageFromBirthYear, todayInTimeZone } from "@/domain/dates/local-date";
import { cn } from "@/lib/utils";
import type { StudentRecord } from "@/shared/schemas/student";

export function StudentList({ students }: { students: readonly StudentRecord[] }) {
  const t = useTranslations("students");
  const { session } = useApp();
  const today = todayInTimeZone(session.timezone);

  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {students.map((student) => (
        <li key={student.id}>
          <Link
            href={`/student?id=${student.id}`}
            className="group flex min-h-16 items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span dir="auto" className="truncate font-semibold">
                {student.fullName}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("age", { age: ageFromBirthYear(student.birthYear, today) })}
              </span>
            </div>
            <DirectionalIcon
              icon={ChevronRight}
              className="size-5 shrink-0 text-muted-foreground group-hover:text-foreground"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Collapsed list of a class's archived students with restore buttons. */
export function ArchivedStudents({ students }: { students: readonly StudentRecord[] }) {
  const t = useTranslations("students");
  const { store } = useApp();
  const [open, setOpen] = useState(false);
  const listId = useId();

  if (students.length === 0) return null;

  async function restore(id: string) {
    await unarchiveStudent(store, id);
    toast.success(t("unarchivedToast"));
  }

  return (
    <section className="flex flex-col gap-2">
      <Button
        variant="ghost"
        className="h-11 justify-between px-2 text-muted-foreground"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          {t("archivedTitle")} ({students.length})
        </span>
        <ChevronDown aria-hidden className={cn("transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <ul id={listId} className="flex flex-col divide-y rounded-xl border">
          {students.map((student) => (
            <li key={student.id} className="flex items-center gap-2 p-2 ps-4">
              <Link
                href={`/student?id=${student.id}`}
                dir="auto"
                className="min-w-0 flex-1 truncate py-2 text-muted-foreground hover:text-foreground"
              >
                {student.fullName}
              </Link>
              <Button variant="outline" className="h-10" onClick={() => void restore(student.id)}>
                <ArchiveRestore aria-hidden />
                {t("unarchive")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
