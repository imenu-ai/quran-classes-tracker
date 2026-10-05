"use client";

import { CalendarDays, EllipsisVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/client/app-context";
import { changeLessonDate } from "@/client/data/lessons";
import type { LessonRecord } from "@/shared/schemas/lesson";
import { LessonDateDialog } from "./lesson-date-dialog";

/** Lesson options: change date (note and delete are added in step 4.7). */
export function LessonActionsMenu({ lesson }: { lesson: LessonRecord }) {
  const t = useTranslations("lessons");
  const { store } = useApp();
  const [changingDate, setChangingDate] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11" aria-label={t("actions")}>
            <EllipsisVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem className="min-h-11" onSelect={() => setChangingDate(true)}>
            <CalendarDays aria-hidden />
            {t("changeDate")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LessonDateDialog
        open={changingDate}
        onOpenChange={setChangingDate}
        title={t("changeDateTitle")}
        submitLabel={t("changeDate")}
        initialDate={lesson.date}
        onSubmit={async (date) => {
          const result = await changeLessonDate(store, lesson.id, date);
          if (result.status === "taken") return "dateTaken";
          toast.success(t("dateChanged"));
          return null;
        }}
      />
    </>
  );
}
