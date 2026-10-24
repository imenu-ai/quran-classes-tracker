// What Hermes lacks (PLAN.md §2.13), each polyfilled only where missing:
// Arabic plurals (Intl.PluralRules), Intl.Locale, relative times, the time
// zone list (Intl.supportedValuesOf) and crypto.getRandomValues (uuid).
// DateTimeFormat and NumberFormat are native and need nothing.
import "@formatjs/intl-getcanonicallocales/polyfill.js";
import "@formatjs/intl-locale/polyfill.js";
import "@formatjs/intl-pluralrules/polyfill.js";
import "@formatjs/intl-pluralrules/locale-data/ar.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-relativetimeformat/polyfill.js";
import "@formatjs/intl-relativetimeformat/locale-data/ar.js";
import "@formatjs/intl-relativetimeformat/locale-data/en.js";
import "@formatjs/intl-enumerator/polyfill.js";
import { getRandomValues } from "expo-crypto";

const g = globalThis as { crypto?: { getRandomValues?: unknown } };
g.crypto ??= {};
g.crypto.getRandomValues ??= getRandomValues;
