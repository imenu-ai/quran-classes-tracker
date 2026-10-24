import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "@qct/core/i18n/config";

/**
 * The app's locale. Only `ar` is enabled for now (PLAN.md §0 #9); sign-in
 * (2.6) takes it from the user's saved session. Direction is fixed when the
 * app starts (§0 #53), so a change of locale reloads the app.
 */
export const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export const useAppLocale = () => useContext(LocaleContext);
