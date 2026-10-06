/**
 * Last-write-wins rules, shared by the server (push) and the client (pull).
 * A soft delete is just a write that sets `deletedAt`, so deletes and edits
 * follow the same rule: the later `updatedAt` wins.
 */
export interface Versioned {
  updatedAt: number;
  updatedBy: string;
}

/**
 * True if `candidate` should replace `current`: a later `updatedAt` wins; on
 * an exact tie the higher device id wins, so every node picks the same record.
 * Identical (same time, same device) is not newer, which makes retries no-ops.
 */
export function isNewer(candidate: Versioned, current: Versioned): boolean {
  if (candidate.updatedAt !== current.updatedAt) return candidate.updatedAt > current.updatedAt;
  return candidate.updatedBy > current.updatedBy;
}

/**
 * Should a record pulled from the server replace the local copy?
 * With no pending local change the server copy is authoritative. With a
 * pending change, the server copy only wins if it is newer, otherwise the
 * local edit stays and will be pushed.
 */
export function shouldApplyIncoming(
  local: Versioned | undefined,
  incoming: Versioned,
  hasPendingChange: boolean,
): boolean {
  if (!local || !hasPendingChange) return true;
  return isNewer(incoming, local);
}

/** How far into the future a device clock may be before the server clamps it. */
export const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;

/**
 * Caps a client timestamp at server time + allowed skew, so a device with a
 * clock set far ahead can't make its writes win forever.
 */
export function clampUpdatedAt(updatedAt: number, serverNow: number): number {
  return Math.min(updatedAt, serverNow + MAX_CLOCK_SKEW_MS);
}
