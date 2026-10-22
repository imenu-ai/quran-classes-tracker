/** Largest push body accepted (200 records is well under this). */
export const MAX_PUSH_BODY_BYTES = 1_000_000;

const NO_STORE = { "cache-control": "no-store" };

export const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: NO_STORE });

export const badRequest = (error: string) => jsonResponse({ error }, 400);

/** Reads a JSON body, refusing anything over `maxBytes`. */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    return { ok: false, response: jsonResponse({ error: "PAYLOAD_TOO_LARGE" }, 413) };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, response: jsonResponse({ error: "PAYLOAD_TOO_LARGE" }, 413) };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: badRequest("INVALID_JSON") };
  }
}
