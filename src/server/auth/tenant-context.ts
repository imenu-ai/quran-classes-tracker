import { getDb } from "../db";
import {
  createTenantRepositories,
  type TenantRepositories,
} from "../repositories/tenant-repository";
import { getAuth } from "./auth";

export interface TenantContext {
  userId: string;
  tenantId: string;
  /** Repositories already scoped to this tenant. */
  repos: TenantRepositories;
}

/**
 * Resolves the session and returns the tenant context (null without a valid
 * session) plus any headers Better Auth wants to send back, e.g. a renewed
 * session cookie when the sliding session was extended.
 */
async function resolveSession(
  headers: Headers,
): Promise<{ context: TenantContext | null; responseHeaders: Headers }> {
  const { headers: responseHeaders, response: session } = await getAuth().api.getSession({
    headers,
    returnHeaders: true,
  });
  const tenantId = session?.user.tenantId;
  if (!session || typeof tenantId !== "string" || tenantId === "") {
    return { context: null, responseHeaders };
  }
  return {
    context: {
      userId: session.user.id,
      tenantId,
      repos: createTenantRepositories(getDb(), tenantId),
    },
    responseHeaders,
  };
}

/** The signed-in user's tenant context, or null without a valid session. */
export async function getTenantContext(headers: Headers): Promise<TenantContext | null> {
  return (await resolveSession(headers)).context;
}

export const unauthorizedResponse = () => Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

/**
 * Wraps a route handler so it only runs with an authenticated tenant context.
 * Every API route that touches tenant data must use this. A renewed session
 * cookie is forwarded on the response, so a teacher who only syncs keeps a
 * live session.
 */
export function withTenant<TArgs extends unknown[]>(
  handler: (request: Request, context: TenantContext, ...rest: TArgs) => Promise<Response>,
) {
  return async (request: Request, ...rest: TArgs): Promise<Response> => {
    const { context, responseHeaders } = await resolveSession(request.headers);
    if (!context) return unauthorizedResponse();
    const response = await handler(request, context, ...rest);
    for (const cookie of responseHeaders.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  };
}
