import { MongoServerError } from "mongodb";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { DEFAULT_TIME_ZONE, LOCALES } from "@/i18n/config";
import { NAME_MAX } from "@/shared/schemas/base";
import { getAuth, PASSWORD_MAX, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN } from "./auth/auth";
import { hashPassword } from "./auth/password";
import { COLLECTIONS } from "./collections";
import { getDb } from "./db";

export interface TenantDoc {
  _id: string;
  name: string;
  timezone: string;
  createdAt: Date;
}

const isTimeZone = (value: string) => Intl.supportedValuesOf("timeZone").includes(value);

/** Same rule as Better Auth's default username validator. */
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;

export const teacherAccountInputSchema = z.object({
  tenantName: z.string().trim().min(1).max(NAME_MAX),
  username: z.string().trim().min(USERNAME_MIN).max(USERNAME_MAX).regex(USERNAME_PATTERN),
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
  name: z.string().trim().min(1).max(NAME_MAX),
  locale: z.enum(LOCALES).default("ar"),
  timezone: z.string().refine(isTimeZone).default(DEFAULT_TIME_ZONE),
});

export type TeacherAccountInput = z.input<typeof teacherAccountInputSchema>;

export class AccountError extends Error {
  constructor(
    readonly code: "INVALID_INPUT" | "USERNAME_TAKEN",
    message: string,
  ) {
    super(message);
  }
}

const isDuplicateKey = (error: unknown) =>
  error instanceof MongoServerError && error.code === 11000;

/** Finds the tenant by name or creates it (safe against a concurrent create). */
async function findOrCreateTenant(name: string, timezone: string) {
  const tenants = getDb().collection<TenantDoc>(COLLECTIONS.tenants);
  const existing = await tenants.findOne({ name });
  if (existing) return { tenant: existing, created: false };

  const tenant: TenantDoc = { _id: uuidv7(), name, timezone, createdAt: new Date() };
  try {
    await tenants.insertOne(tenant);
    return { tenant, created: true };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const raced = await tenants.findOne({ name });
    if (!raced) throw error;
    return { tenant: raced, created: false };
  }
}

/**
 * Creates a teacher account (and its tenant when needed). Used by the admin
 * CLI; there is no public sign-up. The email column required by Better Auth
 * gets a hidden, unique placeholder on the reserved `.invalid` domain.
 */
export async function createTeacherAccount(rawInput: TeacherAccountInput) {
  const parsed = teacherAccountInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    throw new AccountError("INVALID_INPUT", `Invalid value for: ${fields.join(", ")}`);
  }
  const input = parsed.data;
  const username = input.username.toLowerCase();

  const ctx = await getAuth().$context;
  const users = getDb().collection(COLLECTIONS.users);
  if (await users.findOne({ username })) {
    throw new AccountError("USERNAME_TAKEN", `Username "${username}" is already taken.`);
  }

  const { tenant, created: createdTenant } = await findOrCreateTenant(
    input.tenantName,
    input.timezone,
  );

  let user;
  try {
    user = await ctx.internalAdapter.createUser(
      {
        name: input.name,
        email: `${uuidv7()}@users.invalid`,
        username,
        displayUsername: username,
        tenantId: tenant._id,
        locale: input.locale,
      },
      { method: "admin" },
    );
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new AccountError("USERNAME_TAKEN", `Username "${username}" is already taken.`);
    }
    throw error;
  }

  try {
    await ctx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await hashPassword(input.password),
    });
  } catch (error) {
    // No multi-document transaction here: undo the user so the CLI can be re-run.
    await ctx.internalAdapter.deleteUser(user.id);
    throw error;
  }

  return {
    userId: user.id,
    username,
    tenantId: tenant._id,
    tenantName: tenant.name,
    createdTenant,
  };
}
