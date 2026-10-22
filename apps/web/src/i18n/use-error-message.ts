"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";
import type { FieldError } from "@/shared/schemas/errors";
import { toAppLocale } from "./config";
import { translateError, type ErrorsTranslator } from "./error-message";

/** Returns a function that turns a {@link FieldError} into localized text. */
export function useErrorMessage() {
  const t = useTranslations("errors") as unknown as ErrorsTranslator;
  const locale = toAppLocale(useLocale());
  return useCallback(
    (error: Pick<FieldError, "code" | "params">) => translateError(t, error, locale),
    [t, locale],
  );
}
