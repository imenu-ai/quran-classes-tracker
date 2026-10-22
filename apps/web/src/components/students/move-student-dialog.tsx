"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/client/app-context";
import { useActiveClasses } from "@/client/data/classes";
import { moveStudent } from "@/client/data/students";
import type { StudentRecord } from "@/shared/schemas/student";

/** Moves a student to another active class; their history goes with them. */
export function MoveStudentDialog({
  student,
  open,
  onOpenChange,
}: {
  student: StudentRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const { store } = useApp();
  const selectId = useId();
  const options = (useActiveClasses() ?? []).filter((c) => c.id !== student.classId);
  const [targetId, setTargetId] = useState("");

  useEffect(() => {
    if (open) setTargetId("");
  }, [open]);

  async function move() {
    await moveStudent(store, student.id, targetId);
    toast.success(t("students.moved"));
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("students.moveTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            <bdi>{student.fullName}</bdi>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {options.length > 0 ? (
          <Field>
            <FieldLabel htmlFor={selectId}>{t("students.moveTo")}</FieldLabel>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger id={selectId} className="h-12 w-full">
                <SelectValue placeholder={t("students.moveTo")} />
              </SelectTrigger>
              <SelectContent>
                {options.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    <bdi>{cls.name}</bdi>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <p className="text-sm text-muted-foreground">{t("classes.noOtherClass")}</p>
        )}
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="h-11" disabled={!targetId} onClick={() => void move()}>
            {t("students.move")}
          </Button>
          <AlertDialogCancel className="h-11">{t("common.cancel")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
