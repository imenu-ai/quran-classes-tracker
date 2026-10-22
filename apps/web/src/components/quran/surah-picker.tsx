"use client";

import { BookOpen, ChevronsUpDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { searchSurahs } from "@/domain/quran/search";
import { getSurah, getSurahName } from "@/domain/quran/surahs";
import { toAppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** "2 · البقرة · 286 آية", from the sura map (never free text). */
export function useSurahLabel() {
  const t = useTranslations("quran");
  const locale = toAppLocale(useLocale());
  return (number: number) => {
    const surah = getSurah(number);
    if (!surah) return String(number);
    return t("surahOption", {
      number: surah.number,
      name: getSurahName(surah.number, locale) ?? "",
      ayahs: t("ayahs", { count: surah.ayahCount }),
    });
  };
}

/**
 * Sura chooser in a bottom sheet: search by name (active locale + Arabic,
 * forgiving of hamza/tashkeel) or by number.
 */
export function SurahPicker({
  id,
  value,
  onChange,
  invalid,
}: {
  id?: string;
  value: number | null;
  onChange: (surah: number) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("homework");
  const locale = toAppLocale(useLocale());
  const label = useSurahLabel();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchSurahs(query, locale), [query, locale]);

  return (
    <>
      <Button
        id={id}
        type="button"
        variant="outline"
        className={cn(
          "h-12 w-full justify-between text-base font-normal",
          !value && "text-muted-foreground",
        )}
        aria-invalid={invalid || undefined}
        aria-haspopup="dialog"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <BookOpen aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{value ? label(value) : t("pickSurah")}</span>
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 opacity-60" />
      </Button>

      <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
        <DrawerContent className="h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle>{t("pickSurah")}</DrawerTitle>
          </DrawerHeader>
          {/* Filtering is ours (searchSurahs), not cmdk's. */}
          <Command shouldFilter={false} className="min-h-0 flex-1 px-2 pb-2">
            <CommandInput
              dir="auto"
              value={query}
              onValueChange={setQuery}
              placeholder={t("searchSurah")}
              aria-label={t("searchSurah")}
            />
            <CommandList className="max-h-none flex-1">
              <CommandEmpty>{t("noSurah")}</CommandEmpty>
              {results.map((surah) => (
                <CommandItem
                  key={surah.number}
                  value={String(surah.number)}
                  className="min-h-11 text-base"
                  data-checked={surah.number === value || undefined}
                  onSelect={() => {
                    onChange(surah.number);
                    setOpen(false);
                  }}
                >
                  {label(surah.number)}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DrawerContent>
      </Drawer>
    </>
  );
}
