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

/** The signed-in user's tenant context, or null without a valid session. */
export async function getTenantContext(headers: Headers): Promise<TenantContext | null> {
  const session = await getAuth().api.getSession({ headers });
  const tenantId = session?.user.tenantId;
  if (!session || typeof tenantId !== "string" || tenantId === "") return null;
  return {
    userId: session.user.id,
    tenantId,
    repos: createTenantRepositories(getDb(), tenantId),
  };
}

export const unauthorizedResponse = () => Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

/**
 * Wraps a route handler so it only runs with an authenticated tenant context.
 * Every API route that touches tenant data must use this.
 */
export function withTenant<TArgs extends unknown[]>(
  handler: (request: Request, context: TenantContext, ...rest: TArgs) => Promise<Response>,
) {
  return async (request: Request, ...rest: TArgs): Promise<Response> => {
    const context = await getTenantContext(request.headers);
    if (!context) return unauthorizedResponse();
    return handler(request, context, ...rest);
  };
}
