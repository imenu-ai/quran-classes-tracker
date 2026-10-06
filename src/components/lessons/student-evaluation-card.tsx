"use client";

import { CheckCircle2, Mic, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { DirectionalIcon } from "@/components/directional-icon";
import { usePortionLabel } from "@/components/homework/use-portion-label";
import {
  HomeworkFormDrawer,
  type HomeworkFormMode,
} from "@/components/homework/homework-form-drawer";
import { Button } from "@/components/ui/button";
import { useApp } from "@/client/app-context";
import {
  deleteHomework,
  rateHomework,
  undoEvaluation,
  type EvaluationEntry,
} from "@/client/data/homework";
import { cn } from "@/lib/utils";
import type { HomeworkRecord } from "@/shared/schemas/homework";
import { ScorePicker } from "./score-picker";

const isComplete = (item: HomeworkRecord) =>
  item.memorizationRate !== null && item.behaviorRate !== null;

/** One student in the evaluation step: recite, score, assign next homework. */
export function StudentEvaluationCard({
  entry,
  lessonId,
}: {
  entry: EvaluationEntry;
  lessonId: string;
}) {
  const t = useTranslations();
  const { store } = useApp();
  const label = usePortionLabel();
  const [form, setForm] = useState<HomeworkFormMode | null>(null);
  const { toRecite, evaluatedHere, nextHomework } = entry.homework;
  const items = [...evaluatedHere, ...toRecite];
  const done = evaluatedHere.length > 0 && evaluatedHere.every(isComplete);

  return (
    <article
      className={cn(
        // A container, so score grids go side by side only when the CARD is wide.
        "@container flex flex-col gap-3 rounded-xl border bg-card p-3",
        done && "border-success/50",
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 dir="auto" className="truncate text-lg font-semibold">
          {entry.student.fullName}
        </h3>
        {done && <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success" />}
      </header>

      {items.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
          <span className="text-sm text-muted-foreground">{t("evaluation.noPending")}</span>
          <Button variant="outline" className="h-11" onClick={() => setForm({ kind: "recite" })}>
            <Mic aria-hidden />
            {t("evaluation.reciteNow")}
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const evaluated = item.evaluatedLessonId === lessonId;
            return (
              <li key={item.id} className="flex flex-col gap-2 rounded-lg border p-2.5">
                <div className="flex items-center gap-1">
                  <bdi className="min-w-0 flex-1 truncate font-medium">{label(item)}</bdi>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10"
                    aria-label={t("evaluation.editRange")}
                    onClick={() => setForm({ kind: "edit", item })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  {evaluated && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      aria-label={t("evaluation.undo")}
                      onClick={() => void undoEvaluation(store, item, lessonId)}
                    >
                      <DirectionalIcon icon={Undo2} />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 @lg:grid-cols-2">
                  <ScorePicker
                    label={t("glossary.memorizationRate")}
                    value={item.memorizationRate}
                    onChange={(score) =>
                      rateHomework(store, item, lessonId, "memorizationRate", score)
                    }
                  />
                  <ScorePicker
                    label={t("glossary.behaviorRate")}
                    value={item.behaviorRate}
                    onChange={(score) => rateHomework(store, item, lessonId, "behaviorRate", score)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="flex flex-col gap-2 border-t pt-3">
        <h4 className="text-sm font-medium text-muted-foreground">
          {t("evaluation.nextHomework")}
        </h4>
        {nextHomework.map((item) => (
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
                void deleteHomework(store, item.id).then(() => toast.success(t("homework.deleted")))
              }
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <Button variant="secondary" className="h-11" onClick={() => setForm({ kind: "next" })}>
          <Plus aria-hidden />
          {t("evaluation.addNext")}
        </Button>
      </section>

      <HomeworkFormDrawer
        open={form !== null}
        onOpenChange={(open) => !open && setForm(null)}
        mode={form ?? { kind: "next" }}
        student={entry.student}
        history={entry.history}
        lessonId={lessonId}
      />
    </article>
  );
}
