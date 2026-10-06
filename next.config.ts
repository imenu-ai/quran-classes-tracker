import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Changes on every commit, so the precached offline page is refreshed.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  // Cache each page shell the teacher opens (client-side navigations too).
  cacheOnNavigation: true,
  // Never reload by itself when the connection returns (mid-lesson).
  reloadOnOnline: false,
  // The service worker would cache stale dev bundles.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Lets a second dev/test server run next to `pnpm dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The floating dev badge sits on top of the mobile bottom navigation.
  devIndicators: false,
  // Native argon2 binding: load it from node_modules at runtime, don't bundle it.
  serverExternalPackages: ["@node-rs/argon2"],
};

export default withSerwist(withNextIntl(nextConfig));
