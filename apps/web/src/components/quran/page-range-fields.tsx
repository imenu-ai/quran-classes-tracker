"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { usePortionLabel } from "@/components/homework/use-portion-label";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PAGE_COUNT } from "@qct/core/domain/quran/pages";
import type { PageRangeCheck, PageRangeDraft, PageRangeField } from "@qct/core/forms/pages";
import { useErrorMessage } from "@/i18n/use-error-message";

/**
 * From page / to page of the Madinah Mushaf (1–604), with the suras and
 * ayahs those pages hold shown underneath once the range is valid.
 */
export function PageRangeFields({
  value,
  onChange,
  check,
  visibleErrors,
}: {
  value: PageRangeDraft;
  onChange: (next: PageRangeDraft, changed: PageRangeField) => void;
  check: PageRangeCheck;
  visibleErrors: ReadonlySet<PageRangeField>;
}) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const label = usePortionLabel();
  const ids = { from: useId(), to: useId(), hint: useId() };

  const input = (field: PageRangeField, key: "from" | "to", id: string) => {
    const error = visibleErrors.has(field) ? check.errors[field] : undefined;
    return (
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={id}>{t(`homework.${field}`)}</FieldLabel>
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          maxLength={3}
          className="h-12 text-center text-lg"
          aria-describedby={ids.hint}
          aria-invalid={error ? true : undefined}
          value={value[key]}
          onChange={(event) => onChange({ ...value, [key]: event.target.value }, field)}
        />
        {error && <FieldError>{errorMessage(error)}</FieldError>}
      </Field>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {input("fromPage", "from", ids.from)}
        {input("toPage", "to", ids.to)}
      </div>
      <FieldDescription id={ids.hint} className="-mt-1">
        {t("homework.pagesHint", { pageCount: PAGE_COUNT })}
      </FieldDescription>
      {check.ok && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <bdi>{t("homework.pagesPreview", { portions: label({ portions: check.portions }) })}</bdi>
        </p>
      )}
    </div>
  );
}
