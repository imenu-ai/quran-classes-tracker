/**
 * The server the app talks to: the web app's origin (its /api routes). Set
 * EXPO_PUBLIC_API_URL in apps/mobile/.env.local for development (see
 * .env.example) and per build profile in eas.json. Metro inlines it at build
 * time, so a change needs a restart of Metro.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

if (!API_URL && __DEV__) {
  console.warn("EXPO_PUBLIC_API_URL is not set: sign-in and sync can't reach the server.");
}
