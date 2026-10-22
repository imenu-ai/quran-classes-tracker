import { pullQuerySchema } from "@/shared/sync/protocol";
import { withTenant } from "@/server/auth/tenant-context";
import { getDb } from "@/server/db";
import { badRequest, jsonResponse } from "@/server/sync/http";
import { pullChanges } from "@/server/sync/pull";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/sync/pull?since=N&limit=M: changes after a cursor (see PLAN.md §2.6). */
export const GET = withTenant(async (request, { actor, accessVersion }) => {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = pullQuerySchema.safeParse(params);
  if (!query.success) return badRequest("INVALID_REQUEST");

  const changes = await pullChanges(getDb(), actor, query.data.since, query.data.limit);
  return jsonResponse({ ...changes, accessVersion });
});
