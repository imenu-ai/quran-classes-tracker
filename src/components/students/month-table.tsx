"use client";

import { ChevronLeft, ChevronRight, Clock, Pencil } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DirectionalIcon } from "@/components/directional-icon";
import { usePortionLabel } from "@/components/homework/use-portion-label";
import { HomeworkFormDrawer } from "@/components/homework/homework-form-drawer";
import { ScorePicker } from "@/components/lessons/score-picker";
import { useLessonDate } from "@/components/lessons/use-lesson-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useApp } from "@/client/app-context";
import { setAttendance } from "@/client/data/attendance";
import { rateHomework, undoPostpone } from "@/client/data/homework";
import { buildMonthHistory, type HistoryRow, type StudentProfile } from "@/client/data/profile";
import { localDateToUtcDate, monthKey, todayInTimeZone } from "@/domain/dates/local-date";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "@/shared/schemas/attendance";
import type { StudentRecord } from "@/shared/schemas/student";
import { AttendanceToggle, ExcuseNoteInput } from "./attendance-controls";

const rowKey = (row: HistoryRow) =>
  row.kind === "absence" ? `a:${row.record.id}` : `${row.kind}:${row.item.id}:${row.lesson.id}`;

/** What the sheet edits, by id: it must stay open even if the row leaves the table. */
type EditTarget = { kind: HistoryRow["kind"]; id: string; lessonId: string };

/**
 * The live record behind an edit target, looked up in ALL of the student's
 * data (not just the month's rows). Turning an absence into "present"
 * removes it from the table, but the open sheet must keep showing it;
 * otherwise its content vanishes and the page stays blocked behind it.
 */
function resolveTarget(target: EditTarget | null, profile: StudentProfile): HistoryRow | null {
  if (!target) return null;
  const lesson = profile.lessonsById.get(target.lessonId);
  if (!lesson) return null;
  if (target.kind === "absence") {
    const record = profile.attendance.find((a) => a.id === target.id);
    return record ? { kind: "absence", lesson, record } : null;
  }
  const item = profile.homework.find((h) => h.id === target.id);
  return item ? { kind: target.kind, lesson, item } : null;
}

/**
 * The student's month as a simple table: one row per recorded day (a mark,
 * a postponement or an absence), the month's averages at the bottom, and a
 * switcher for earlier months. Tapping a row corrects it.
 */
export function MonthTable({
  profile,
  student,
}: {
  profile: StudentProfile;
  student: StudentRecord;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const { session } = useApp();
  const label = usePortionLabel();
  const currentMonth = monthKey(todayInTimeZone(session.timezone));
  // Months with data, plus this month even before anything is recorded; newest first.
  const months = useMemo(
    () =>
      [...new Set([currentMonth, ...profile.months.map((m) => m.month)])].sort((a, b) =>
        b.localeCompare(a),
      ),
    [currentMonth, profile.months],
  );
  const [month, setMonth] = useState(currentMonth);
  const [editing, setEditing] = useState<EditTarget | null>(null);

  const rows = useMemo(
    () => buildMonthHistory(profile.homework, profile.attendance, profile.lessonsById, month),
    [profile, month],
  );
  const stats = profile.months.find((m) => m.month === month);
  const index = months.indexOf(month);
  const older = months[index + 1];
  const newer = index > 0 ? months[index - 1] : undefined;

  const monthLabel = (key: string) => format.dateTime(new Date(`${key}-01T00:00:00Z`), "month");
  const day = (date: string) => format.dateTime(localDateToUtcDate(date), "dayShort");
  const average = (value: number | null | undefined) =>
    value === null || value === undefined ? t("common.noValue") : format.number(value, "average");
  const score = (value: number | null) => (value === null ? t("common.noValue") : String(value));

  return (
    <section aria-labelledby="month-title" className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          disabled={!older}
          aria-label={t("profile.olderMonth")}
          onClick={() => older && setMonth(older)}
        >
          <DirectionalIcon icon={ChevronLeft} className="size-5" />
        </Button>
        <h2 id="month-title" className="flex-1 text-center text-lg font-semibold">
          {monthLabel(month)}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          disabled={!newer}
          aria-label={t("profile.newerMonth")}
          onClick={() => newer && setMonth(newer)}
        >
          <DirectionalIcon icon={ChevronRight} className="size-5" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">
            {t("profile.tableCaption", { month: monthLabel(month) })}
          </caption>
          <colgroup>
            <col className="w-[4.5rem]" />
            <col />
            <col className="w-14" />
            <col className="w-14" />
          </colgroup>
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th scope="col" className="px-2 py-2 text-start font-medium">
                {t("profile.dateHeader")}
              </th>
              <th scope="col" className="px-2 py-2 text-start font-medium">
                {t("glossary.homework")}
              </th>
              <th scope="col" className="px-1 py-2 text-center font-medium">
                {t("profile.memorizationShort")}
              </th>
              <th scope="col" className="px-1 py-2 text-center font-medium">
                {t("profile.behaviorShort")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  {t("profile.noHistory")}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="cursor-pointer border-t align-top hover:bg-accent/40"
                onClick={() =>
                  setEditing({
                    kind: row.kind,
                    id: row.kind === "absence" ? row.record.id : row.item.id,
                    lessonId: row.lesson.id,
                  })
                }
              >
                <td className="px-2 py-2.5">
                  {/* The button makes the row reachable and editable by keyboard. */}
                  <button
                    type="button"
                    className="text-start font-medium tabular-nums focus-visible:underline focus-visible:outline-none"
                    aria-label={t("profile.editRow", { date: day(row.lesson.date) })}
                  >
                    {day(row.lesson.date)}
                  </button>
                </td>
                {row.kind === "absence" ? (
                  <td colSpan={3} className="px-2 py-2.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={row.record.status === "absent" ? "destructive" : "secondary"}
                        className={cn(
                          row.record.status === "excused" && "bg-warning text-warning-foreground",
                        )}
                      >
                        {t(`glossary.${row.record.status}`)}
                      </Badge>
                      {row.record.excuseNote && (
                        <span dir="auto" className="text-muted-foreground">
                          {row.record.excuseNote}
                        </span>
                      )}
                    </span>
                  </td>
                ) : (
                  <>
                    <td className="px-2 py-2.5">
                      <bdi className="break-words">{label(row.item)}</bdi>
                    </td>
                    {row.kind === "postponed" ? (
                      <td colSpan={2} className="px-1 py-2.5 text-center">
                        <Badge className="bg-warning text-warning-foreground">
                          <Clock aria-hidden />
                          {t("today.postponed")}
                        </Badge>
                      </td>
                    ) : (
                      <>
                        <td className="px-1 py-2.5 text-center font-semibold tabular-nums">
                          {score(row.item.memorizationRate)}
                        </td>
                        <td className="px-1 py-2.5 text-center font-semibold tabular-nums">
                          {score(row.item.behaviorRate)}
                        </td>
                      </>
                    )}
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/30">
            <tr>
              <th scope="row" colSpan={2} className="px-2 py-2.5 text-start font-semibold">
                {t("profile.average")}
              </th>
              <td className="px-1 py-2.5 text-center font-semibold tabular-nums">
                {average(stats?.memorizationAverage)}
              </td>
              <td className="px-1 py-2.5 text-center font-semibold tabular-nums">
                {average(stats?.behaviorAverage)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("profile.attendanceSummary", {
          present: stats?.present ?? 0,
          absent: stats?.absent ?? 0,
          excused: stats?.excused ?? 0,
        })}
      </p>

      <RowEditDrawer
        row={resolveTarget(editing, profile)}
        open={editing !== null}
        student={student}
        profile={profile}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}

/** Corrects one day: the scores of an evaluation, a postponement, or an absence. */
function RowEditDrawer({
  row,
  open,
  student,
  profile,
  onClose,
}: {
  row: HistoryRow | null;
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

  const title =
    row?.kind === "evaluation"
      ? t("profile.editEvaluationTitle")
      : row?.kind === "postponed"
        ? t("profile.editPostponedTitle")
        : t("profile.editAttendanceTitle");

  return (
    <>
      <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
        <DrawerContent>
          {row && (
            <div className="mx-auto flex w-full max-w-md flex-col pb-6">
              <DrawerHeader>
                <DrawerTitle>{title}</DrawerTitle>
                <DrawerDescription>{formatLessonDate(row.lesson.date)}</DrawerDescription>
              </DrawerHeader>

              <div className="flex flex-col gap-4 px-4">
                {row.kind === "absence" ? (
                  <>
                    <AttendanceToggle
                      label={t("glossary.attendance")}
                      value={row.record.status}
                      onChange={(status: AttendanceStatus | null) => {
                        if (status) void setAttendance(store, row.lesson.id, student.id, status);
                      }}
                    />
                    {row.record.status === "excused" && (
                      <ExcuseNoteInput
                        lessonId={row.lesson.id}
                        studentId={student.id}
                        saved={row.record.excuseNote}
                      />
                    )}
                  </>
                ) : (
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
                    {row.kind === "postponed" ? (
                      <Button
                        variant="outline"
                        className="h-11"
                        onClick={() =>
                          void undoPostpone(store, row.item, row.lesson.id).then(onClose)
                        }
                      >
                        <Clock aria-hidden />
                        {t("today.undoPostpone")}
                      </Button>
                    ) : (
                      <>
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
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
      {row && row.kind !== "absence" && (
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
