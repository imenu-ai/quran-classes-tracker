import { updateCenter } from "@/server/centers";
import { centerResponse, withAdmin } from "@/server/center-http";
import { deleteCenter } from "@/server/deletion";
import { readJsonBody } from "@/server/sync/http";
import type { DeletionInput, UpdateCenterInput } from "@qct/core/shared/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/center: an admin renames the center or changes its time zone. */
export const PATCH = withAdmin(async (request, { tenantId }) => {
  const body = await readJsonBody(request, 10_000);
  if (!body.ok) return body.response;
  return centerResponse(() => updateCenter(tenantId, body.value as UpdateCenterInput));
});

/**
 * DELETE /api/center: an admin deletes the center with all its users and
 * records, with his password ({ password }).
 */
export const DELETE = withAdmin(async (request, { tenantId, userId }) => {
  const body = await readJsonBody(request, 10_000);
  if (!body.ok) return body.response;
  return centerResponse(() => deleteCenter(tenantId, userId, body.value as DeletionInput));
});
