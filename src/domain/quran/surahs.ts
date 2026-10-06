/**
 * Sura map (خريطة السور): the single source of truth for every sura and ayah
 * number in the app. Hafs ʿan ʿĀṣim numbering, as printed in the Madani mushaf
 * (114 suras, 6236 ayahs). Pure domain data: no React, no DB, no UI text.
 *
 * Sura names are domain data keyed by locale; they intentionally do not live
 * in the i18n message files.
 */

export interface SurahNames {
  readonly ar: string;
  readonly en: string;
}

export type SurahNameLocale = keyof SurahNames;

export interface Surah {
  readonly number: number;
  readonly names: SurahNames;
  readonly ayahCount: number;
}

export const SURAH_COUNT = 114;

export const SURAH_NAME_LOCALES: readonly SurahNameLocale[] = ["ar", "en"];

export function isSurahNameLocale(locale: string): locale is SurahNameLocale {
  return (SURAH_NAME_LOCALES as readonly string[]).includes(locale);
}

/** The locale used when a sura has no name in the requested locale. */
export const SURAH_NAME_FALLBACK_LOCALE: SurahNameLocale = "ar";

// prettier-ignore
const SURAH_DATA = [
  { number: 1, names: { ar: "الفاتحة", en: "Al-Fatihah" }, ayahCount: 7 },
  { number: 2, names: { ar: "البقرة", en: "Al-Baqarah" }, ayahCount: 286 },
  { number: 3, names: { ar: "آل عمران", en: "Al-Imran" }, ayahCount: 200 },
  { number: 4, names: { ar: "النساء", en: "An-Nisa" }, ayahCount: 176 },
  { number: 5, names: { ar: "المائدة", en: "Al-Ma'idah" }, ayahCount: 120 },
  { number: 6, names: { ar: "الأنعام", en: "Al-An'am" }, ayahCount: 165 },
  { number: 7, names: { ar: "الأعراف", en: "Al-A'raf" }, ayahCount: 206 },
  { number: 8, names: { ar: "الأنفال", en: "Al-Anfal" }, ayahCount: 75 },
  { number: 9, names: { ar: "التوبة", en: "At-Tawbah" }, ayahCount: 129 },
  { number: 10, names: { ar: "يونس", en: "Yunus" }, ayahCount: 109 },
  { number: 11, names: { ar: "هود", en: "Hud" }, ayahCount: 123 },
  { number: 12, names: { ar: "يوسف", en: "Yusuf" }, ayahCount: 111 },
  { number: 13, names: { ar: "الرعد", en: "Ar-Ra'd" }, ayahCount: 43 },
  { number: 14, names: { ar: "إبراهيم", en: "Ibrahim" }, ayahCount: 52 },
  { number: 15, names: { ar: "الحجر", en: "Al-Hijr" }, ayahCount: 99 },
  { number: 16, names: { ar: "النحل", en: "An-Nahl" }, ayahCount: 128 },
  { number: 17, names: { ar: "الإسراء", en: "Al-Isra" }, ayahCount: 111 },
  { number: 18, names: { ar: "الكهف", en: "Al-Kahf" }, ayahCount: 110 },
  { number: 19, names: { ar: "مريم", en: "Maryam" }, ayahCount: 98 },
  { number: 20, names: { ar: "طه", en: "Ta-Ha" }, ayahCount: 135 },
  { number: 21, names: { ar: "الأنبياء", en: "Al-Anbiya" }, ayahCount: 112 },
  { number: 22, names: { ar: "الحج", en: "Al-Hajj" }, ayahCount: 78 },
  { number: 23, names: { ar: "المؤمنون", en: "Al-Mu'minun" }, ayahCount: 118 },
  { number: 24, names: { ar: "النور", en: "An-Nur" }, ayahCount: 64 },
  { number: 25, names: { ar: "الفرقان", en: "Al-Furqan" }, ayahCount: 77 },
  { number: 26, names: { ar: "الشعراء", en: "Ash-Shu'ara" }, ayahCount: 227 },
  { number: 27, names: { ar: "النمل", en: "An-Naml" }, ayahCount: 93 },
  { number: 28, names: { ar: "القصص", en: "Al-Qasas" }, ayahCount: 88 },
  { number: 29, names: { ar: "العنكبوت", en: "Al-Ankabut" }, ayahCount: 69 },
  { number: 30, names: { ar: "الروم", en: "Ar-Rum" }, ayahCount: 60 },
  { number: 31, names: { ar: "لقمان", en: "Luqman" }, ayahCount: 34 },
  { number: 32, names: { ar: "السجدة", en: "As-Sajdah" }, ayahCount: 30 },
  { number: 33, names: { ar: "الأحزاب", en: "Al-Ahzab" }, ayahCount: 73 },
  { number: 34, names: { ar: "سبأ", en: "Saba" }, ayahCount: 54 },
  { number: 35, names: { ar: "فاطر", en: "Fatir" }, ayahCount: 45 },
  { number: 36, names: { ar: "يس", en: "Ya-Sin" }, ayahCount: 83 },
  { number: 37, names: { ar: "الصافات", en: "As-Saffat" }, ayahCount: 182 },
  { number: 38, names: { ar: "ص", en: "Sad" }, ayahCount: 88 },
  { number: 39, names: { ar: "الزمر", en: "Az-Zumar" }, ayahCount: 75 },
  { number: 40, names: { ar: "غافر", en: "Ghafir" }, ayahCount: 85 },
  { number: 41, names: { ar: "فصلت", en: "Fussilat" }, ayahCount: 54 },
  { number: 42, names: { ar: "الشورى", en: "Ash-Shura" }, ayahCount: 53 },
  { number: 43, names: { ar: "الزخرف", en: "Az-Zukhruf" }, ayahCount: 89 },
  { number: 44, names: { ar: "الدخان", en: "Ad-Dukhan" }, ayahCount: 59 },
  { number: 45, names: { ar: "الجاثية", en: "Al-Jathiyah" }, ayahCount: 37 },
  { number: 46, names: { ar: "الأحقاف", en: "Al-Ahqaf" }, ayahCount: 35 },
  { number: 47, names: { ar: "محمد", en: "Muhammad" }, ayahCount: 38 },
  { number: 48, names: { ar: "الفتح", en: "Al-Fath" }, ayahCount: 29 },
  { number: 49, names: { ar: "الحجرات", en: "Al-Hujurat" }, ayahCount: 18 },
  { number: 50, names: { ar: "ق", en: "Qaf" }, ayahCount: 45 },
  { number: 51, names: { ar: "الذاريات", en: "Adh-Dhariyat" }, ayahCount: 60 },
  { number: 52, names: { ar: "الطور", en: "At-Tur" }, ayahCount: 49 },
  { number: 53, names: { ar: "النجم", en: "An-Najm" }, ayahCount: 62 },
  { number: 54, names: { ar: "القمر", en: "Al-Qamar" }, ayahCount: 55 },
  { number: 55, names: { ar: "الرحمن", en: "Ar-Rahman" }, ayahCount: 78 },
  { number: 56, names: { ar: "الواقعة", en: "Al-Waqi'ah" }, ayahCount: 96 },
  { number: 57, names: { ar: "الحديد", en: "Al-Hadid" }, ayahCount: 29 },
  { number: 58, names: { ar: "المجادلة", en: "Al-Mujadilah" }, ayahCount: 22 },
  { number: 59, names: { ar: "الحشر", en: "Al-Hashr" }, ayahCount: 24 },
  { number: 60, names: { ar: "الممتحنة", en: "Al-Mumtahanah" }, ayahCount: 13 },
  { number: 61, names: { ar: "الصف", en: "As-Saff" }, ayahCount: 14 },
  { number: 62, names: { ar: "الجمعة", en: "Al-Jumu'ah" }, ayahCount: 11 },
  { number: 63, names: { ar: "المنافقون", en: "Al-Munafiqun" }, ayahCount: 11 },
  { number: 64, names: { ar: "التغابن", en: "At-Taghabun" }, ayahCount: 18 },
  { number: 65, names: { ar: "الطلاق", en: "At-Talaq" }, ayahCount: 12 },
  { number: 66, names: { ar: "التحريم", en: "At-Tahrim" }, ayahCount: 12 },
  { number: 67, names: { ar: "الملك", en: "Al-Mulk" }, ayahCount: 30 },
  { number: 68, names: { ar: "القلم", en: "Al-Qalam" }, ayahCount: 52 },
  { number: 69, names: { ar: "الحاقة", en: "Al-Haqqah" }, ayahCount: 52 },
  { number: 70, names: { ar: "المعارج", en: "Al-Ma'arij" }, ayahCount: 44 },
  { number: 71, names: { ar: "نوح", en: "Nuh" }, ayahCount: 28 },
  { number: 72, names: { ar: "الجن", en: "Al-Jinn" }, ayahCount: 28 },
  { number: 73, names: { ar: "المزمل", en: "Al-Muzzammil" }, ayahCount: 20 },
  { number: 74, names: { ar: "المدثر", en: "Al-Muddaththir" }, ayahCount: 56 },
  { number: 75, names: { ar: "القيامة", en: "Al-Qiyamah" }, ayahCount: 40 },
  { number: 76, names: { ar: "الإنسان", en: "Al-Insan" }, ayahCount: 31 },
  { number: 77, names: { ar: "المرسلات", en: "Al-Mursalat" }, ayahCount: 50 },
  { number: 78, names: { ar: "النبأ", en: "An-Naba" }, ayahCount: 40 },
  { number: 79, names: { ar: "النازعات", en: "An-Nazi'at" }, ayahCount: 46 },
  { number: 80, names: { ar: "عبس", en: "Abasa" }, ayahCount: 42 },
  { number: 81, names: { ar: "التكوير", en: "At-Takwir" }, ayahCount: 29 },
  { number: 82, names: { ar: "الانفطار", en: "Al-Infitar" }, ayahCount: 19 },
  { number: 83, names: { ar: "المطففين", en: "Al-Mutaffifin" }, ayahCount: 36 },
  { number: 84, names: { ar: "الانشقاق", en: "Al-Inshiqaq" }, ayahCount: 25 },
  { number: 85, names: { ar: "البروج", en: "Al-Buruj" }, ayahCount: 22 },
  { number: 86, names: { ar: "الطارق", en: "At-Tariq" }, ayahCount: 17 },
  { number: 87, names: { ar: "الأعلى", en: "Al-A'la" }, ayahCount: 19 },
  { number: 88, names: { ar: "الغاشية", en: "Al-Ghashiyah" }, ayahCount: 26 },
  { number: 89, names: { ar: "الفجر", en: "Al-Fajr" }, ayahCount: 30 },
  { number: 90, names: { ar: "البلد", en: "Al-Balad" }, ayahCount: 20 },
  { number: 91, names: { ar: "الشمس", en: "Ash-Shams" }, ayahCount: 15 },
  { number: 92, names: { ar: "الليل", en: "Al-Layl" }, ayahCount: 21 },
  { number: 93, names: { ar: "الضحى", en: "Ad-Duha" }, ayahCount: 11 },
  { number: 94, names: { ar: "الشرح", en: "Ash-Sharh" }, ayahCount: 8 },
  { number: 95, names: { ar: "التين", en: "At-Tin" }, ayahCount: 8 },
  { number: 96, names: { ar: "العلق", en: "Al-Alaq" }, ayahCount: 19 },
  { number: 97, names: { ar: "القدر", en: "Al-Qadr" }, ayahCount: 5 },
  { number: 98, names: { ar: "البينة", en: "Al-Bayyinah" }, ayahCount: 8 },
  { number: 99, names: { ar: "الزلزلة", en: "Az-Zalzalah" }, ayahCount: 8 },
  { number: 100, names: { ar: "العاديات", en: "Al-Adiyat" }, ayahCount: 11 },
  { number: 101, names: { ar: "القارعة", en: "Al-Qari'ah" }, ayahCount: 11 },
  { number: 102, names: { ar: "التكاثر", en: "At-Takathur" }, ayahCount: 8 },
  { number: 103, names: { ar: "العصر", en: "Al-Asr" }, ayahCount: 3 },
  { number: 104, names: { ar: "الهمزة", en: "Al-Humazah" }, ayahCount: 9 },
  { number: 105, names: { ar: "الفيل", en: "Al-Fil" }, ayahCount: 5 },
  { number: 106, names: { ar: "قريش", en: "Quraysh" }, ayahCount: 4 },
  { number: 107, names: { ar: "الماعون", en: "Al-Ma'un" }, ayahCount: 7 },
  { number: 108, names: { ar: "الكوثر", en: "Al-Kawthar" }, ayahCount: 3 },
  { number: 109, names: { ar: "الكافرون", en: "Al-Kafirun" }, ayahCount: 6 },
  { number: 110, names: { ar: "النصر", en: "An-Nasr" }, ayahCount: 3 },
  { number: 111, names: { ar: "المسد", en: "Al-Masad" }, ayahCount: 5 },
  { number: 112, names: { ar: "الإخلاص", en: "Al-Ikhlas" }, ayahCount: 4 },
  { number: 113, names: { ar: "الفلق", en: "Al-Falaq" }, ayahCount: 5 },
  { number: 114, names: { ar: "الناس", en: "An-Nas" }, ayahCount: 6 },
] as const satisfies readonly Surah[];

/** All 114 suras, ordered by number (index = number − 1). */
export const SURAHS: readonly Surah[] = Object.freeze(
  SURAH_DATA.map((surah) => Object.freeze({ ...surah, names: Object.freeze({ ...surah.names }) })),
);

/** O(1) lookup by sura number. */
export const SURAH_MAP: ReadonlyMap<number, Surah> = new Map(
  SURAHS.map((surah) => [surah.number, surah]),
);

export function isValidSurah(number: unknown): number is number {
  return (
    typeof number === "number" && Number.isInteger(number) && number >= 1 && number <= SURAH_COUNT
  );
}

export function getSurah(number: number): Surah | undefined {
  return SURAH_MAP.get(number);
}

export function getAyahCount(number: number): number | undefined {
  return SURAH_MAP.get(number)?.ayahCount;
}

/**
 * The sura's name in `locale`, falling back to Arabic when that locale has no
 * name. Returns `undefined` for an unknown sura number.
 */
export function getSurahName(number: number, locale: string): string | undefined {
  const surah = SURAH_MAP.get(number);
  if (!surah) return undefined;
  const name = isSurahNameLocale(locale) ? surah.names[locale] : undefined;
  return name || surah.names[SURAH_NAME_FALLBACK_LOCALE];
}
