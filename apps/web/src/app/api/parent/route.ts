import type { NextRequest } from "next/server";
import { getDb } from "@/server/db";
import { getServerEnv } from "@/server/env";
import { PARENT_COOKIE_MAX_AGE, parentReport } from "@/server/parent";
import { clientIp } from "@/server/rate-limit";
import { badRequest, jsonResponse, readJsonBody } from "@/server/sync/http";
import { parentCookieName, parentRequestSchema } from "@qct/core/shared/parent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cookie(request: NextRequest, name: string, value: string, maxAge: number) {
  const secure =
    request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  return [
    `${name}=${value}`,
    "Path=/api/parent",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

/**
 * POST /api/parent: a student's month for his parent (no account). The
 * parent proves himself with his ID number, or the cookie from an earlier
 * visit; the right number (re)sets that cookie for 30 days.
 */
export async function POST(request: NextRequest) {
  // JSON only: a cross-site form can't send it without a CORS preflight.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return badRequest("INVALID_REQUEST");
  }
  const body = await readJsonBody(request, 2_000);
  if (!body.ok) return body.response;
  const parsed = parentRequestSchema.safeParse(body.value);
  if (!parsed.success) return badRequest("INVALID_REQUEST");

  const { studentId, parentId, month } = parsed.data;
  const result = await parentReport(getDb(), {
    studentId,
    parentId,
    month,
    token: request.cookies.get(parentCookieName(studentId))?.value,
    ip: clientIp(request.headers),
    secret: getServerEnv().BETTER_AUTH_SECRET,
  });
  if (!result.ok) return jsonResponse({ error: result.error }, result.status);

  const response = jsonResponse(result.report);
  response.headers.append(
    "set-cookie",
    cookie(request, parentCookieName(studentId), result.token, PARENT_COOKIE_MAX_AGE),
  );
  return response;
}

/** DELETE /api/parent?s=<studentId>: forget this phone for that student. */
export async function DELETE(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get("s");
  if (!studentId || studentId.length > 64) return badRequest("INVALID_REQUEST");
  const response = jsonResponse({ ok: true });
  response.headers.append("set-cookie", cookie(request, parentCookieName(studentId), "", 0));
  return response;
}
