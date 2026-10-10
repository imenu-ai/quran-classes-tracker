"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getAccountErrorKey } from "@/client/auth/account-errors";
import { authClient } from "@/client/auth/auth-client";
import { cn } from "@/lib/utils";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/shared/access";

type PasswordField = "current" | "next" | "confirm";

/**
 * Current + new + confirm. Used in Settings and for the forced change after
 * an admin set the password. The server rate-limits it and checks the
 * current password.
 */
export function PasswordForm({
  submitLabel,
  onChanged,
  wide = false,
}: {
  submitLabel: string;
  onChanged: () => void | Promise<void>;
  /** A full-width submit button (stand-alone page). */
  wide?: boolean;
}) {
  const t = useTranslations("settings");
  const ids = { current: useId(), next: useId(), confirm: useId() };
  const [error, setError] = useState<{ field?: PasswordField; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("current") ?? "");
    const newPassword = String(data.get("next") ?? "");
    const confirm = String(data.get("confirm") ?? "");

    if (!currentPassword)
      return setError({ field: "current", message: t("accountErrors.wrongPassword") });
    if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
      return setError({ field: "next", message: t("accountErrors.passwordLength") });
    }
    if (newPassword !== confirm)
      return setError({ field: "confirm", message: t("passwordsDontMatch") });

    setError(null);
    setBusy(true);
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword });
      if (result.error) {
        const key = getAccountErrorKey(result.error, navigator.onLine);
        setError({
          field:
            key === "wrongPassword" ? "current" : key === "passwordLength" ? "next" : undefined,
          message: t(`accountErrors.${key}`),
        });
        return;
      }
      form.reset();
      await onChanged();
    } catch {
      setError({ message: t(`accountErrors.${getAccountErrorKey(null, navigator.onLine)}`) });
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (field: PasswordField) =>
    error?.field === field ? <FieldError>{error.message}</FieldError> : null;
  const passwordInput = (field: PasswordField, id: string, autoComplete: string) => (
    <Input
      id={id}
      name={field}
      type="password"
      autoComplete={autoComplete}
      className="h-12"
      maxLength={PASSWORD_MAX}
      aria-invalid={error?.field === field ? true : undefined}
    />
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field data-invalid={error?.field === "current" ? true : undefined}>
        <FieldLabel htmlFor={ids.current}>{t("currentPassword")}</FieldLabel>
        {passwordInput("current", ids.current, "current-password")}
        {fieldError("current")}
      </Field>
      <Field data-invalid={error?.field === "next" ? true : undefined}>
        <FieldLabel htmlFor={ids.next}>{t("newPassword")}</FieldLabel>
        {passwordInput("next", ids.next, "new-password")}
        <FieldDescription>{t("passwordLengthHint")}</FieldDescription>
        {fieldError("next")}
      </Field>
      <Field data-invalid={error?.field === "confirm" ? true : undefined}>
        <FieldLabel htmlFor={ids.confirm}>{t("confirmPassword")}</FieldLabel>
        {passwordInput("confirm", ids.confirm, "new-password")}
        {fieldError("confirm")}
      </Field>
      {error && !error.field && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error.message}
        </p>
      )}
      <Button
        type="submit"
        className={cn("h-11", wide ? "h-12 w-full text-base" : "self-start")}
        disabled={busy}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
