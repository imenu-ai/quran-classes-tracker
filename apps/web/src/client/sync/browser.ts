/** Runs `task` under a lock shared by every tab, when the Web Locks API exists. */
export async function webSyncLock(task: () => Promise<void>): Promise<void> {
  const locks = globalThis.navigator?.locks;
  if (!locks) return task();
  await locks.request("qct-sync", task);
}

/** Whether the browser believes it's online. */
export const browserIsOnline = () => globalThis.navigator?.onLine !== false;
