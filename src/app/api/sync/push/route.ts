import { pushRequestSchema } from "@/shared/sync/protocol";
import { withTenant } from "@/server/auth/tenant-context";
import { getDb } from "@/server/db";
import { badRequest, jsonResponse, MAX_PUSH_BODY_BYTES, readJsonBody } from "@/server/sync/http";
import { pushChanges } from "@/server/sync/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/sync/push: apply a batch of local changes (see PLAN.md §2.4). */
export const POST = withTenant(async (request, { tenantId }) => {
  const body = await readJsonBody(request, MAX_PUSH_BODY_BYTES);
  if (!body.ok) return body.response;

  const parsed = pushRequestSchema.safeParse(body.value);
  if (!parsed.success) return badRequest("INVALID_REQUEST");

  const results = await pushChanges(getDb(), tenantId, parsed.data.mutations);
  return jsonResponse({ results });
});
