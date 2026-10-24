import type { SyncState } from "./engine";

export type IndicatorTone = "ok" | "busy" | "muted" | "warning" | "danger";

export type IndicatorMessage =
  | { key: "connected" }
  | { key: "syncing" }
  | { key: "offline" }
  | { key: "error" }
  | { key: "needsLogin" }
  | { key: "pending"; count: number }
  | { key: "rejected"; count: number };

export interface Indicator {
  tone: IndicatorTone;
  /** Shown in order, joined with a separator. */
  messages: IndicatorMessage[];
}

/**
 * What the always-visible sync indicator says, from the engine state and the
 * local counts. Pending changes are always mentioned so the teacher knows
 * nothing is lost while offline.
 */
export function getIndicator(input: {
  state: SyncState;
  pending: number;
  rejected: number;
}): Indicator {
  const { state, pending, rejected } = input;
  const extras: IndicatorMessage[] = [];
  if (pending > 0) extras.push({ key: "pending", count: pending });
  if (rejected > 0) extras.push({ key: "rejected", count: rejected });

  switch (state) {
    case "needsLogin":
      return { tone: "danger", messages: [{ key: "needsLogin" }, ...extras] };
    case "offline":
      return { tone: "muted", messages: [{ key: "offline" }, ...extras] };
    case "syncing":
      return { tone: "busy", messages: [{ key: "syncing" }] };
    case "error":
      return { tone: "warning", messages: extras.length > 0 ? extras : [{ key: "error" }] };
    case "idle":
      if (rejected > 0) return { tone: "warning", messages: extras };
      if (pending > 0) return { tone: "busy", messages: extras };
      return { tone: "ok", messages: [{ key: "connected" }] };
  }
}
