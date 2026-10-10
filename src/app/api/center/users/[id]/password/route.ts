import { setMemberPassword } from "@/server/centers";
import { centerResponse, withAdmin } from "@/server/center-http";
import { readJsonBody } from "@/server/sync/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/center/users/:id/password: an admin sets a new password. The
 * user is signed out everywhere and must replace it at the next sign-in.
 */
export const POST = withAdmin(
  async (request, { tenantId }, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await readJsonBody(request, 2_000);
    if (!body.ok) return body.response;
    const password = (body.value as { password?: unknown }).password;
    return centerResponse(() =>
      setMemberPassword(tenantId, id, typeof password === "string" ? password : ""),
    );
  },
);
