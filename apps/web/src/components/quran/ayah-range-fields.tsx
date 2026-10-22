"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AyahRangeDraft, AyahRangeErrors, AyahRangeField } from "@/client/forms/ayah-range";
import { getAyahCount } from "@/domain/quran/surahs";
import { useErrorMessage } from "@/i18n/use-error-message";
import { SurahPicker } from "./surah-picker";

/**
 * Sura + from/to ayah inputs with the allowed range shown ("من 1 إلى 286"),
 * input limited to that many digits, and localized errors as soon as a value
 * is invalid. `visibleErrors` decides which fields show their error (touched
 * fields, or all after a submit attempt).
 */
export function AyahRangeFields({
  value,
  onChange,
  errors,
  visibleErrors,
}: {
  value: AyahRangeDraft;
  onChange: (next: AyahRangeDraft, changed: AyahRangeField) => void;
  errors: AyahRangeErrors;
  visibleErrors: ReadonlySet<AyahRangeField>;
}) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const ids = { surah: useId(), from: useId(), to: useId(), hint: useId() };
  const ayahCount = value.surah ? getAyahCount(value.surah) : undefined;
  const maxDigits = ayahCount ? String(ayahCount).length : 3;

  const shown = (field: AyahRangeField) => (visibleErrors.has(field) ? errors[field] : undefined);
  const error = (field: AyahRangeField) => {
    const fieldError = shown(field);
    return fieldError ? <FieldError>{errorMessage(fieldError)}</FieldError> : null;
  };

  const ayahInput = (field: "fromAyah" | "toAyah", key: "from" | "to", id: string) => (
    <Field data-invalid={shown(field) ? true : undefined}>
      <FieldLabel htmlFor={id}>{t(`glossary.${field}`)}</FieldLabel>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        maxLength={maxDigits}
        className="h-12 text-center text-lg"
        aria-describedby={ayahCount ? ids.hint : undefined}
        aria-invalid={shown(field) ? true : undefined}
        value={value[key]}
        onChange={(event) => onChange({ ...value, [key]: event.target.value }, field)}
      />
      {error(field)}
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      <Field data-invalid={shown("surah") ? true : undefined}>
        <FieldLabel htmlFor={ids.surah}>{t("glossary.surah")}</FieldLabel>
        <SurahPicker
          id={ids.surah}
          value={value.surah}
          invalid={Boolean(shown("surah"))}
          onChange={(surah) => onChange({ ...value, surah }, "surah")}
        />
        {error("surah")}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        {ayahInput("fromAyah", "from", ids.from)}
        {ayahInput("toAyah", "to", ids.to)}
      </div>
      {ayahCount && (
        <FieldDescription id={ids.hint} className="-mt-2">
          {t("quran.ayahRangeHint", { ayahCount })}
        </FieldDescription>
      )}
    </div>
  );
}
