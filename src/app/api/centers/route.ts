import { getAuth } from "@/server/auth/auth";
import { CenterError, createCenter } from "@/server/centers";
import { getDb } from "@/server/db";
import { clientIp, consumeRateLimit } from "@/server/rate-limit";
import { badRequest, jsonResponse, readJsonBody } from "@/server/sync/http";
import { composeUsername, registerCenterSchema } from "@/shared/access";
import { parseWithCodes } from "@/shared/schemas/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Registrations allowed per IP per hour (counted once the form is valid). */
export const REGISTER_RATE_LIMIT = { window: 60 * 60, max: 5 };

/**
 * POST /api/centers: public registration of a new center and its admin.
 * Answers with the center code and signs the admin in (session cookie).
 */
export async function POST(request: Request) {
  // JSON only: a cross-site form can't send it without a CORS preflight.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return badRequest("INVALID_REQUEST");
  }
  const body = await readJsonBody(request, 10_000);
  if (!body.ok) return body.response;

  const parsed = parseWithCodes(registerCenterSchema, body.value);
  if (!parsed.success) {
    return jsonResponse({ error: "INVALID_INPUT", errors: parsed.errors }, 400);
  }

  const db = getDb();
  const allowed = await consumeRateLimit(
    db,
    `register:${clientIp(request.headers)}`,
    REGISTER_RATE_LIMIT,
  );
  if (!allowed) return jsonResponse({ error: "RATE_LIMITED" }, 429);

  let center;
  try {
    center = await createCenter(parsed.data);
  } catch (error) {
    if (error instanceof CenterError && error.code === "EMAIL_TAKEN") {
      return jsonResponse({ error: "EMAIL_TAKEN" }, 409);
    }
    if (error instanceof CenterError && error.code === "INVALID_INPUT") {
      return jsonResponse({ error: "INVALID_INPUT", errors: error.fieldErrors }, 400);
    }
    throw error;
  }

  const { headers } = await getAuth().api.signInUsername({
    body: {
      username: composeUsername(center.code, center.username),
      password: parsed.data.password,
    },
    headers: request.headers,
    returnHeaders: true,
  });
  const response = jsonResponse(
    { code: center.code, centerName: center.centerName, username: center.username },
    201,
  );
  for (const cookie of headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  return response;
}
