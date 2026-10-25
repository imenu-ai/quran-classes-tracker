import type { Db } from "mongodb";
import { deletionSchema, type DeletionInput } from "@qct/core/shared/access";
import { getAuth } from "./auth/auth";
import { verifyPassword } from "./auth/password";
import { CenterError, isLastActiveAdmin, parse } from "./centers";
import { COLLECTIONS, SYNCABLE_COLLECTIONS } from "./collections";
import { getDb } from "./db";
import { membersCollection } from "./members";
import { consumeRateLimit, type RateRule } from "./rate-limit";
import { createTenantRepositories } from "./repositories/tenant-repository";
import { tenantsCollection } from "./tenants";

/**
 * Deletion attempts allowed per user per 15 minutes, so a borrowed signed-in
 * device can't be used to guess the password. Lives here, not in a route: a
 * Next.js route file may only export its handlers and route settings.
 */
export const DELETION_RATE_LIMIT: RateRule = { window: 15 * 60, max: 5 };

/** The user typed his own password again (PLAN.md §0 #50). */
async function confirmPassword(db: Db, userId: string, rawInput: DeletionInput) {
  const { password } = parse(deletionSchema, rawInput);
  if (!(await consumeRateLimit(db, `deletion:${userId}`, DELETION_RATE_LIMIT))) {
    throw new CenterError("RATE_LIMITED");
  }
  const accounts = await (await getAuth().$context).internalAdapter.findAccounts(userId);
  const hash = accounts.find((account) => account.providerId === "credential")?.password;
  if (!hash || !(await verifyPassword({ hash, password }))) {
    throw new CenterError("WRONG_PASSWORD");
  }
}

/** The member document first: without it no request of his gets through. */
async function deleteUser(db: Db, tenantId: string, userId: string) {
  const ctx = await getAuth().$context;
  await membersCollection(db).deleteOne({ _id: userId, tenantId });
  await ctx.internalAdapter.deleteUserSessions(userId);
  await ctx.internalAdapter.deleteAccounts(userId);
  await ctx.internalAdapter.deleteUser(userId);
}

/**
 * A user deletes his own account: his sign-in, name, username, phone and
 * email go, and every device of his is signed out. The center's classes,
 * students and records stay; they belong to the center. The last active
 * admin can't: another user must be made admin first, or the center deleted.
 */
export async function deleteOwnAccount(tenantId: string, userId: string, input: DeletionInput) {
  const db = getDb();
  const member = await membersCollection(db).findOne({ _id: userId, tenantId });
  if (!member) throw new CenterError("NOT_FOUND");
  await confirmPassword(db, userId, input);
  if (
    member.role === "admin" &&
    !member.disabled &&
    (await isLastActiveAdmin(db, tenantId, userId))
  ) {
    throw new CenterError("LAST_ADMIN");
  }
  await deleteUser(db, tenantId, userId);
}

/**
 * An admin deletes the center and everything in it: every user, record and
 * the center itself. Parent links stop working (their students are gone).
 *
 * Everyone is signed out first, so no device writes while it goes. There are
 * no multi-document transactions; the admin's own user goes last, so if it
 * stops halfway he can sign in again and repeat it.
 */
export async function deleteCenter(tenantId: string, userId: string, input: DeletionInput) {
  const db = getDb();
  await confirmPassword(db, userId, input);
  const ctx = await getAuth().$context;

  const members = await membersCollection(db)
    .find({ tenantId }, { projection: { _id: 1 } })
    .toArray();
  const users = await db
    .collection(COLLECTIONS.users)
    .find({ tenantId }, { projection: { _id: 1 } })
    .toArray();
  const userIds = [
    ...new Set([...members.map((member) => member._id), ...users.map((user) => String(user._id))]),
  ].filter((id) => id !== userId);

  for (const id of [...userIds, userId]) await ctx.internalAdapter.deleteUserSessions(id);

  const repos = createTenantRepositories(db, tenantId);
  const deleteRecords = async () => {
    for (const name of SYNCABLE_COLLECTIONS) await repos[name].deleteAll();
  };
  await deleteRecords();
  await db.collection<{ _id: string }>(COLLECTIONS.counters).deleteOne({ _id: tenantId });

  for (const id of [...userIds, userId]) await deleteUser(db, tenantId, id);
  // Anything a request already past its session check wrote meanwhile.
  await deleteRecords();
  await tenantsCollection(db).deleteOne({ _id: tenantId });
}
