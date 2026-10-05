import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections";

/** A reserved range of versions whose records may not be written yet. */
export interface InFlight {
  token: string;
  from: number;
  at: Date;
}

export interface CounterDoc {
  _id: string; // tenantId
  seq: number;
  inFlight: InFlight[];
}

/** An allocation older than this is treated as abandoned (e.g. a crashed request). */
export const IN_FLIGHT_TTL_MS = 30_000;

export interface Allocation {
  /** First version in the reserved range; the range is from..from+count-1. */
  from: number;
  count: number;
  /** Marks the range as written. Always call it, even after a failure. */
  release(): Promise<void>;
}

const counters = (db: Db) => db.collection<CounterDoc>(COLLECTIONS.counters);

/**
 * Reserves `count` consecutive serverVersions for a tenant in ONE atomic
 * update, and records the range as in flight in the same write, so a pull
 * can never see the counter move without also seeing the reservation.
 */
export async function allocateVersions(
  db: Db,
  tenantId: string,
  count: number,
  now: Date = new Date(),
): Promise<Allocation> {
  if (!Number.isInteger(count) || count < 1) throw new Error("count must be a positive integer");
  const token = crypto.randomUUID();

  const counter = await counters(db).findOneAndUpdate(
    { _id: tenantId },
    [
      // Uses the counter value from BEFORE the increment below.
      {
        $set: {
          inFlight: {
            $concatArrays: [
              { $ifNull: ["$inFlight", []] },
              [{ token, at: now, from: { $add: [{ $ifNull: ["$seq", 0] }, 1] } }],
            ],
          },
        },
      },
      { $set: { seq: { $add: [{ $ifNull: ["$seq", 0] }, count] } } },
    ],
    { upsert: true, returnDocument: "after" },
  );
  if (!counter) throw new Error("Version counter update returned nothing");

  return {
    from: counter.seq - count + 1,
    count,
    release: async () => {
      await counters(db).updateOne({ _id: tenantId }, { $pull: { inFlight: { token } } });
    },
  };
}

/**
 * The highest version a pull may safely hand out: every version at or below
 * it has either been written or will never be. Equals the counter when
 * nothing is in flight; otherwise one below the oldest live reservation.
 */
export async function getWatermark(
  db: Db,
  tenantId: string,
  now: Date = new Date(),
): Promise<number> {
  const counter = await counters(db).findOne({ _id: tenantId });
  if (!counter) return 0;
  const cutoff = now.getTime() - IN_FLIGHT_TTL_MS;
  const live = (counter.inFlight ?? []).filter((entry) => entry.at.getTime() > cutoff);
  if (live.length === 0) return counter.seq;
  return Math.min(...live.map((entry) => entry.from)) - 1;
}
