"use client";

import { ArrowRight, CheckCheck, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { DirectionalIcon } from "@/components/directional-icon";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useApp } from "@/client/app-context";
import {
  clearAttendance,
  markAllPresent,
  setAttendance,
  setExcuseNote,
  summarizeAttendance,
  useLessonRoster,
} from "@/client/data/attendance";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_STATUSES,
  EXCUSE_NOTE_MAX,
  type AttendanceStatus,
} from "@/shared/schemas/attendance";
import type { LessonRecord } from "@/shared/schemas/lesson";

const SELECTED: Record<AttendanceStatus, string> = {
  present:
    "data-[state=on]:border-success data-[state=on]:bg-success data-[state=on]:text-success-foreground",
  absent:
    "data-[state=on]:border-destructive data-[state=on]:bg-destructive data-[state=on]:text-white",
  excused:
    "data-[state=on]:border-warning data-[state=on]:bg-warning data-[state=on]:text-warning-foreground",
};

/** Autosaving excuse note (written ~0.6 s after typing stops, and on blur). */
export function ExcuseNoteInput({
  lessonId,
  studentId,
  saved,
}: {
  lessonId: string;
  studentId: string;
  saved: string;
}) {
  const t = useTranslations("attendance");
  const { store } = useApp();
  const [value, setValue] = useState(saved);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(saved), [saved]);

  const save = (note: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (note !== saved) void setExcuseNote(store, lessonId, studentId, note);
  };

  return (
    <Input
      dir="auto"
      className="h-11"
      maxLength={EXCUSE_NOTE_MAX}
      placeholder={t("excuseNotePlaceholder")}
      aria-label={t("excuseNotePlaceholder")}
      value={value}
      onChange={(event) => {
        const note = event.target.value;
        setValue(note);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => save(note), 600);
      }}
      onBlur={() => save(value)}
    />
  );
}

/** Step 1 of a lesson: fast three-state attendance for every student. */
export function AttendanceStep({ lesson, onNext }: { lesson: LessonRecord; onNext: () => void }) {
  const t = useTranslations();
  const { store } = useApp();
  const roster = useLessonRoster(lesson.id, lesson.classId);

  if (roster === undefined) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (roster.length === 0) {
    return <EmptyState icon={Users} title={t("attendance.noStudents")} />;
  }

  const summary = summarizeAttendance(
    roster.flatMap((entry) => (entry.attendance ? [entry.attendance] : [])),
  );
  const unmarked = roster.filter((entry) => !entry.attendance).map((entry) => entry.student.id);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("attendance.marked", { marked: summary.marked, total: roster.length })}
          {" · "}
          {t("lessons.attendanceSummary", { ...summary })}
        </p>
        <Button
          variant="outline"
          className="h-11"
          disabled={unmarked.length === 0}
          onClick={() => void markAllPresent(store, lesson.id, unmarked)}
        >
          <CheckCheck aria-hidden />
          {t("attendance.markAllPresent")}
        </Button>
      </div>

      <ul className="grid gap-2 md:grid-cols-2">
        {roster.map((entry) => {
          const status = entry.attendance?.status ?? "";
          return (
            <li
              key={entry.student.id}
              className={cn(
                "flex flex-col gap-2 rounded-xl border bg-card p-3",
                !status && "border-dashed",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span dir="auto" className="truncate font-semibold">
                  {entry.student.fullName}
                </span>
                {!status && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t("attendance.unmarked")}
                  </span>
                )}
              </div>
              <ToggleGroup
                type="single"
                variant="outline"
                className="w-full"
                aria-label={entry.student.fullName}
                value={status}
                onValueChange={(value) => {
                  // Tapping the selected status again clears it.
                  if (value)
                    void setAttendance(
                      store,
                      lesson.id,
                      entry.student.id,
                      value as AttendanceStatus,
                    );
                  else void clearAttendance(store, lesson.id, entry.student.id);
                }}
              >
                {ATTENDANCE_STATUSES.map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className={cn("h-11 flex-1 text-sm font-medium", SELECTED[option])}
                  >
                    {t(`glossary.${option}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {status === "excused" && (
                <ExcuseNoteInput
                  lessonId={lesson.id}
                  studentId={entry.student.id}
                  saved={entry.attendance?.excuseNote ?? ""}
                />
              )}
            </li>
          );
        })}
      </ul>

      <Button size="lg" className="h-12 self-end text-base" onClick={onNext}>
        {t("lessons.stepEvaluate")}
        <DirectionalIcon icon={ArrowRight} />
      </Button>
    </div>
  );
}
