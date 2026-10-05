import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Lets a second dev/test server run next to `pnpm dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The floating dev badge sits on top of the mobile bottom navigation.
  devIndicators: false,
  // Native argon2 binding: load it from node_modules at runtime, don't bundle it.
  serverExternalPackages: ["@node-rs/argon2"],
};

export default withNextIntl(nextConfig);
