"use client";

import { Archive, ArchiveRestore, ArrowLeftRight, EllipsisVertical, Pencil } from "lucide-react";
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
import { archiveStudent, unarchiveStudent } from "@/client/data/students";
import type { StudentRecord } from "@/shared/schemas/student";
import { MoveStudentDialog } from "./move-student-dialog";
import { StudentFormDrawer } from "./student-form-drawer";

/** Edit / move / archive / restore a student. */
export function StudentActionsMenu({ student }: { student: StudentRecord }) {
  const t = useTranslations();
  const { store } = useApp();
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const archived = student.archivedAt !== null;

  async function archive() {
    await archiveStudent(store, student.id);
    toast.success(t("students.archivedToast"));
  }

  async function restore() {
    await unarchiveStudent(store, student.id);
    toast.success(t("students.unarchivedToast"));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={t("students.actions")}
          >
            <EllipsisVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem className="min-h-11" onSelect={() => setEditing(true)}>
            <Pencil aria-hidden />
            {t("students.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" onSelect={() => setMoving(true)}>
            <ArrowLeftRight aria-hidden />
            {t("students.move")}
          </DropdownMenuItem>
          {archived ? (
            <DropdownMenuItem className="min-h-11" onSelect={() => void restore()}>
              <ArchiveRestore aria-hidden />
              {t("students.unarchive")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="min-h-11"
              variant="destructive"
              onSelect={() => setArchiving(true)}
            >
              <Archive aria-hidden />
              {t("students.archive")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <StudentFormDrawer
        open={editing}
        onOpenChange={setEditing}
        classId={student.classId}
        existing={student}
      />
      <MoveStudentDialog student={student} open={moving} onOpenChange={setMoving} />
      <AlertDialog open={archiving} onOpenChange={setArchiving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("students.archiveConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("students.archiveConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              variant="destructive"
              className="h-11"
              onClick={() => void archive()}
            >
              {t("students.archive")}
            </AlertDialogAction>
            <AlertDialogCancel className="h-11">{t("common.cancel")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
