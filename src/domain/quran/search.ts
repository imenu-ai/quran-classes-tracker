import {
  isSurahNameLocale,
  SURAH_NAME_FALLBACK_LOCALE,
  SURAHS,
  type Surah,
  type SurahNameLocale,
} from "./surahs";

// Harakat and Quranic annotation marks: U+0610–U+061A, U+064B–U+065F,
// superscript alef U+0670, U+06D6–U+06ED.
const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const ALEF_VARIANTS = /[\u0622\u0623\u0625\u0671]/g; // alef with madda, hamza above, hamza below, wasla
const TEH_MARBUTA = /\u0629/g;
const ALEF_MAKSURA = /\u0649/g;
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
// Spaces, hyphens, apostrophes and other punctuation are ignored when matching,
// so "al baqara", "Al-Baqarah" and "ال بقرة" all compare loosely.
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]/gu;

/**
 * Normalizes text for forgiving search (Arabic and Latin):
 * strips tashkeel and tatweel; folds أ/إ/آ/ٱ → ا, ة → ه, ى → ي;
 * converts Arabic-Indic digits to 0–9; lowercases; drops spaces and punctuation.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(ALEF_VARIANTS, "\u0627")
    .replace(TEH_MARBUTA, "\u0647")
    .replace(ALEF_MAKSURA, "\u064A")
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, "");
}

const ARABIC_DEFINITE_ARTICLE = "\u0627\u0644"; // "al-"

interface IndexedSurah {
  surah: Surah;
  number: string;
  names: Partial<Record<SurahNameLocale, string>>;
}

const INDEX: readonly IndexedSurah[] = SURAHS.map((surah) => ({
  surah,
  number: String(surah.number),
  names: Object.fromEntries(
    Object.entries(surah.names).map(([locale, name]) => [locale, normalizeForSearch(name)]),
  ),
}));

/** 0 = best match. `undefined` = no match. */
function rankName(name: string, query: string): number | undefined {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  // "بقره" should rank "البقره" as a prefix match.
  if (name.startsWith(ARABIC_DEFINITE_ARTICLE) && name.slice(2).startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  return undefined;
}

/**
 * Searches suras by number or by name. Names are matched in the active
 * locale and always in Arabic. An empty query returns every sura in order.
 * Results are ranked (exact, then prefix, then substring) and then by number.
 */
export function searchSurahs(query: string, locale: string): readonly Surah[] {
  const normalized = normalizeForSearch(query);
  if (normalized === "") return SURAHS;

  const locales = new Set<SurahNameLocale>([SURAH_NAME_FALLBACK_LOCALE]);
  if (isSurahNameLocale(locale)) locales.add(locale);

  const ranked: { surah: Surah; rank: number }[] = [];
  for (const entry of INDEX) {
    let best: number | undefined;
    if (/^\d+$/.test(normalized)) {
      if (entry.number === normalized) best = 0;
      else if (entry.number.startsWith(normalized)) best = 1;
    } else {
      for (const nameLocale of locales) {
        const name = entry.names[nameLocale];
        const rank = name === undefined ? undefined : rankName(name, normalized);
        if (rank !== undefined && (best === undefined || rank < best)) best = rank;
      }
    }
    if (best !== undefined) ranked.push({ surah: entry.surah, rank: best });
  }

  return ranked
    .sort((a, b) => a.rank - b.rank || a.surah.number - b.surah.number)
    .map((r) => r.surah);
}
