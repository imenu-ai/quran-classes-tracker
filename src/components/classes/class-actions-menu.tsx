"use client";

import { Archive, ArchiveRestore, EllipsisVertical, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { unarchiveClass } from "@/client/data/classes";
import type { ClassRecord } from "@/shared/schemas/class";
import { ArchiveClassDialog } from "./archive-class-dialog";
import { ClassFormDrawer } from "./class-form-drawer";

/** Rename / archive / restore a class. */
export function ClassActionsMenu({ cls }: { cls: ClassRecord }) {
  const t = useTranslations();
  const router = useRouter();
  const { store } = useApp();
  const [renaming, setRenaming] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const archived = cls.archivedAt !== null;

  async function restore() {
    await unarchiveClass(store, cls.id);
    toast.success(t("classes.unarchivedToast"));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11" aria-label={t("classes.actions")}>
            <EllipsisVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem className="min-h-11" onSelect={() => setRenaming(true)}>
            <Pencil aria-hidden />
            {t("classes.rename")}
          </DropdownMenuItem>
          {archived ? (
            <DropdownMenuItem className="min-h-11" onSelect={() => void restore()}>
              <ArchiveRestore aria-hidden />
              {t("classes.unarchive")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="min-h-11"
              variant="destructive"
              onSelect={() => setArchiving(true)}
            >
              <Archive aria-hidden />
              {t("classes.archive")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ClassFormDrawer open={renaming} onOpenChange={setRenaming} existing={cls} />
      <ArchiveClassDialog
        cls={cls}
        open={archiving}
        onOpenChange={setArchiving}
        onArchived={() => router.push("/")}
      />
    </>
  );
}
