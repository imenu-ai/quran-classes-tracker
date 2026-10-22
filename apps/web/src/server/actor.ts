import type { Access } from "@/shared/access";

/** A signed-in user acting on his center's data, with what he may do. */
export interface Actor {
  tenantId: string;
  userId: string;
  access: Access;
}

/**
 * Whose data a sync call works on. A bare tenant id is trusted server code
 * (the dev seed, tests) with full access; requests always pass an Actor.
 */
export type SyncScope = string | Actor;

export const tenantIdOf = (scope: SyncScope) =>
  typeof scope === "string" ? scope : scope.tenantId;

/** The acting user, or null for trusted server code. */
export const actorOf = (scope: SyncScope): Actor | null =>
  typeof scope === "string" ? null : scope;
