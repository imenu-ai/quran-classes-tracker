"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { RATE_MAX, RATE_MIN } from "@/shared/schemas/homework";

const SCORES = Array.from({ length: RATE_MAX - RATE_MIN + 1 }, (_, i) => RATE_MIN + i);

/**
 * 1–10 as a 5×2 grid of large buttons: one tap sets the score (autosaved),
 * tapping the selected score again clears it.
 *
 * The tapped score shows at once, before the local write and live query
 * catch up (about a quarter second in WebKit), and stays until `value` moves
 * off what it was at the tap. A failed write drops it again.
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
  const labelId = useId();
  const [tapped, setTapped] = useState<{ score: number | null; from: number | null }>();
  // The stored value moved (this write, or a sync): it wins from here on.
  if (tapped && tapped.from !== value) setTapped(undefined);
  const shown = tapped && tapped.from === value ? tapped.score : value;

  const choose = (score: number | null) => {
    const tap = { score, from: value };
    setTapped(tap);
    onChange(score).catch((error: unknown) => {
      setTapped((current) => (current === tap ? undefined : current));
      console.error(error);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium text-muted-foreground">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="grid grid-cols-5 gap-1.5">
        {SCORES.map((score) => {
          const selected = score === shown;
          return (
            <button
              key={score}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(selected ? null : score)}
              className={cn(
                "h-11 rounded-lg border text-base font-semibold tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent",
              )}
            >
              {score}
            </button>
          );
        })}
      </div>
    </div>
  );
}
