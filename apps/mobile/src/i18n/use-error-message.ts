import { useCallback } from "react";
import { useTranslations } from "use-intl";
import { translateError, type ErrorsTranslator } from "@qct/core/i18n/error-message";
import type { FieldError } from "@qct/core/shared/schemas/errors";
import { useAppLocale } from "./locale";

/** Returns a function that turns an error code from the domain or a schema into text. */
export function useErrorMessage() {
  const t = useTranslations("errors") as unknown as ErrorsTranslator;
  const locale = useAppLocale();
  return useCallback(
    (error: Pick<FieldError, "code" | "params">) => translateError(t, error, locale),
    [t, locale],
  );
}
