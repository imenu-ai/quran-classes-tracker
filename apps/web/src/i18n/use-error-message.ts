"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import type { FieldError } from "@qct/core/shared/schemas/errors";
import { toAppLocale } from "@qct/core/i18n/config";
import { translateError, type ErrorsTranslator } from "@qct/core/i18n/error-message";

/** Returns a function that turns a {@link FieldError} into localized text. */
export function useErrorMessage() {
  const t = useTranslations("errors") as unknown as ErrorsTranslator;
  const locale = toAppLocale(useLocale());
  return useCallback(
    (error: Pick<FieldError, "code" | "params">) => translateError(t, error, locale),
    [t, locale],
  );
}
