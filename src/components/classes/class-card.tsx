"use client";

import { CalendarCheck, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DirectionalIcon } from "@/components/directional-icon";
import { Badge } from "@/components/ui/badge";
import type { ClassSummary } from "@/client/data/classes";

export function ClassCard({ summary }: { summary: ClassSummary }) {
  const t = useTranslations("classes");
  const { record, studentCount, hasLessonToday } = summary;

  return (
    <Link
      href={`/class?id=${record.id}`}
      className="group flex min-h-24 items-center gap-3 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span dir="auto" className="truncate text-lg font-semibold">
          {record.name}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {t("studentCount", { count: studentCount })}
          {hasLessonToday && (
            <Badge className="bg-success text-success-foreground">
              <CalendarCheck aria-hidden />
              {t("lessonToday")}
            </Badge>
          )}
        </span>
      </div>
      <DirectionalIcon
        icon={ChevronRight}
        className="size-5 shrink-0 text-muted-foreground group-hover:text-foreground"
      />
    </Link>
  );
}
