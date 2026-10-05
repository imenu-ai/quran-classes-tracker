import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // The floating dev badge sits on top of the mobile bottom navigation.
  devIndicators: false,
  // Native argon2 binding: load it from node_modules at runtime, don't bundle it.
  serverExternalPackages: ["@node-rs/argon2"],
};

export default withNextIntl(nextConfig);
