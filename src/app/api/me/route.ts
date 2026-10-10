import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE, isLocale } from "@/i18n/config";
import { getAuth } from "@/server/auth/auth";
import { withTenant } from "@/server/auth/tenant-context";
import { isPlaceholderEmail } from "@/server/centers";
import { getDb } from "@/server/db";
import { getMember } from "@/server/members";
import { jsonResponse } from "@/server/sync/http";
import { getTenant } from "@/server/tenants";
import type { MeResponse } from "@/shared/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me: the signed-in user, his access and his center's settings,
 * saved on the device after sign-in (the offline gate reads that copy).
 */
export const GET = withTenant(async (request, { tenantId }) => {
  const session = await getAuth().api.getSession({ headers: request.headers });
  const db = getDb();
  const [tenant, member] = await Promise.all([
    getTenant(db, tenantId),
    session ? getMember(db, session.user.id) : null,
  ]);
  if (!session || !tenant || !member) return jsonResponse({ error: "UNAUTHORIZED" }, 401);

  const { user } = session;
  const email = String(user.email ?? "");
  const body: MeResponse = {
    user: {
      id: user.id,
      name: user.name,
      // The part people see; the stored username is "<code>:<username>".
      username: String(user.displayUsername ?? ""),
      phone: String(user.phone ?? ""),
      email: member.role === "admin" && !isPlaceholderEmail(email) ? email : null,
      locale: isLocale(user.locale) ? user.locale : DEFAULT_LOCALE,
      role: member.role,
      permissions: member.permissions,
      classIds: member.classIds,
      mustChangePassword: member.mustChangePassword,
      accessVersion: member.accessVersion,
    },
    tenant: {
      id: tenant._id,
      name: tenant.name,
      code: tenant.code,
      timezone: tenant.timezone ?? DEFAULT_TIME_ZONE,
    },
  };
  return jsonResponse(body);
});
