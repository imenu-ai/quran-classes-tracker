import { updateMember } from "@/server/centers";
import { centerResponse, withAdmin } from "@/server/center-http";
import { readJsonBody } from "@/server/sync/http";
import type { UpdateMemberInput } from "@/shared/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/center/users/:id: an admin edits a user's details or access. */
export const PATCH = withAdmin(
  async (request, { tenantId }, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await readJsonBody(request, 20_000);
    if (!body.ok) return body.response;
    return centerResponse(() => updateMember(tenantId, id, body.value as UpdateMemberInput));
  },
);
