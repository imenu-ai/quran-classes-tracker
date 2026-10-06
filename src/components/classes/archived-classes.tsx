"use client";

import { ArchiveRestore, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/client/app-context";
import { unarchiveClass } from "@/client/data/classes";
import { cn } from "@/lib/utils";
import type { ClassRecord } from "@/shared/schemas/class";

/** Collapsed list of archived classes with a restore button each. */
export function ArchivedClasses({ classes }: { classes: readonly ClassRecord[] }) {
  const t = useTranslations();
  const { store } = useApp();
  const [open, setOpen] = useState(false);
  const listId = useId();

  if (classes.length === 0) return null;

  async function restore(id: string) {
    await unarchiveClass(store, id);
    toast.success(t("classes.unarchivedToast"));
  }

  return (
    <section className="flex flex-col gap-2">
      <Button
        variant="ghost"
        className="h-11 justify-between px-2 text-muted-foreground"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          {t("classes.archivedTitle")} ({classes.length})
        </span>
        <ChevronDown aria-hidden className={cn("transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <ul id={listId} className="flex flex-col divide-y rounded-xl border">
          {classes.map((cls) => (
            <li key={cls.id} className="flex items-center gap-2 p-2 ps-4">
              <Link
                href={`/class?id=${cls.id}`}
                dir="auto"
                className="min-w-0 flex-1 truncate py-2 text-muted-foreground hover:text-foreground"
              >
                {cls.name}
              </Link>
              <Button variant="outline" className="h-10" onClick={() => void restore(cls.id)}>
                <ArchiveRestore aria-hidden />
                {t("classes.unarchive")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
