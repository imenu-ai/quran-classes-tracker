import { createMember, listMembers } from "@/server/centers";
import { centerResponse, withAdmin } from "@/server/center-http";
import { readJsonBody } from "@/server/sync/http";
import type { CreateMemberInput } from "@/shared/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/center/users: the admin's list of the center's users. */
export const GET = withAdmin(async (_request, { tenantId }) =>
  centerResponse(async () => ({ users: await listMembers(tenantId) })),
);

/** POST /api/center/users: an admin adds a user (who must change the password first). */
export const POST = withAdmin(async (request, { tenantId }) => {
  const body = await readJsonBody(request, 20_000);
  if (!body.ok) return body.response;
  return centerResponse(() => createMember(tenantId, body.value as CreateMemberInput), 201);
});
