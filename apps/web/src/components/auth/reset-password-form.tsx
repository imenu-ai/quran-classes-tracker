"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/client/auth/auth-client";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/shared/access";

/** /reset-password?token=…: the page the emailed link lands on (via Better Auth). */
export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const tSettings = useTranslations("settings");
  const params = useSearchParams();
  const token = params.get("token");
  const ids = { next: useId(), confirm: useId() };
  const [error, setError] = useState<{ field?: "next" | "confirm"; message: string } | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token || params.get("error")) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("reset.invalidLink")}
        </p>
        <Button asChild variant="outline" className="h-11">
          <Link href="/forgot-password">{t("reset.requestNew")}</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p role="status" className="rounded-lg bg-primary/10 px-3 py-3 text-sm">
          {t("reset.done")}
        </p>
        <Button asChild className="h-12 text-base">
          <Link href="/login">{t("login.submit")}</Link>
        </Button>
      </div>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("next") ?? "");
    if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX) {
      return setError({ field: "next", message: tSettings("accountErrors.passwordLength") });
    }
    if (newPassword !== String(data.get("confirm") ?? "")) {
      return setError({ field: "confirm", message: tSettings("passwordsDontMatch") });
    }
    setError(null);
    setBusy(true);
    try {
      const result = await authClient.resetPassword({ newPassword, token: token ?? "" });
      if (result.error) {
        setError({
          message: !result.error.status
            ? t("errors.offline")
            : result.error.status === 429
              ? t("errors.rateLimited")
              : t("reset.invalidLink"),
        });
        return;
      }
      setDone(true);
    } catch {
      setError({ message: t(navigator.onLine ? "errors.generic" : "errors.offline") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field data-invalid={error?.field === "next" ? true : undefined}>
        <FieldLabel htmlFor={ids.next}>{tSettings("newPassword")}</FieldLabel>
        <Input
          id={ids.next}
          name="next"
          type="password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          className="h-12"
          aria-invalid={error?.field === "next" ? true : undefined}
        />
        <FieldDescription>{tSettings("passwordLengthHint")}</FieldDescription>
        {error?.field === "next" && <FieldError>{error.message}</FieldError>}
      </Field>
      <Field data-invalid={error?.field === "confirm" ? true : undefined}>
        <FieldLabel htmlFor={ids.confirm}>{tSettings("confirmPassword")}</FieldLabel>
        <Input
          id={ids.confirm}
          name="confirm"
          type="password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          className="h-12"
          aria-invalid={error?.field === "confirm" ? true : undefined}
        />
        {error?.field === "confirm" && <FieldError>{error.message}</FieldError>}
      </Field>
      {error && !error.field && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error.message}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
        {t("reset.submit")}
      </Button>
    </form>
  );
}
