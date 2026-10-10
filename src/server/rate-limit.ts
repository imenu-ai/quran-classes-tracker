import type { Db } from "mongodb";
import { COLLECTIONS } from "./collections";

export interface RateRule {
  /** Window length in seconds. */
  window: number;
  /** Requests allowed per window. */
  max: number;
}

/**
 * Center registrations allowed per IP per hour (counted once the form is
 * valid). Lives here, not in the route: a Next.js route file may only export
 * its handlers and route settings.
 */
export const REGISTER_RATE_LIMIT: RateRule = { window: 60 * 60, max: 5 };

/**
 * The client IP, by the same rule Better Auth uses without trusted proxies:
 * only a single-value x-forwarded-for counts. Anything else shares one bucket,
 * which fails safe (see README → "Sign-in rate limit behind CloudFront").
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.trim() ?? "";
  return forwarded && !forwarded.includes(",") ? forwarded : "unknown";
}

interface RateLimitDoc {
  key: string;
  count: number;
  windowStart: number;
}

/**
 * Counts one request against `key` and says whether it's allowed. Fixed
 * windows, stored in MongoDB (shared by every server instance). Keys are
 * prefixed "app:" so they never meet Better Auth's own entries.
 */
export async function consumeRateLimit(
  db: Db,
  key: string,
  rule: RateRule,
  now: number = Date.now(),
): Promise<boolean> {
  const expired = { $lt: [{ $ifNull: ["$windowStart", 0] }, now - rule.window * 1000] };
  const doc = await db.collection<RateLimitDoc>(COLLECTIONS.rateLimits).findOneAndUpdate(
    { key: `app:${key}` },
    [
      {
        $set: {
          count: { $cond: [expired, 1, { $add: [{ $ifNull: ["$count", 0] }, 1] }] },
          windowStart: { $cond: [expired, now, "$windowStart"] },
        },
      },
    ],
    { upsert: true, returnDocument: "after" },
  );
  return (doc?.count ?? 1) <= rule.max;
}
