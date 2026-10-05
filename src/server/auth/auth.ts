import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins/username";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { COLLECTIONS } from "../collections";
import { getDb } from "../db";
import { getServerEnv } from "../env";
import { hashPassword, verifyPassword } from "./password";

const DAY = 60 * 60 * 24;

/** Browsers cap cookie lifetimes at 400 days, so this is the longest useful session. */
export const SESSION_EXPIRES_IN = 400 * DAY;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Failed or successful sign-in attempts allowed per IP per window. */
export const SIGN_IN_RATE_LIMIT = { window: 60, max: 5 };

function createAuth() {
  const env = getServerEnv();
  return betterAuth({
    appName: "quran-classes-tracker",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: mongodbAdapter(getDb()),
    telemetry: { enabled: false },

    user: {
      modelName: COLLECTIONS.users,
      additionalFields: {
        tenantId: { type: "string", required: true, input: false },
        locale: { type: "string", required: false, defaultValue: DEFAULT_LOCALE, input: false },
      },
    },
    session: {
      modelName: COLLECTIONS.authSessions,
      expiresIn: SESSION_EXPIRES_IN,
      // Sliding session: extended at most once a day while the app is used.
      updateAge: DAY,
    },
    account: { modelName: COLLECTIONS.authAccounts },
    verification: { modelName: COLLECTIONS.authVerifications },

    emailAndPassword: {
      enabled: true,
      // Accounts are created only by the admin CLI (`pnpm user:create`).
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    // Username-only accounts: every email-based flow is switched off. The
    // email column holds a hidden placeholder that is never used.
    disabledPaths: [
      "/sign-up/email",
      "/sign-in/email",
      "/request-password-reset",
      "/reset-password",
      "/send-verification-email",
      "/verify-email",
      "/change-email",
    ],

    rateLimit: {
      // On in every environment (Better Auth only enables it in production by default).
      enabled: true,
      // Memory storage doesn't survive on serverless, so limits live in MongoDB.
      storage: "database",
      modelName: COLLECTIONS.rateLimits,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/username": SIGN_IN_RATE_LIMIT,
        "/change-password": { window: 60, max: 5 },
      },
    },

    advanced: {
      cookiePrefix: "qct",
      // Amplify (CloudFront) passes the client IP in x-forwarded-for.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },

    plugins: [
      username({ minUsernameLength: USERNAME_MIN, maxUsernameLength: USERNAME_MAX }),
      // Lets server actions set auth cookies; must stay last.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as typeof globalThis & { __auth?: Auth };

/** The Better Auth instance, created on first use (it needs the runtime env). */
export function getAuth(): Auth {
  globalForAuth.__auth ??= createAuth();
  return globalForAuth.__auth;
}

/** Test-only: drop the cached instance so a new env/database is picked up. */
export function resetAuthForTests() {
  globalForAuth.__auth = undefined;
}
