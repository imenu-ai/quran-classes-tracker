"use client";

import { useLiveQuery } from "dexie-react-hooks";
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
import {
  activeStudentsOf,
  archiveClass,
  archiveClassWithStudents,
  moveStudentsAndArchive,
  useActiveClasses,
} from "@/client/data/classes";
import type { ClassRecord } from "@/shared/schemas/class";

/**
 * Confirms archiving a class. If it still has active students, the teacher
 * chooses: move them to another class first, or archive them with it.
 */
export function ArchiveClassDialog({
  cls,
  open,
  onOpenChange,
  onArchived,
}: {
  cls: ClassRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived: () => void;
}) {
  const t = useTranslations();
  const { db, store } = useApp();
  const selectId = useId();
  const studentCount = useLiveQuery(
    async () => (await activeStudentsOf(db, cls.id)).length,
    [db, cls.id],
  );
  const otherClasses = (useActiveClasses() ?? []).filter((c) => c.id !== cls.id);
  const [targetId, setTargetId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTargetId("");
  }, [open]);

  /** `action` resolves to false when nothing was archived (the dialog stays open). */
  async function run(action: () => Promise<boolean | void>) {
    setBusy(true);
    try {
      if ((await action()) === false) return;
      toast.success(t("classes.archivedToast"));
      onOpenChange(false);
      onArchived();
    } finally {
      setBusy(false);
    }
  }

  const hasStudents = (studentCount ?? 0) > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(hasStudents ? "classes.archiveBlockedTitle" : "classes.archiveConfirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasStudents
              ? t("classes.archiveBlocked", { count: studentCount ?? 0 })
              : t("classes.archiveConfirm")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasStudents &&
          (otherClasses.length > 0 ? (
            <Field>
              <FieldLabel htmlFor={selectId}>{t("classes.moveStudentsTo")}</FieldLabel>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger id={selectId} className="h-12 w-full">
                  <SelectValue placeholder={t("students.moveTo")} />
                </SelectTrigger>
                <SelectContent>
                  {otherClasses.map((other) => (
                    <SelectItem key={other.id} value={other.id}>
                      <bdi>{other.name}</bdi>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">{t("classes.noOtherClass")}</p>
          ))}

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          {hasStudents ? (
            <>
              {otherClasses.length > 0 && (
                <Button
                  className="h-11"
                  disabled={!targetId || busy}
                  onClick={() => void run(() => moveStudentsAndArchive(store, cls.id, targetId))}
                >
                  {t("classes.moveAndArchive")}
                </Button>
              )}
              <Button
                variant="destructive"
                className="h-11"
                disabled={busy}
                onClick={() => void run(() => archiveClassWithStudents(store, cls.id))}
              >
                {t("classes.archiveAll")}
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              className="h-11"
              disabled={busy || studentCount === undefined}
              onClick={() =>
                void run(async () => {
                  // If a student was added meanwhile (e.g. synced from another
                  // device), nothing is archived and the dialog shows the choices.
                  const result = await archiveClass(store, cls.id);
                  return result.status === "archived";
                })
              }
            >
              {t("classes.archive")}
            </Button>
          )}
          <AlertDialogCancel className="h-11">{t("common.cancel")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
