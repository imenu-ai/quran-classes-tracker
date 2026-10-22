"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ApiErrorCode } from "@/client/api";
import { useApp } from "@/client/app-context";
import { updateProfile } from "@/client/data/account";
import { bootstrapSession } from "@/client/session/session";
import { toWesternDigits } from "@/domain/text/digits";
import { useErrorMessage } from "@/i18n/use-error-message";
import { PHONE_MAX, updateProfileSchema, USERNAME_MAX } from "@/shared/access";
import { NAME_MAX } from "@/shared/schemas/base";
import { parseWithCodes, type FieldError as CodedError } from "@/shared/schemas/errors";

type FieldName = "name" | "username" | "phone" | "email";

/**
 * The user's own name, username and phone, plus the email for admins
 * (password reset). Online only: the server checks uniqueness in the center.
 */
export function ProfileSection() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { session } = useApp();
  const isAdmin = session.role === "admin";
  const id = useId();
  const [errors, setErrors] = useState<Partial<Record<FieldName | "form", string>>>({});
  const [busy, setBusy] = useState(false);

  function showFailure(code: ApiErrorCode, fieldErrors: readonly CodedError[]) {
    if (code === "INVALID_INPUT") {
      const next: Partial<Record<FieldName, string>> = {};
      for (const error of fieldErrors) {
        const field = error.path as FieldName;
        if (!next[field]) next[field] = errorMessage(error);
      }
      return setErrors(next);
    }
    if (code === "USERNAME_TAKEN") return setErrors({ username: t("accountErrors.usernameTaken") });
    if (code === "EMAIL_TAKEN") return setErrors({ email: t("accountErrors.emailTaken") });
    setErrors({ form: t(`accountErrors.${code === "OFFLINE" ? "offline" : "generic"}`) });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: FieldName) => String(data.get(name) ?? "");
    const parsed = parseWithCodes(updateProfileSchema, {
      name: text("name"),
      username: text("username"),
      phone: toWesternDigits(text("phone")),
      ...(isAdmin ? { email: text("email") } : {}),
    });
    setErrors({});
    if (!parsed.success) return showFailure("INVALID_INPUT", parsed.errors);

    // Only what changed, so an unchanged username or email is never re-checked.
    const changes = Object.fromEntries(
      Object.entries(parsed.data).filter(
        ([key, value]) => value !== (session as unknown as Record<string, unknown>)[key],
      ),
    );
    if (Object.keys(changes).length === 0) {
      toast.success(t("profileSaved"));
      return;
    }

    setBusy(true);
    try {
      const result = await updateProfile(changes);
      if (!result.ok) return showFailure(result.code, result.errors);
      // Refresh what the app shows (name, normalized username…).
      await bootstrapSession().catch(() => {});
      toast.success(t("profileSaved"));
    } finally {
      setBusy(false);
    }
  }

  const fieldId = (name: FieldName) => `${id}-${name}`;
  const field = (name: FieldName, label: string, input: React.ReactNode, hint?: string) => (
    <Field data-invalid={errors[name] ? true : undefined}>
      <FieldLabel htmlFor={fieldId(name)}>{label}</FieldLabel>
      {input}
      {hint && <FieldDescription>{hint}</FieldDescription>}
      {errors[name] && <FieldError>{errors[name]}</FieldError>}
    </Field>
  );

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="font-semibold">{t("profileTitle")}</h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {field(
          "name",
          t("displayName"),
          <Input
            id={fieldId("name")}
            name="name"
            dir="auto"
            className="h-12"
            maxLength={NAME_MAX}
            defaultValue={session.name}
            aria-invalid={errors.name ? true : undefined}
          />,
        )}
        {field(
          "username",
          t("username"),
          <Input
            id={fieldId("username")}
            name="username"
            dir="auto"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-12"
            maxLength={USERNAME_MAX}
            defaultValue={session.username}
            aria-invalid={errors.username ? true : undefined}
          />,
          t("usernameHint"),
        )}
        {field(
          "phone",
          t("phone"),
          <Input
            id={fieldId("phone")}
            name="phone"
            type="tel"
            inputMode="tel"
            dir="auto"
            className="h-12"
            maxLength={PHONE_MAX}
            defaultValue={session.phone}
            aria-invalid={errors.phone ? true : undefined}
          />,
          t("phoneHint"),
        )}
        {isAdmin &&
          field(
            "email",
            t("email"),
            <Input
              id={fieldId("email")}
              name="email"
              type="email"
              dir="auto"
              autoCapitalize="none"
              spellCheck={false}
              className="h-12"
              defaultValue={session.email ?? ""}
              aria-invalid={errors.email ? true : undefined}
            />,
            t("emailHint"),
          )}
        {errors.form && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errors.form}
          </p>
        )}
        <Button type="submit" className="h-11 self-start" disabled={busy}>
          {tCommon("save")}
        </Button>
      </form>
    </section>
  );
}
