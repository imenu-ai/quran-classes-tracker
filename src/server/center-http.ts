import { CenterError } from "./centers";
import { jsonResponse } from "./sync/http";
import { withTenant, type TenantContext } from "./auth/tenant-context";

const STATUS: Record<CenterError["code"], number> = {
  INVALID_INPUT: 400,
  CLASS_NOT_FOUND: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  USERNAME_TAKEN: 409,
  EMAIL_TAKEN: 409,
  LAST_ADMIN: 409,
};

/** Runs a center service call, answering its CenterError as JSON. */
export async function centerResponse(
  run: () => Promise<unknown>,
  successStatus = 200,
): Promise<Response> {
  try {
    const body = await run();
    return jsonResponse(body ?? { ok: true }, successStatus);
  } catch (error) {
    if (error instanceof CenterError) {
      return jsonResponse(
        {
          error: error.code,
          ...(error.fieldErrors.length > 0 ? { errors: error.fieldErrors } : {}),
        },
        STATUS[error.code],
      );
    }
    throw error;
  }
}

/** Like withTenant, for routes only a center admin may use (403 otherwise). */
export function withAdmin<TArgs extends unknown[]>(
  handler: (request: Request, context: TenantContext, ...rest: TArgs) => Promise<Response>,
) {
  return withTenant<TArgs>(async (request, context, ...rest) => {
    if (context.access.role !== "admin") return jsonResponse({ error: "FORBIDDEN" }, 403);
    return handler(request, context, ...rest);
  });
}
