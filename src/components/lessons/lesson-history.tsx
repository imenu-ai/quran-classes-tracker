"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DirectionalIcon } from "@/components/directional-icon";
import { Button } from "@/components/ui/button";
import { useClassLessonSummaries } from "@/client/data/lessons";
import { useLessonDate } from "./use-lesson-date";

const PAGE = 8;

/** A class's lessons, newest first, so old lessons can be opened and edited. */
export function LessonHistory({ classId }: { classId: string }) {
  const t = useTranslations("lessons");
  const formatLessonDate = useLessonDate();
  const summaries = useClassLessonSummaries(classId);
  const [visible, setVisible] = useState(PAGE);

  if (!summaries) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold text-muted-foreground">{t("historyTitle")}</h2>
      {summaries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noLessons")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {summaries.slice(0, visible).map(({ lesson, present, absent, excused, evaluated }) => (
            <li key={lesson.id}>
              <Link
                href={`/lesson?id=${lesson.id}`}
                className="group flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-accent/40"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{formatLessonDate(lesson.date)}</span>
                  <span className="text-sm text-muted-foreground">
                    {t("attendanceSummary", { present, absent, excused })}
                    {" · "}
                    {t("evaluatedCount", { count: evaluated })}
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
      )}
      {summaries.length > visible && (
        <Button variant="ghost" className="h-11" onClick={() => setVisible((n) => n + PAGE)}>
          {t("showMore")}
        </Button>
      )}
    </section>
  );
}
