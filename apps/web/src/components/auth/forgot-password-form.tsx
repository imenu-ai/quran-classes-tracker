"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/client/auth/auth-client";
import { emailSchema } from "@/shared/access";
import { parseWithCodes } from "@/shared/schemas/errors";
import { useErrorMessage } from "@/i18n/use-error-message";

/**
 * Asks for a reset link. The answer is the same whether or not the email is
 * registered, so the page never reveals who has an account.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseWithCodes(
      emailSchema,
      String(new FormData(event.currentTarget).get("email") ?? ""),
    );
    if (!parsed.success) return setError(parsed.errors[0] ? errorMessage(parsed.errors[0]) : null);
    setError(null);
    setBusy(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: parsed.data,
        redirectTo: "/reset-password",
      });
      if (result.error?.status === 429) return setError(t("errors.rateLimited"));
      if (result.error && !result.error.status) return setError(t("errors.offline"));
      setSent(true);
    } catch {
      setError(t(navigator.onLine ? "errors.generic" : "errors.offline"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {sent ? (
        <p role="status" className="rounded-lg bg-primary/10 px-3 py-3 text-sm">
          {t("forgot.sent")}
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={id}>{t("forgot.email")}</FieldLabel>
            <Input
              id={id}
              name="email"
              type="email"
              dir="auto"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className="h-12"
              aria-invalid={error ? true : undefined}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
            {t("forgot.submit")}
          </Button>
        </form>
      )}
      <p className="text-center text-sm text-muted-foreground">{t("forgot.teachersHint")}</p>
      <Link
        href="/login"
        className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("forgot.backToLogin")}
      </Link>
    </div>
  );
}
