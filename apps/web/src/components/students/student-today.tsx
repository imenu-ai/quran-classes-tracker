"use client";

import { ChevronDown, ClipboardCheck, Clock, Mic, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { DirectionalIcon } from "@/components/directional-icon";
import { usePortionLabel } from "@/components/homework/use-portion-label";
import {
  HomeworkFormDrawer,
  type HomeworkFormMode,
} from "@/components/homework/homework-form-drawer";
import { ScorePicker } from "@/components/lessons/score-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/client/access";
import { useApp } from "@/client/app-context";
import { clearAttendance } from "@/client/data/attendance";
import {
  deleteHomework,
  postponeHomework,
  rateHomework,
  setStudentAttendance,
  undoEvaluation,
  undoPostpone,
} from "@/client/data/homework";
import { todayLessonId, useStudentToday } from "@/client/data/today";
import { localDateToUtcDate } from "@/domain/dates/local-date";
import { isExam, postponedLessonsOf, type HomeworkRecord } from "@/shared/schemas/homework";
import { cn } from "@/lib/utils";
import type { StudentRecord } from "@/shared/schemas/student";
import { AttendanceToggle, ExcuseNoteInput } from "./attendance-controls";

/**
 * Today, for one student: attendance, his homework with the two score grids
 * (or postpone the recitation), and homework for the next day. Today's
 * lesson is created behind the scenes on the first thing recorded.
 */
export function StudentToday({ student }: { student: StudentRecord }) {
  const t = useTranslations();
  const format = useFormatter();
  const { store } = useApp();
  const canRun = useAccess().can("lessons.run");
  const label = usePortionLabel();
  const today = useStudentToday(student);
  const [form, setForm] = useState<HomeworkFormMode | null>(null);
  // Items start closed; this holds the ones the teacher opened, by id.
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!today) return null;

  const { date, lesson, attendance, homework, history } = today;
  /** Today's lesson id, creating the lesson on the first write. */
  const lessonId = () => todayLessonId(store, student.classId, date);
  const absent = attendance !== null && attendance.status !== "present";
  const items = [...homework.evaluatedHere, ...homework.toRecite];
  const postponedToday = (item: HomeworkRecord) =>
    lesson !== null && postponedLessonsOf(item).includes(lesson.id);

  return (
    <section
      aria-labelledby="today-title"
      className="flex flex-col gap-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="today-title" className="text-2xl font-bold">
          {t("today.title")}
        </h2>
        <span className="text-base text-muted-foreground">
          {format.dateTime(localDateToUtcDate(date), "lessonDate")}
        </span>
      </header>

      {!canRun && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t("today.viewOnly")}
        </p>
      )}

      {/* A disabled fieldset makes everything inside view-only. */}
      <fieldset disabled={!canRun} className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <AttendanceToggle
            label={t("glossary.attendance")}
            value={attendance?.status ?? null}
            onChange={async (status) => {
              if (status === null) {
                if (lesson) await clearAttendance(store, lesson.id, student.id);
                return;
              }
              await setStudentAttendance(store, await lessonId(), student.id, status);
            }}
          />
          {attendance?.status === "excused" && lesson && (
            <ExcuseNoteInput
              lessonId={lesson.id}
              studentId={student.id}
              saved={attendance.excuseNote}
            />
          )}
        </div>

        {absent ? (
          <p className="rounded-lg bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
            {t("today.absentNote")}
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <h3 className="text-lg font-semibold">{t("today.homework")}</h3>
              {items.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-4">
                  <span className="text-muted-foreground">{t("evaluation.noPending")}</span>
                  <Button
                    variant="outline"
                    className="h-12 text-base"
                    onClick={() => setForm({ kind: "recite" })}
                  >
                    <Mic aria-hidden />
                    {t("evaluation.reciteNow")}
                  </Button>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {items.map((item) => (
                    <HomeworkItem
                      key={item.id}
                      item={item}
                      label={label(item)}
                      open={openIds.has(item.id)}
                      onToggle={() => toggle(item.id)}
                      exam={isExam(item)}
                      evaluated={lesson !== null && item.evaluatedLessonId === lesson.id}
                      postponed={postponedToday(item)}
                      onEdit={() => setForm({ kind: "edit", item })}
                      onRate={async (field, score) =>
                        rateHomework(store, item, await lessonId(), field, score)
                      }
                      onUndo={async () => {
                        if (lesson) await undoEvaluation(store, item, lesson.id);
                      }}
                      onPostpone={async () => {
                        await postponeHomework(store, item, await lessonId());
                        toast.success(t("today.postponedToast"));
                      }}
                      onUndoPostpone={async () => {
                        if (lesson) await undoPostpone(store, item, lesson.id);
                      }}
                    />
                  ))}
                </ul>
              )}
              <Button
                variant="outline"
                className="h-12 self-start border-exam/50 text-base text-exam hover:bg-exam/10 hover:text-exam"
                onClick={() => setForm({ kind: "exam" })}
              >
                <ClipboardCheck aria-hidden />
                {t("exam.add")}
              </Button>
            </section>

            <section className="mt-3 flex flex-col gap-3 rounded-xl border-2 border-dashed bg-muted/20 p-4">
              <h3 className="text-lg font-semibold">{t("today.nextTitle")}</h3>
              {homework.nextHomework.map((item) => (
                <div
                  key={item.id}
                  className="flex min-h-12 items-center gap-1 rounded-lg bg-background ps-3"
                >
                  <bdi className="min-w-0 flex-1 truncate text-base font-medium">{label(item)}</bdi>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10"
                    aria-label={t("homework.editTitle")}
                    onClick={() => setForm({ kind: "edit", item })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 text-destructive"
                    aria-label={t("evaluation.deleteHomework")}
                    onClick={() =>
                      void deleteHomework(store, item.id).then(() =>
                        toast.success(t("homework.deleted")),
                      )
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                className="h-14 border-primary/40 text-base text-primary"
                onClick={() => setForm({ kind: "next" })}
              >
                <Plus aria-hidden />
                {t("today.addNext")}
              </Button>
            </section>
          </>
        )}
      </fieldset>

      <HomeworkFormDrawer
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
        mode={form ?? { kind: "next" }}
        student={student}
        history={history}
        lessonId={lessonId}
        // An item recited on the spot opens: it was added to be marked.
        onCreated={(item) => {
          if (item.evaluatedLessonId !== null) {
            setOpenIds((current) => new Set(current).add(item.id));
          }
        }}
      />
    </section>
  );
}

/**
 * One due homework item today, as a collapsible section. Closed, it's one
 * line: the portion, then its marks ("9 · 10") or "مؤجل". Open, the pickers,
 * postpone and the portion's edit and undo buttons.
 */
export function HomeworkItem({
  item,
  label,
  open,
  onToggle,
  exam = false,
  evaluated,
  postponed,
  onEdit,
  onRate,
  onUndo,
  onPostpone,
  onUndoPostpone,
}: {
  item: HomeworkRecord;
  label: string;
  open: boolean;
  onToggle: () => void;
  /** An exam: its own colour and badge, one mark, never postponed. */
  exam?: boolean;
  evaluated: boolean;
  postponed: boolean;
  onEdit: () => void;
  onRate: (field: "memorizationRate" | "behaviorRate", score: number | null) => Promise<unknown>;
  onUndo: () => Promise<void>;
  onPostpone: () => Promise<void>;
  onUndoPostpone: () => Promise<void>;
}) {
  const t = useTranslations();
  const panelId = useId();
  const mark = (value: number | null) => (value === null ? t("common.noValue") : String(value));

  return (
    <li className={cn("rounded-xl border bg-background", exam && "border-exam/40 bg-exam/5")}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-16 w-full items-center gap-3 rounded-xl px-4 py-3 text-start hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <bdi className="min-w-0 flex-1 truncate text-lg font-semibold">{label}</bdi>
        {exam && <Badge className="bg-exam text-exam-foreground">{t("exam.badge")}</Badge>}
        {exam ? (
          item.memorizationRate !== null && (
            <span className="text-lg font-bold text-exam tabular-nums">
              {item.memorizationRate}
            </span>
          )
        ) : postponed ? (
          <Badge className="bg-warning text-warning-foreground">
            <Clock aria-hidden />
            {t("today.postponed")}
          </Badge>
        ) : (
          evaluated && (
            <span className="text-lg font-bold text-primary tabular-nums">
              {t("today.marks", {
                memorization: mark(item.memorizationRate),
                behavior: mark(item.behaviorRate),
              })}
            </span>
          )
        )}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-6 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div id={panelId} className="flex flex-col gap-4 border-t p-4">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" className="h-10" onClick={onEdit}>
              <Pencil aria-hidden />
              {t("evaluation.editRange")}
            </Button>
            {evaluated && (
              <Button variant="ghost" className="h-10" onClick={() => void onUndo()}>
                <DirectionalIcon icon={Undo2} />
                {t("evaluation.undo")}
              </Button>
            )}
          </div>

          {postponed ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
              <span className="text-sm text-muted-foreground">{t("today.postponedHint")}</span>
              <Button variant="outline" className="h-11" onClick={() => void onUndoPostpone()}>
                <DirectionalIcon icon={Undo2} />
                {t("today.undoPostpone")}
              </Button>
            </div>
          ) : exam ? (
            <div className="grid grid-cols-2 gap-3">
              <ScorePicker
                label={t("exam.mark")}
                value={item.memorizationRate}
                onChange={(score) => onRate("memorizationRate", score)}
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ScorePicker
                  label={t("glossary.memorizationRate")}
                  value={item.memorizationRate}
                  onChange={(score) => onRate("memorizationRate", score)}
                />
                <ScorePicker
                  label={t("glossary.behaviorRate")}
                  value={item.behaviorRate}
                  onChange={(score) => onRate("behaviorRate", score)}
                />
              </div>
              {!evaluated && (
                <Button
                  variant="outline"
                  className="h-11 self-start"
                  onClick={() => void onPostpone()}
                >
                  <Clock aria-hidden />
                  {t("today.postpone")}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
