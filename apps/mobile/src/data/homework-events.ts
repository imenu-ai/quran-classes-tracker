import type { HomeworkRecord } from "@qct/core/shared/schemas/homework";

type Listener = (item: HomeworkRecord) => void;

const listeners = new Set<Listener>();

/**
 * New homework saved by the homework form (a separate route), so the today
 * card can open an item recited on the spot: it was added to be marked. On
 * the web the form is a drawer inside the card and calls back directly.
 */
export function onHomeworkCreated(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitHomeworkCreated(item: HomeworkRecord): void {
  for (const listener of listeners) listener(item);
}
