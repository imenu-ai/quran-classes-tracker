"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getAccountErrorKey } from "@/client/auth/account-errors";
import { authClient } from "@/client/auth/auth-client";

const MIN = 8;
const MAX = 128;

/** Change password: the current password is required (and rate limited on the server). */
export function PasswordSection() {
  const t = useTranslations("settings");
  const ids = { current: useId(), next: useId(), confirm: useId() };
  const [error, setError] = useState<{
    field?: "current" | "next" | "confirm";
    message: string;
  } | null>(null);
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
    if (newPassword.length < MIN || newPassword.length > MAX) {
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
      toast.success(t("passwordChanged"));
    } catch {
      setError({ message: t(`accountErrors.${getAccountErrorKey(null, navigator.onLine)}`) });
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (field: "current" | "next" | "confirm") =>
    error?.field === field ? <FieldError>{error.message}</FieldError> : null;
  const passwordInput = (
    field: "current" | "next" | "confirm",
    id: string,
    autoComplete: string,
  ) => (
    <Input
      id={id}
      name={field}
      type="password"
      autoComplete={autoComplete}
      className="h-12"
      maxLength={MAX}
      aria-invalid={error?.field === field ? true : undefined}
    />
  );

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="font-semibold">{t("passwordTitle")}</h2>
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
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error.message}
          </p>
        )}
        <Button type="submit" className="h-11 self-start" disabled={busy}>
          {t("changePassword")}
        </Button>
      </form>
    </section>
  );
}
