import { updateCenter } from "@/server/centers";
import { centerResponse, withAdmin } from "@/server/center-http";
import { readJsonBody } from "@/server/sync/http";
import type { UpdateCenterInput } from "@/shared/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/center: an admin renames the center or changes its time zone. */
export const PATCH = withAdmin(async (request, { tenantId }) => {
  const body = await readJsonBody(request, 10_000);
  if (!body.ok) return body.response;
  return centerResponse(() => updateCenter(tenantId, body.value as UpdateCenterInput));
});
