import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import {
  expoClient,
  getSetCookie,
  hasBetterAuthCookies,
  storageAdapter,
} from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { MOBILE_APP_SCHEME } from "@qct/core/shared/access";
import { API_URL } from "@/config";

/** The server's cookie names start with this (apps/web auth: `cookiePrefix`). */
const COOKIE_PREFIX = "qct";
/** Where the Expo plugin keeps the cookies: `<storagePrefix>_cookie`. */
const STORAGE_PREFIX = "qct";
const COOKIE_KEY = `${STORAGE_PREFIX}_cookie`;

/**
 * The session lives in the phone's secure storage (Keychain / Keystore).
 * One wrapper (chunking, serialized writes) shared by the auth client and
 * our own API calls, so both write the cookie the same way.
 */
const cookieStorage = storageAdapter(SecureStore);

/** Better Auth against the web app's /api/auth, with the session cookie in a header. */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    usernameClient(),
    expoClient({
      scheme: MOBILE_APP_SCHEME,
      storagePrefix: STORAGE_PREFIX,
      cookiePrefix: COOKIE_PREFIX,
      storage: cookieStorage,
    }),
  ],
});

/**
 * fetch for our own routes (/api/me, sync, …): sends the stored session
 * cookie and keeps a renewed one (withTenant forwards Better Auth's daily
 * renewal), so a user who only syncs stays signed in.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const cookie = await authClient.getCookie();
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "omit" });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie && hasBetterAuthCookies(setCookie, COOKIE_PREFIX)) {
    const previous = await cookieStorage.getItemAsync(COOKIE_KEY);
    await cookieStorage.setItemAsync(COOKIE_KEY, getSetCookie(setCookie, previous ?? undefined));
  }
  return response;
}

/** Forgets the stored session cookie (signing out, or a session the server ended). */
export async function clearStoredCookie(): Promise<void> {
  await cookieStorage.setItemAsync(COOKIE_KEY, "{}");
}
