import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_TIME_ZONE,
  getIntlLocale,
  LOCALE_COOKIE,
  parseEnabledLocales,
  resolveLocale,
  type Locale,
} from "@qct/core/i18n/config";
import { formats } from "@qct/core/i18n/formats";

const MESSAGES = {
  ar: () => import("@qct/core/messages/ar.json"),
  en: () => import("@qct/core/messages/en.json"),
} satisfies Record<Locale, unknown>;

const loadMessages = async (locale: Locale) => (await MESSAGES[locale]()).default;

/**
 * Locale resolution (no locale in the URL):
 * `NEXT_LOCALE` cookie → only if listed in `ENABLED_LOCALES` → else `ar`.
 * The cookie is set from `user.locale` at login.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const enabled = parseEnabledLocales(process.env.ENABLED_LOCALES);
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value, enabled);

  return {
    locale: getIntlLocale(locale),
    messages: await loadMessages(locale),
    timeZone: DEFAULT_TIME_ZONE,
    formats,
  };
});
