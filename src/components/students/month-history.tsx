"use client";

import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { HomeworkFormDrawer } from "@/components/homework/homework-form-drawer";
import { usePortionLabel } from "@/components/homework/use-portion-label";
import { ExcuseNoteInput } from "@/components/lessons/attendance-step";
import { ScorePicker } from "@/components/lessons/score-picker";
import { useLessonDate } from "@/components/lessons/use-lesson-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useApp } from "@/client/app-context";
import { setAttendance } from "@/client/data/attendance";
import { rateHomework } from "@/client/data/homework";
import { buildMonthHistory, type HistoryRow, type StudentProfile } from "@/client/data/profile";
import { localDateToUtcDate } from "@/domain/dates/local-date";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "@/shared/schemas/attendance";
import type { StudentRecord } from "@/shared/schemas/student";
import { useStatsFormat } from "./month-summaries";

type ListedRow = Exclude<HistoryRow, { kind: "postponed" }>;

const rowKey = (row: ListedRow) =>
  row.kind === "evaluation" ? `h:${row.item.id}` : `a:${row.record.id}`;

/** What the sheet edits, by id: it must stay open even if the row leaves the list. */
type EditTarget = { kind: ListedRow["kind"]; id: string; lessonId: string };

/**
 * The live record behind an edit target, looked up in ALL of the student's
 * data (not just the month's rows). Turning an absence into "present"
 * removes it from the history, but the open sheet must keep showing it;
 * otherwise its content vanishes and the page stays blocked behind it.
 */
function resolveTarget(target: EditTarget | null, profile: StudentProfile): ListedRow | null {
  if (!target) return null;
  const lesson = profile.lessonsById.get(target.lessonId);
  if (!lesson) return null;
  if (target.kind === "evaluation") {
    const item = profile.homework.find((h) => h.id === target.id);
    return item ? { kind: "evaluation", lesson, item } : null;
  }
  const record = profile.attendance.find((a) => a.id === target.id);
  return record ? { kind: "absence", lesson, record } : null;
}

/** The selected month's record; tapping a row edits it in a bottom sheet. */
export function MonthHistory({
  profile,
  month,
  student,
}: {
  profile: StudentProfile;
  month: string;
  student: StudentRecord;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const fmt = useStatsFormat();
  const label = usePortionLabel();
  const [editing, setEditing] = useState<EditTarget | null>(null);

  const rows = useMemo(
    () =>
      buildMonthHistory(profile.homework, profile.attendance, profile.lessonsById, month).filter(
        (row): row is ListedRow => row.kind !== "postponed",
      ),
    [profile, month],
  );

  const dateParts = (date: string) => {
    const value = localDateToUtcDate(date);
    return {
      weekday: format.dateTime(value, "weekday"),
      date: format.dateTime(value, "lessonDateShort"),
    };
  };
  const score = (value: number | null) => (value === null ? t("common.noValue") : String(value));

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">
        {t("profile.historyTitle", { month: fmt.month(month) })}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("profile.noHistory")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {rows.map((row) => {
            const { weekday, date } = dateParts(row.lesson.date);
            return (
              <li key={rowKey(row)}>
                <button
                  type="button"
                  onClick={() =>
                    setEditing(
                      row.kind === "evaluation"
                        ? { kind: "evaluation", id: row.item.id, lessonId: row.lesson.id }
                        : { kind: "absence", id: row.record.id, lessonId: row.lesson.id },
                    )
                  }
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                >
                  <span className="flex w-20 shrink-0 flex-col text-sm">
                    <span className="font-medium">{weekday}</span>
                    <span className="text-muted-foreground tabular-nums">{date}</span>
                  </span>
                  {row.kind === "evaluation" ? (
                    // Sura on the first line, scores below: both stay readable at 360 px.
                    <span className="flex min-w-0 flex-1 flex-col">
                      <bdi className="truncate font-medium">{label(row.item)}</bdi>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {t("profile.scores", {
                          memorization: score(row.item.memorizationRate),
                          behavior: score(row.item.behaviorRate),
                        })}
                      </span>
                    </span>
                  ) : (
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <Badge
                        variant={row.record.status === "absent" ? "destructive" : "secondary"}
                        className={
                          row.record.status === "excused"
                            ? "bg-warning text-warning-foreground"
                            : undefined
                        }
                      >
                        {t(`glossary.${row.record.status}`)}
                      </Badge>
                      {row.record.excuseNote && (
                        <span dir="auto" className="truncate text-sm text-muted-foreground">
                          {row.record.excuseNote}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <HistoryEditDrawer
        row={resolveTarget(editing, profile)}
        open={editing !== null}
        student={student}
        profile={profile}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}

/** Edits one history row: scores of an evaluation, or an absence. */
function HistoryEditDrawer({
  row,
  open,
  student,
  profile,
  onClose,
}: {
  row: ListedRow | null;
  open: boolean;
  student: StudentRecord;
  profile: StudentProfile;
  onClose: () => void;
}) {
  const t = useTranslations();
  const { store } = useApp();
  const label = usePortionLabel();
  const formatLessonDate = useLessonDate();
  const [editingRange, setEditingRange] = useState(false);

  return (
    <>
      <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
        <DrawerContent>
          {row && (
            <div className="mx-auto flex w-full max-w-md flex-col">
              <DrawerHeader>
                <DrawerTitle>
                  {t(
                    row.kind === "evaluation"
                      ? "profile.editEvaluationTitle"
                      : "profile.editAttendanceTitle",
                  )}
                </DrawerTitle>
                <DrawerDescription>{formatLessonDate(row.lesson.date)}</DrawerDescription>
              </DrawerHeader>

              <div className="flex flex-col gap-4 px-4">
                {row.kind === "evaluation" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <bdi className="min-w-0 flex-1 truncate text-lg font-semibold">
                        {label(row.item)}
                      </bdi>
                      <Button
                        variant="outline"
                        className="h-10"
                        onClick={() => setEditingRange(true)}
                      >
                        <Pencil aria-hidden />
                        {t("evaluation.editRange")}
                      </Button>
                    </div>
                    <ScorePicker
                      label={t("glossary.memorizationRate")}
                      value={row.item.memorizationRate}
                      onChange={(value) =>
                        rateHomework(store, row.item, row.lesson.id, "memorizationRate", value)
                      }
                    />
                    <ScorePicker
                      label={t("glossary.behaviorRate")}
                      value={row.item.behaviorRate}
                      onChange={(value) =>
                        rateHomework(store, row.item, row.lesson.id, "behaviorRate", value)
                      }
                    />
                  </>
                ) : (
                  <>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      className="w-full"
                      aria-label={t("glossary.attendance")}
                      value={row.record.status}
                      onValueChange={(value) => {
                        if (value) {
                          void setAttendance(
                            store,
                            row.lesson.id,
                            student.id,
                            value as AttendanceStatus,
                          );
                        }
                      }}
                    >
                      {ATTENDANCE_STATUSES.map((status) => (
                        <ToggleGroupItem key={status} value={status} className="h-11 flex-1">
                          {t(`glossary.${status}`)}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    {row.record.status === "excused" && (
                      <ExcuseNoteInput
                        lessonId={row.lesson.id}
                        studentId={student.id}
                        saved={row.record.excuseNote}
                      />
                    )}
                  </>
                )}
              </div>

              <DrawerFooter className="flex-row">
                <Button asChild variant="outline" size="lg" className="h-12 flex-1">
                  <Link href={`/lesson?id=${row.lesson.id}&step=evaluate`}>
                    <ExternalLink aria-hidden />
                    {t("profile.openLesson")}
                  </Link>
                </Button>
                <Button size="lg" className="h-12 flex-1" onClick={onClose}>
                  {t("common.close")}
                </Button>
              </DrawerFooter>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {row?.kind === "evaluation" && (
        <HomeworkFormDrawer
          open={editingRange}
          onOpenChange={setEditingRange}
          mode={{ kind: "edit", item: row.item }}
          student={student}
          history={profile.homework}
          lessonId={row.lesson.id}
        />
      )}
    </>
  );
}
