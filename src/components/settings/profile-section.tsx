"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useApp } from "@/client/app-context";
import { getAccountErrorKey } from "@/client/auth/account-errors";
import { authClient } from "@/client/auth/auth-client";
import { bootstrapSession } from "@/client/session/session";
import { NAME_MAX } from "@/shared/schemas/base";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{3,30}$/;

/** Display name and username (online only; the server enforces uniqueness). */
export function ProfileSection() {
  const t = useTranslations();
  const { session } = useApp();
  const ids = { name: useId(), username: useId() };
  const [name, setName] = useState(session.name);
  const [username, setUsername] = useState(session.username);
  const [errors, setErrors] = useState<{ name?: string; username?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = t("errors.validation.REQUIRED");
    if (!USERNAME_PATTERN.test(username.trim()))
      next.username = t("settings.accountErrors.invalidUsername");
    setErrors(next);
    if (next.name || next.username) return;

    setBusy(true);
    try {
      const changes: { name?: string; username?: string } = {};
      if (name.trim() !== session.name) changes.name = name.trim();
      if (username.trim().toLowerCase() !== session.username) changes.username = username.trim();
      if (Object.keys(changes).length > 0) {
        const result = await authClient.updateUser(changes);
        if (result.error) {
          const key = getAccountErrorKey(result.error, navigator.onLine);
          setErrors(
            key === "usernameTaken" || key === "invalidUsername"
              ? { username: t(`settings.accountErrors.${key}`) }
              : { form: t(`settings.accountErrors.${key}`) },
          );
          return;
        }
        // Refresh the snapshot the app shows (name, normalized username).
        await bootstrapSession();
      }
      toast.success(t("settings.profileSaved"));
    } catch {
      setErrors({
        form: t(`settings.accountErrors.${getAccountErrorKey(null, navigator.onLine)}`),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="font-semibold">{t("settings.profileTitle")}</h2>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor={ids.name}>{t("settings.displayName")}</FieldLabel>
          <Input
            id={ids.name}
            dir="auto"
            className="h-12"
            maxLength={NAME_MAX}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field data-invalid={errors.username ? true : undefined}>
          <FieldLabel htmlFor={ids.username}>{t("settings.username")}</FieldLabel>
          <Input
            id={ids.username}
            dir="auto"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-12"
            maxLength={30}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            aria-invalid={errors.username ? true : undefined}
          />
          <FieldDescription>{t("settings.usernameHint")}</FieldDescription>
          {errors.username && <FieldError>{errors.username}</FieldError>}
        </Field>
        {errors.form && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errors.form}
          </p>
        )}
        <Button type="submit" className="h-11 self-start" disabled={busy}>
          {t("common.save")}
        </Button>
      </form>
    </section>
  );
}
