"use client";

import { Clock, Mic, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
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
import { clearAttendance, setAttendance } from "@/client/data/attendance";
import {
  deleteHomework,
  postponeHomework,
  rateHomework,
  undoEvaluation,
  undoPostpone,
} from "@/client/data/homework";
import { todayLessonId, useStudentToday } from "@/client/data/today";
import { localDateToUtcDate } from "@/domain/dates/local-date";
import { postponedLessonsOf, type HomeworkRecord } from "@/shared/schemas/homework";
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
      // A container, so the score grids go side by side only when the card is wide.
      className="@container flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="today-title" className="text-lg font-semibold">
          {t("today.title")}
        </h2>
        <span className="text-sm text-muted-foreground">
          {format.dateTime(localDateToUtcDate(date), "lessonDate")}
        </span>
      </header>

      {!canRun && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t("today.viewOnly")}
        </p>
      )}

      {/* A disabled fieldset makes everything inside view-only. */}
      <fieldset disabled={!canRun} className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <AttendanceToggle
            label={t("glossary.attendance")}
            value={attendance?.status ?? null}
            onChange={async (status) => {
              if (status === null) {
                if (lesson) await clearAttendance(store, lesson.id, student.id);
                return;
              }
              await setAttendance(store, await lessonId(), student.id, status);
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
              <h3 className="font-medium">{t("today.homework")}</h3>
              {items.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
                  <span className="text-sm text-muted-foreground">{t("evaluation.noPending")}</span>
                  <Button
                    variant="outline"
                    className="h-11"
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
            </section>

            <section className="flex flex-col gap-2 border-t pt-3">
              <h3 className="text-sm font-medium text-muted-foreground">{t("today.nextTitle")}</h3>
              {homework.nextHomework.map((item) => (
                <div key={item.id} className="flex items-center gap-1 rounded-lg bg-muted/50 ps-3">
                  <bdi className="min-w-0 flex-1 truncate">{label(item)}</bdi>
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
                variant="secondary"
                className="h-11"
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
      />
    </section>
  );
}

/** One homework item today: its portion, then the score grids, or "postponed". */
function HomeworkItem({
  item,
  label,
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
  evaluated: boolean;
  postponed: boolean;
  onEdit: () => void;
  onRate: (field: "memorizationRate" | "behaviorRate", score: number | null) => Promise<unknown>;
  onUndo: () => Promise<void>;
  onPostpone: () => Promise<void>;
  onUndoPostpone: () => Promise<void>;
}) {
  const t = useTranslations();
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-2.5">
      <div className="flex items-center gap-1">
        <bdi className="min-w-0 flex-1 truncate font-medium">{label}</bdi>
        {postponed && (
          <Badge className="bg-warning text-warning-foreground">
            <Clock aria-hidden />
            {t("today.postponed")}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label={t("evaluation.editRange")}
          onClick={onEdit}
        >
          <Pencil aria-hidden />
        </Button>
        {evaluated && (
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            aria-label={t("evaluation.undo")}
            onClick={() => void onUndo()}
          >
            <DirectionalIcon icon={Undo2} />
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
      ) : (
        <>
          <div className="grid gap-3 @lg:grid-cols-2">
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
            <Button variant="outline" className="h-11 self-start" onClick={() => void onPostpone()}>
              <Clock aria-hidden />
              {t("today.postpone")}
            </Button>
          )}
        </>
      )}
    </li>
  );
}
