"use client";

import { CalendarDays, EllipsisVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/client/app-context";
import { changeLessonDate, deleteLesson } from "@/client/data/lessons";
import type { LessonRecord } from "@/shared/schemas/lesson";
import { LessonDateDialog } from "./lesson-date-dialog";

/** Lesson options: change the date, or delete the lesson (after confirming). */
export function LessonActionsMenu({ lesson }: { lesson: LessonRecord }) {
  const t = useTranslations();
  const router = useRouter();
  const { store } = useApp();
  const [changingDate, setChangingDate] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    await deleteLesson(store, lesson.id);
    toast.success(t("lessons.deleted"));
    router.push(`/class?id=${lesson.classId}`);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11" aria-label={t("lessons.actions")}>
            <EllipsisVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem className="min-h-11" onSelect={() => setChangingDate(true)}>
            <CalendarDays aria-hidden />
            {t("lessons.changeDate")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11"
            variant="destructive"
            onSelect={() => setDeleting(true)}
          >
            <Trash2 aria-hidden />
            {t("lessons.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LessonDateDialog
        open={changingDate}
        onOpenChange={setChangingDate}
        title={t("lessons.changeDateTitle")}
        submitLabel={t("lessons.changeDate")}
        initialDate={lesson.date}
        onSubmit={async (date) => {
          const result = await changeLessonDate(store, lesson.id, date);
          if (result.status === "taken") return "dateTaken";
          toast.success(t("lessons.dateChanged"));
          return null;
        }}
      />

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("lessons.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("lessons.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction variant="destructive" className="h-11" onClick={() => void remove()}>
              {t("lessons.delete")}
            </AlertDialogAction>
            <AlertDialogCancel className="h-11">{t("common.cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
