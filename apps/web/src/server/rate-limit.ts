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

/** Says whether `key` has used up `rule` in its current window, without counting a request. */
export async function isRateLimited(
  db: Db,
  key: string,
  rule: RateRule,
  now: number = Date.now(),
): Promise<boolean> {
  const doc = await db
    .collection<RateLimitDoc>(COLLECTIONS.rateLimits)
    .findOne({ key: `app:${key}` });
  if (!doc || doc.windowStart < now - rule.window * 1000) return false;
  return doc.count >= rule.max;
}

/** The parent page: every request per IP (opening it, changing the month). */
export const PARENT_RATE_LIMIT: RateRule = { window: 15 * 60, max: 60 };

/** Wrong parent ID numbers per IP, against guessing from one place. */
export const PARENT_FAILURES_PER_IP: RateRule = { window: 15 * 60, max: 10 };

/** Wrong parent ID numbers per student, against guessing from many places. */
export const PARENT_FAILURES_PER_STUDENT: RateRule = { window: 24 * 60 * 60, max: 30 };
