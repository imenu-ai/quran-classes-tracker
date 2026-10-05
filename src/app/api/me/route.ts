import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE, isLocale } from "@/i18n/config";
import { getAuth } from "@/server/auth/auth";
import { withTenant } from "@/server/auth/tenant-context";
import { getDb } from "@/server/db";
import { jsonResponse } from "@/server/sync/http";
import { getTenant } from "@/server/tenants";
import type { MeResponse } from "@/shared/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/me: the signed-in teacher and tenant settings, saved on the device after login. */
export const GET = withTenant(async (request, { tenantId }) => {
  const session = await getAuth().api.getSession({ headers: request.headers });
  const tenant = await getTenant(getDb(), tenantId);
  if (!session || !tenant) return jsonResponse({ error: "UNAUTHORIZED" }, 401);

  const { user } = session;
  const body: MeResponse = {
    user: {
      id: user.id,
      name: user.name,
      username: String(user.username ?? ""),
      locale: isLocale(user.locale) ? user.locale : DEFAULT_LOCALE,
    },
    tenant: { id: tenant._id, name: tenant.name, timezone: tenant.timezone ?? DEFAULT_TIME_ZONE },
  };
  return jsonResponse(body);
});
