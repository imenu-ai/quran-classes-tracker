export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

/**
 * Delay before retry number `failures` (1 = first retry): exponential from
 * 2 s, capped at 5 min, with "equal jitter" (between half and the full delay)
 * so many devices coming back online don't retry in lockstep.
 */
export function backoffDelay(failures: number, random: () => number = Math.random): number {
  const exponent = Math.max(0, failures - 1);
  const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** exponent);
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}
