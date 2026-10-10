import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { username } from "better-auth/plugins/username";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/i18n/config";
import {
  CENTER_CODE_LENGTH,
  isCompositeUsername,
  isLocalUsername,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
} from "@/shared/access";
import { COLLECTIONS } from "../collections";
import { getDb } from "../db";
import { getServerEnv } from "../env";
import { membersCollection } from "../members";
import { hashPassword, verifyPassword } from "./password";

const DAY = 60 * 60 * 24;

/** Browsers cap cookie lifetimes at 400 days, so this is the longest useful session. */
export const SESSION_EXPIRES_IN = 400 * DAY;

/** Stored usernames are "<6-digit center code>:<username>" (unique per center). */
const STORED_USERNAME_MIN = CENTER_CODE_LENGTH + 1 + USERNAME_MIN;
const STORED_USERNAME_MAX = CENTER_CODE_LENGTH + 1 + USERNAME_MAX;

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
        phone: { type: "string", required: false, defaultValue: "", input: false },
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
      // Accounts are created by center registration and by admins
      // (src/server/centers.ts), never by Better Auth's sign-up.
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
      // Name, username and phone change through PATCH /api/account, which keeps
      // the "<code>:<username>" form; Better Auth's own update could break it.
      "/update-user",
      "/is-username-available",
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

    hooks: {
      // A disabled user can't sign in, even with the right password.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/username") return;
        const raw: unknown = (ctx.body as { username?: unknown } | undefined)?.username;
        if (typeof raw !== "string") return;
        const user = await getDb()
          .collection(COLLECTIONS.users)
          .findOne({ username: raw.trim().toLowerCase() });
        if (!user) return;
        const member = await membersCollection(getDb()).findOne({ _id: String(user._id) });
        if (member?.disabled) {
          throw new APIError("FORBIDDEN", {
            code: "ACCOUNT_DISABLED",
            message: "This account is disabled",
          });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        // Copies the user's saved locale into the locale cookie on sign-in, so
        // the very next page render uses it (no locale in the URL).
        const newSession = ctx.context.newSession;
        if (ctx.path === "/sign-in/username" && newSession) {
          const locale = newSession.user.locale;
          ctx.setCookie(LOCALE_COOKIE, isLocale(locale) ? locale : DEFAULT_LOCALE, {
            path: "/",
            sameSite: "lax",
            maxAge: SESSION_EXPIRES_IN,
          });
        }
        // The password an admin chose has been replaced by the user's own.
        if (ctx.path === "/change-password" && !(ctx.context.returned instanceof APIError)) {
          const userId = ctx.context.session?.user.id ?? newSession?.user.id;
          if (userId) {
            await membersCollection(getDb()).updateOne(
              { _id: userId },
              { $set: { mustChangePassword: false, updatedAt: new Date() } },
            );
          }
        }
      }),
    },

    plugins: [
      username({
        minUsernameLength: STORED_USERNAME_MIN,
        maxUsernameLength: STORED_USERNAME_MAX,
        // Checked after lowercasing: "<6 digits>:<a-z 0-9 _ .>".
        validationOrder: { username: "post-normalization", displayUsername: "post-normalization" },
        // Sign-in validates the raw input, so accept any case here; stored
        // usernames are lowercased by the plugin's normalization.
        usernameValidator: (value) => isCompositeUsername(value.toLowerCase()),
        displayUsernameNormalization: (value) => value.trim().toLowerCase(),
        displayUsernameValidator: isLocalUsername,
      }),
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
