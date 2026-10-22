import type { Access } from "@/shared/access";
import type { Actor } from "../actor";
import { getDb } from "../db";
import { accessOf, getMember, type MemberDoc } from "../members";
import {
  createTenantRepositories,
  type TenantRepositories,
} from "../repositories/tenant-repository";
import { getAuth } from "./auth";

export interface TenantContext {
  userId: string;
  tenantId: string;
  /** What this user may do (role, permissions, classes). */
  access: Access;
  /** Sent back on sync responses: a new value tells the device to resync. */
  accessVersion: number;
  /** The user as a sync actor. */
  actor: Actor;
  member: MemberDoc;
  /** Repositories already scoped to this tenant. */
  repos: TenantRepositories;
}

type Refusal = "UNAUTHORIZED" | "ACCOUNT_DISABLED" | "PASSWORD_CHANGE_REQUIRED";

/**
 * Resolves the session and the member, and returns the tenant context or why
 * there is none, plus any headers Better Auth wants to send back (e.g. a
 * renewed session cookie when the sliding session was extended).
 */
async function resolveSession(headers: Headers): Promise<{
  context: TenantContext | null;
  refusal: Refusal | null;
  responseHeaders: Headers;
}> {
  const { headers: responseHeaders, response: session } = await getAuth().api.getSession({
    headers,
    returnHeaders: true,
  });
  const tenantId = session?.user.tenantId;
  if (!session || typeof tenantId !== "string" || tenantId === "") {
    return { context: null, refusal: "UNAUTHORIZED", responseHeaders };
  }
  const member = await getMember(getDb(), session.user.id);
  if (!member || member.tenantId !== tenantId) {
    return { context: null, refusal: "UNAUTHORIZED", responseHeaders };
  }
  if (member.disabled) return { context: null, refusal: "ACCOUNT_DISABLED", responseHeaders };

  const access = accessOf(member);
  const context: TenantContext = {
    userId: session.user.id,
    tenantId,
    access,
    accessVersion: member.accessVersion,
    actor: { tenantId, userId: session.user.id, access },
    member,
    repos: createTenantRepositories(getDb(), tenantId),
  };
  const refusal = member.mustChangePassword ? "PASSWORD_CHANGE_REQUIRED" : null;
  return { context, refusal, responseHeaders };
}

/**
 * The signed-in user's tenant context, or null without a valid session or
 * when the account is disabled (a pending password change still counts).
 */
export async function getTenantContext(headers: Headers): Promise<TenantContext | null> {
  return (await resolveSession(headers)).context;
}

export const unauthorizedResponse = (error: Refusal = "UNAUTHORIZED") =>
  Response.json({ error }, { status: error === "PASSWORD_CHANGE_REQUIRED" ? 403 : 401 });

/**
 * Wraps a route handler so it only runs for an active member of a center.
 * Every API route that touches tenant data must use this.
 *
 * - No session, or no member: 401 UNAUTHORIZED.
 * - Disabled account: 401 ACCOUNT_DISABLED.
 * - Password set by an admin and not yet changed: 403 PASSWORD_CHANGE_REQUIRED,
 *   unless the route allows it (`allowPendingPasswordChange`, e.g. /api/me).
 *
 * A renewed session cookie is forwarded on the response, so a user who only
 * syncs keeps a live session.
 */
export function withTenant<TArgs extends unknown[]>(
  handler: (request: Request, context: TenantContext, ...rest: TArgs) => Promise<Response>,
  options: { allowPendingPasswordChange?: boolean } = {},
) {
  return async (request: Request, ...rest: TArgs): Promise<Response> => {
    const { context, refusal, responseHeaders } = await resolveSession(request.headers);
    if (!context) return unauthorizedResponse(refusal ?? "UNAUTHORIZED");
    if (refusal === "PASSWORD_CHANGE_REQUIRED" && !options.allowPendingPasswordChange) {
      return unauthorizedResponse(refusal);
    }
    const response = await handler(request, context, ...rest);
    for (const cookie of responseHeaders.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  };
}
