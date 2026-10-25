import { withTenant } from "@/server/auth/tenant-context";
import { updateOwnProfile } from "@/server/centers";
import { deleteOwnAccount } from "@/server/deletion";
import { centerResponse } from "@/server/center-http";
import { readJsonBody } from "@/server/sync/http";
import type { DeletionInput, UpdateProfileInput } from "@qct/core/shared/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/account: the signed-in user edits his own name, username and
 * phone (admins also their email). Replaces Better Auth's /update-user,
 * which can't keep the "<code>:<username>" form.
 */
export const PATCH = withTenant(async (request, { tenantId, userId }) => {
  const body = await readJsonBody(request, 10_000);
  if (!body.ok) return body.response;
  return centerResponse(() => updateOwnProfile(tenantId, userId, body.value as UpdateProfileInput));
});

/**
 * DELETE /api/account: the signed-in user deletes his own account, with his
 * password ({ password }). The last active admin gets LAST_ADMIN.
 */
export const DELETE = withTenant(async (request, { tenantId, userId }) => {
  const body = await readJsonBody(request, 10_000);
  if (!body.ok) return body.response;
  return centerResponse(() => deleteOwnAccount(tenantId, userId, body.value as DeletionInput));
});
