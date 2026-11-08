"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { AyahRangeErrors, AyahRangeField } from "@qct/core/forms/ayah-range";
import { emptyPortionDraft, type PortionDraft } from "@qct/core/forms/portions";
import { PORTIONS_MAX } from "@qct/core/shared/schemas/homework";
import { cn } from "@/lib/utils";
import { AyahRangeFields } from "./ayah-range-fields";

/** A touched field of one sura in the list: `${draft.key}:${field}`. */
export const touchedKey = (draft: PortionDraft, field: AyahRangeField) => `${draft.key}:${field}`;

/** Every field of every sura, to show all errors after a save attempt. */
export const allTouched = (drafts: readonly PortionDraft[]) =>
  new Set(
    drafts.flatMap((draft) =>
      (["surah", "fromAyah", "toAyah"] as const).map((field) => touchedKey(draft, field)),
    ),
  );

/**
 * The suras of one homework: each with its sura picker and ayah range, or
 * "السورة كاملة"; "إضافة سورة" adds one, and each can be removed while
 * there are several. One mark covers them all.
 */
export function PortionsFields({
  value,
  onChange,
  errors,
  visibleErrors,
}: {
  value: readonly PortionDraft[];
  /** `touched` is the field that changed (touchedKey), if any. */
  onChange: (next: PortionDraft[], touched?: string) => void;
  errors: readonly AyahRangeErrors[];
  visibleErrors: ReadonlySet<string>;
}) {
  const t = useTranslations("homework");
  const several = value.length > 1;
  const replace = (index: number, draft: PortionDraft) =>
    value.map((current, i) => (i === index ? draft : current));

  return (
    <div className="flex flex-col gap-3">
      {value.map((draft, index) => (
        <div
          key={draft.key}
          className={cn("flex flex-col gap-3", several && "rounded-xl border bg-muted/20 p-3")}
        >
          <AyahRangeFields
            value={draft}
            ayahs={!draft.whole}
            errors={errors[index] ?? {}}
            visibleErrors={
              new Set(
                (["surah", "fromAyah", "toAyah"] as const).filter((field) =>
                  visibleErrors.has(touchedKey(draft, field)),
                ),
              )
            }
            onChange={(next, field) =>
              onChange(replace(index, { ...draft, ...next }), touchedKey(draft, field))
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={draft.whole}
                onChange={(event) =>
                  onChange(replace(index, { ...draft, whole: event.target.checked }))
                }
              />
              {t("wholeSurah")}
            </label>
            {several && (
              <Button
                type="button"
                variant="ghost"
                className="h-11 text-destructive"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden />
                {t("removeSurah")}
              </Button>
            )}
          </div>
        </div>
      ))}
      {value.length < PORTIONS_MAX && (
        <Button
          type="button"
          variant="outline"
          className="h-11 self-start"
          onClick={() => onChange([...value, emptyPortionDraft()])}
        >
          <Plus aria-hidden />
          {t("addSurah")}
        </Button>
      )}
    </div>
  );
}
