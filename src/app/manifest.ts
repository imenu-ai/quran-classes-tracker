import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getDirection } from "@/i18n/direction";

/** Web app manifest (Add to Home Screen / install). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations({ locale: DEFAULT_LOCALE, namespace: "app" });
  return {
    name: t("name"),
    short_name: t("shortName"),
    description: t("description"),
    lang: DEFAULT_LOCALE,
    dir: getDirection(DEFAULT_LOCALE),
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fcfefd",
    theme_color: "#057558",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
