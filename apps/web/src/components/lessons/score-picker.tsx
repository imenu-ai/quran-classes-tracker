"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { RATE_VALUES } from "@qct/core/shared/schemas/homework";

/**
 * A mark from 0 to 10 in halves in the phone's own picker: a native select,
 * which iPhone shows as a wheel. "—" means no mark (choosing it clears one);
 * 0 is a mark.
 *
 * The chosen mark shows at once, before the local write and live query
 * catch up, and stays until `value` moves off what it was when chosen. A
 * failed write drops it again.
 */
export function ScorePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (score: number | null) => Promise<unknown>;
}) {
  const t = useTranslations("common");
  const id = useId();
  const [chosen, setChosen] = useState<{ score: number | null; from: number | null }>();
  // The stored value moved (this write, or a sync): it wins from here on.
  if (chosen && chosen.from !== value) setChosen(undefined);
  const shown = chosen && chosen.from === value ? chosen.score : value;

  const choose = (score: number | null) => {
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
        onChange={(event) => choose(event.target.value === "" ? null : Number(event.target.value))}
        className={cn(
          "h-12 w-full rounded-lg border border-input bg-background px-3 text-center text-xl font-semibold tabular-nums shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
          shown !== null && "border-primary bg-primary/5 text-primary",
        )}
      >
        <option value="">{t("noValue")}</option>
        {RATE_VALUES.map((score) => (
          <option key={score} value={String(score)}>
            {score}
          </option>
        ))}
      </select>
    </div>
  );
}
