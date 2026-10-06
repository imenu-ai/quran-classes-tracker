"use client";

import { BookOpenCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePortionLabel } from "@/components/homework/use-portion-label";
import type { HomeworkRecord } from "@/shared/schemas/homework";

/** The student's pending homework (assigned, not evaluated yet). */
export function CurrentHomework({ pending }: { pending: readonly HomeworkRecord[] }) {
  const t = useTranslations("profile");
  const label = usePortionLabel();
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <BookOpenCheck aria-hidden className="size-5 text-primary" />
        {t("currentHomework")}
      </h2>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noCurrentHomework")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {pending.map((item) => (
            <li key={item.id} className="rounded-lg bg-accent px-3 py-1.5 text-accent-foreground">
              <bdi>{label(item)}</bdi>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
