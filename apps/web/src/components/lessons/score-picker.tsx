"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  NOT_MEMORIZED,
  RATE_VALUES,
  type MemorizationChoice,
} from "@qct/core/shared/schemas/homework";

/**
 * A mark from 0 to 10 in halves in the phone's own picker: a native select,
 * which iPhone shows as a wheel. "—" means no mark (choosing it clears one);
 * 0 is a mark. The memorization picker can also offer "لم يحفظ" as its first
 * entry (`notMemorized`), and hide the marks (`marks={false}`) where only that
 * or nothing may be chosen.
 *
 * The chosen mark shows at once, before the local write and live query
 * catch up, and stays until `value` moves off what it was when chosen. A
 * failed write drops it again.
 */
export function ScorePicker({
  label,
  value,
  onChange,
  notMemorized = false,
  marks = true,
}: {
  label: string;
  value: MemorizationChoice;
  onChange: (score: MemorizationChoice) => Promise<unknown>;
  /** Offer "لم يحفظ" (memorization of due homework only). */
  notMemorized?: boolean;
  /** Offer the marks (false where only "لم يحفظ" or nothing may be chosen). */
  marks?: boolean;
}) {
  const t = useTranslations();
  const id = useId();
  const [chosen, setChosen] = useState<{ score: MemorizationChoice; from: MemorizationChoice }>();
  // The stored value moved (this write, or a sync): it wins from here on.
  if (chosen && chosen.from !== value) setChosen(undefined);
  const shown = chosen && chosen.from === value ? chosen.score : value;

  const choose = (score: MemorizationChoice) => {
    if (score === shown) return;
    const pick = { score, from: value };
    setChosen(pick);
    onChange(score).catch((error: unknown) => {
      setChosen((current) => (current === pick ? undefined : current));
      console.error(error);
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={shown === null ? "" : String(shown)}
        onChange={(event) => choose(parseChoice(event.target.value))}
        className={cn(
          "h-12 w-full rounded-lg border border-input bg-background px-3 text-center text-xl font-semibold tabular-nums shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
          typeof shown === "number" && "border-primary bg-primary/5 text-primary",
          shown === NOT_MEMORIZED && "border-warning bg-warning/15 text-lg",
        )}
      >
        <option value="">{t("common.noValue")}</option>
        {(notMemorized || shown === NOT_MEMORIZED) && (
          <option value={NOT_MEMORIZED}>{t("glossary.notMemorized")}</option>
        )}
        {(marks || typeof shown === "number") &&
          RATE_VALUES.map((score) => (
            <option key={score} value={String(score)}>
              {score}
            </option>
          ))}
      </select>
    </div>
  );
}

function parseChoice(value: string): MemorizationChoice {
  if (value === "") return null;
  if (value === NOT_MEMORIZED) return NOT_MEMORIZED;
  return Number(value);
}
