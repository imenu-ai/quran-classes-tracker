import type { ReactNode } from "react";
import { IntlProvider } from "use-intl";
import ar from "@qct/core/messages/ar.json";
import en from "@qct/core/messages/en.json";
import { DEFAULT_TIME_ZONE, getIntlLocale, type Locale } from "@qct/core/i18n/config";
import { formats } from "@qct/core/i18n/formats";
import { LocaleContext } from "./locale";

const MESSAGES = { ar, en } satisfies Record<Locale, unknown>;

/** The shared messages and named formats, through use-intl (the core of next-intl). */
export function AppIntlProvider({
  locale,
  timeZone = DEFAULT_TIME_ZONE,
  children,
}: Readonly<{ locale: Locale; timeZone?: string; children: ReactNode }>) {
  return (
    <LocaleContext.Provider value={locale}>
      <IntlProvider
        locale={getIntlLocale(locale)}
        messages={MESSAGES[locale]}
        formats={formats}
        timeZone={timeZone}
      >
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}
