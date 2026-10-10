import { randomInt } from "node:crypto";
import { MongoServerError, type Db } from "mongodb";
import { v7 as uuidv7 } from "uuid";
import {
  composeUsername,
  createMemberSchema,
  isCenterCode,
  PERMISSIONS,
  registerCenterSchema,
  updateCenterSchema,
  updateMemberSchema,
  updateProfileSchema,
  passwordSchema,
  type CreateMemberInput,
  type Permission,
  type RegisterCenterInput,
  type Role,
  type UpdateCenterInput,
  type UpdateMemberInput,
  type UpdateProfileInput,
} from "@/shared/access";
import { parseWithCodes, type FieldError } from "@/shared/schemas/errors";
import { getAuth } from "./auth/auth";
import { hashPassword } from "./auth/password";
import { COLLECTIONS } from "./collections";
import { getDb } from "./db";
import { placeholderEmail } from "./email";
import { membersCollection, type MemberDoc } from "./members";
import { tenantsCollection, type TenantDoc } from "./tenants";

export type CenterErrorCode =
  | "INVALID_INPUT"
  | "USERNAME_TAKEN"
  | "EMAIL_TAKEN"
  | "NOT_FOUND"
  | "LAST_ADMIN"
  | "CLASS_NOT_FOUND"
  | "FORBIDDEN";

export class CenterError extends Error {
  constructor(
    readonly code: CenterErrorCode,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(
      fieldErrors.length > 0
        ? `${code}: ${fieldErrors.map((error) => `${error.path}:${error.code}`).join(", ")}`
        : code,
    );
  }
}

const isDuplicateKey = (error: unknown) =>
  error instanceof MongoServerError && error.code === 11000;

function parse<T extends Parameters<typeof parseWithCodes>[0]>(schema: T, input: unknown) {
  const result = parseWithCodes(schema, input);
  if (!result.success) throw new CenterError("INVALID_INPUT", result.errors);
  return result.data;
}

export { isPlaceholderEmail } from "./email";

const usersCollection = (db: Db) => db.collection(COLLECTIONS.users);

async function assertUsernameFree(db: Db, username: string, exceptUserId?: string) {
  const existing = await usersCollection(db).findOne({ username });
  if (existing && String(existing._id) !== exceptUserId) throw new CenterError("USERNAME_TAKEN");
}

async function assertEmailFree(db: Db, email: string, exceptUserId?: string) {
  const existing = await usersCollection(db).findOne({ email });
  if (existing && String(existing._id) !== exceptUserId) throw new CenterError("EMAIL_TAKEN");
}

/**
 * Inserts a tenant with a fresh random 6-digit code (retried on the rare
 * collision), or with `fixedCode` when given (tests and the CLI).
 */
async function insertTenant(
  db: Db,
  name: string,
  timezone: string,
  fixedCode?: string,
): Promise<TenantDoc> {
  for (let attempt = 0; attempt < (fixedCode ? 1 : 20); attempt += 1) {
    const tenant: TenantDoc = {
      _id: uuidv7(),
      name,
      code: fixedCode ?? String(randomInt(100_000, 1_000_000)),
      timezone,
      createdAt: new Date(),
    };
    try {
      await tenantsCollection(db).insertOne(tenant);
      return tenant;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }
  throw new Error("Could not allocate a unique center code");
}

/**
 * Creates a Better Auth user with a password, and its member document. Undoes
 * what it created if a later part fails (there are no multi-document
 * transactions here), so the caller can simply retry.
 */
async function createUserWithMember(
  db: Db,
  user: { name: string; email: string; username: string; displayUsername: string; phone: string },
  password: string,
  member: Omit<MemberDoc, "_id" | "createdAt" | "updatedAt">,
  locale: string,
) {
  const ctx = await getAuth().$context;
  let created;
  try {
    created = await ctx.internalAdapter.createUser(
      { ...user, tenantId: member.tenantId, locale },
      { method: "admin" },
    );
  } catch (error) {
    if (isDuplicateKey(error)) throw new CenterError("USERNAME_TAKEN");
    throw error;
  }
  try {
    await ctx.internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: await hashPassword(password),
    });
    const now = new Date();
    await membersCollection(db).insertOne({
      _id: created.id,
      ...member,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    await membersCollection(db).deleteOne({ _id: created.id });
    await ctx.internalAdapter.deleteAccounts(created.id);
    await ctx.internalAdapter.deleteUser(created.id);
    throw error;
  }
  return created.id;
}

// ---------------------------------------------------------------------------

/**
 * Registration: a new center with its first admin. `options.code` picks the
 * center code instead of a random one; only trusted server code (E2E setup)
 * passes it, never a request.
 */
export async function createCenter(rawInput: RegisterCenterInput, options: { code?: string } = {}) {
  const db = getDb();
  const input = parse(registerCenterSchema, rawInput);
  if (options.code !== undefined && !isCenterCode(options.code)) {
    throw new Error(`Invalid center code "${options.code}"`);
  }
  await assertEmailFree(db, input.email);

  const tenant = await insertTenant(db, input.centerName, input.timezone, options.code);
  try {
    const userId = await createUserWithMember(
      db,
      {
        name: input.adminName,
        email: input.email,
        username: composeUsername(tenant.code, input.username),
        displayUsername: input.username,
        phone: "",
      },
      input.password,
      {
        tenantId: tenant._id,
        role: "admin",
        permissions: [...PERMISSIONS],
        classIds: [],
        disabled: false,
        mustChangePassword: false,
        accessVersion: 1,
      },
      input.locale,
    );
    return {
      tenantId: tenant._id,
      code: tenant.code,
      centerName: tenant.name,
      userId,
      username: input.username,
    };
  } catch (error) {
    await tenantsCollection(db).deleteOne({ _id: tenant._id });
    if (isDuplicateKey(error)) throw new CenterError("EMAIL_TAKEN");
    throw error;
  }
}

async function getTenantOrThrow(db: Db, tenantId: string) {
  const tenant = await tenantsCollection(db).findOne({ _id: tenantId });
  if (!tenant) throw new CenterError("NOT_FOUND");
  return tenant;
}

/** Every class id must be a live class of this tenant. */
async function assertClassesExist(db: Db, tenantId: string, classIds: readonly string[]) {
  if (classIds.length === 0) return;
  const found = await db
    .collection(COLLECTIONS.classes)
    .countDocuments({ tenantId, _id: { $in: classIds as never[] }, deletedAt: null });
  if (found !== classIds.length) throw new CenterError("CLASS_NOT_FOUND");
}

/** An admin adds a user. He must replace the password on first sign-in. */
export async function createMember(tenantId: string, rawInput: CreateMemberInput) {
  const db = getDb();
  const input = parse(createMemberSchema, rawInput);
  const tenant = await getTenantOrThrow(db, tenantId);
  const username = composeUsername(tenant.code, input.username);
  await assertUsernameFree(db, username);
  await assertClassesExist(db, tenantId, input.classIds);

  const userId = await createUserWithMember(
    db,
    {
      name: input.name,
      email: placeholderEmail(),
      username,
      displayUsername: input.username,
      phone: input.phone,
    },
    input.password,
    {
      tenantId,
      role: input.role,
      permissions: input.permissions,
      classIds: input.classIds,
      disabled: false,
      mustChangePassword: true,
      accessVersion: 1,
    },
    "ar",
  );
  return { userId, username: input.username };
}

async function getMemberOrThrow(db: Db, tenantId: string, userId: string) {
  const member = await membersCollection(db).findOne({ _id: userId, tenantId });
  if (!member) throw new CenterError("NOT_FOUND");
  return member;
}

/** True when `userId` is the only active admin left in the center. */
async function isLastActiveAdmin(db: Db, tenantId: string, userId: string) {
  const others = await membersCollection(db).countDocuments({
    tenantId,
    role: "admin",
    disabled: false,
    _id: { $ne: userId },
  });
  return others === 0;
}

/**
 * The user fields for a new username, or none when it's unchanged. Better
 * Auth's username plugin refuses an update that repeats the user's own
 * username as "already taken", so an unchanged one must not be sent.
 */
async function usernameChange(
  db: Db,
  tenantId: string,
  userId: string,
  localUsername: string,
): Promise<Record<string, string>> {
  const tenant = await getTenantOrThrow(db, tenantId);
  const username = composeUsername(tenant.code, localUsername);
  const current = await (await getAuth().$context).internalAdapter.findUserById(userId);
  if (current && (current as { username?: unknown }).username === username) return {};
  await assertUsernameFree(db, username, userId);
  return { username, displayUsername: localUsername };
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

/** An admin edits a user's details or access. */
export async function updateMember(tenantId: string, userId: string, rawInput: UpdateMemberInput) {
  const db = getDb();
  const input = parse(updateMemberSchema, rawInput);
  const member = await getMemberOrThrow(db, tenantId, userId);
  const ctx = await getAuth().$context;

  const losesAdmin =
    member.role === "admin" &&
    !member.disabled &&
    ((input.role !== undefined && input.role !== "admin") || input.disabled === true);
  if (losesAdmin && (await isLastActiveAdmin(db, tenantId, userId))) {
    throw new CenterError("LAST_ADMIN");
  }

  // Identity (Better Auth user).
  const userChanges: Record<string, string> = {};
  if (input.name !== undefined) userChanges.name = input.name;
  if (input.phone !== undefined) userChanges.phone = input.phone;
  if (input.username !== undefined) {
    Object.assign(userChanges, await usernameChange(db, tenantId, userId, input.username));
  }
  if (Object.keys(userChanges).length > 0) {
    try {
      await ctx.internalAdapter.updateUser(userId, userChanges);
    } catch (error) {
      if (isDuplicateKey(error)) throw new CenterError("USERNAME_TAKEN");
      throw error;
    }
  }

  // Access (member document).
  if (input.classIds !== undefined) await assertClassesExist(db, tenantId, input.classIds);
  const accessChanged =
    (input.role !== undefined && input.role !== member.role) ||
    (input.permissions !== undefined && !sameSet(input.permissions, member.permissions)) ||
    (input.classIds !== undefined && !sameSet(input.classIds, member.classIds));
  const set: Partial<MemberDoc> = { updatedAt: new Date() };
  if (input.role !== undefined) set.role = input.role;
  if (input.permissions !== undefined) set.permissions = input.permissions as Permission[];
  if (input.classIds !== undefined) set.classIds = input.classIds;
  if (input.disabled !== undefined) set.disabled = input.disabled;
  await membersCollection(db).updateOne(
    { _id: userId, tenantId },
    { $set: set, ...(accessChanged ? { $inc: { accessVersion: 1 } } : {}) },
  );

  // A disabled user is signed out everywhere at once.
  if (input.disabled === true) await ctx.internalAdapter.deleteUserSessions(userId);
}

/** An admin sets a new password; the user must replace it at next sign-in. */
export async function setMemberPassword(tenantId: string, userId: string, password: string) {
  const db = getDb();
  const parsed = parseWithCodes(passwordSchema, password);
  if (!parsed.success) {
    throw new CenterError(
      "INVALID_INPUT",
      parsed.errors.map((error) => ({ ...error, path: "password" })),
    );
  }
  await getMemberOrThrow(db, tenantId, userId);
  const ctx = await getAuth().$context;
  await ctx.internalAdapter.updatePassword(userId, await hashPassword(parsed.data));
  await membersCollection(db).updateOne(
    { _id: userId, tenantId },
    { $set: { mustChangePassword: true, updatedAt: new Date() } },
  );
  await ctx.internalAdapter.deleteUserSessions(userId);
}

/** A user edits his own details. Only admins have an email (for password reset). */
export async function updateOwnProfile(
  tenantId: string,
  userId: string,
  rawInput: UpdateProfileInput,
) {
  const db = getDb();
  const input = parse(updateProfileSchema, rawInput);
  const member = await getMemberOrThrow(db, tenantId, userId);
  if (input.email !== undefined && member.role !== "admin") throw new CenterError("FORBIDDEN");

  const changes: Record<string, string> = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.phone !== undefined) changes.phone = input.phone;
  if (input.username !== undefined) {
    Object.assign(changes, await usernameChange(db, tenantId, userId, input.username));
  }
  if (input.email !== undefined) {
    await assertEmailFree(db, input.email, userId);
    changes.email = input.email;
  }
  if (Object.keys(changes).length === 0) return;
  const ctx = await getAuth().$context;
  try {
    await ctx.internalAdapter.updateUser(userId, changes);
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new CenterError(input.email !== undefined ? "EMAIL_TAKEN" : "USERNAME_TAKEN");
    }
    throw error;
  }
}

/** An admin edits the center's name or time zone. */
export async function updateCenter(tenantId: string, rawInput: UpdateCenterInput) {
  const db = getDb();
  const input = parse(updateCenterSchema, rawInput);
  const set: Partial<TenantDoc> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.timezone !== undefined) set.timezone = input.timezone;
  if (Object.keys(set).length === 0) return;
  const result = await tenantsCollection(db).updateOne({ _id: tenantId }, { $set: set });
  if (result.matchedCount === 0) throw new CenterError("NOT_FOUND");
}

export interface MemberSummary {
  id: string;
  name: string;
  username: string;
  phone: string;
  role: Role;
  permissions: Permission[];
  classIds: string[];
  disabled: boolean;
  mustChangePassword: boolean;
}

/** The center's users, for the admin's user list. */
export async function listMembers(tenantId: string): Promise<MemberSummary[]> {
  const db = getDb();
  const [members, users] = await Promise.all([
    membersCollection(db).find({ tenantId }).toArray(),
    usersCollection(db).find({ tenantId }).toArray(),
  ]);
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  return members.flatMap((member) => {
    const user = usersById.get(member._id);
    if (!user) return [];
    return [
      {
        id: member._id,
        name: String(user.name ?? ""),
        username: String(user.displayUsername ?? ""),
        phone: String(user.phone ?? ""),
        role: member.role,
        permissions: member.permissions,
        classIds: member.classIds,
        disabled: member.disabled,
        mustChangePassword: member.mustChangePassword,
      },
    ];
  });
}
