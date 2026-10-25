import { useState } from "react";
import { useTranslations } from "use-intl";
import { getAccountErrorKey } from "@qct/core/shared/account-errors";
import { PASSWORD_MAX, PASSWORD_MIN } from "@qct/core/shared/access";
import { authClient } from "@/auth/client";
import { Button } from "./button";
import { FormError } from "./form-error";
import { TextField } from "./text-field";

type PasswordField = "current" | "next" | "confirm";

/**
 * Current, new and confirmed password, changed through Better Auth (the
 * current one is required and rate limited on the server). Used by the
 * forced first change and by Settings.
 */
export function PasswordForm({
  submitLabel,
  onChanged,
}: Readonly<{ submitLabel: string; onChanged: () => Promise<void> | void }>) {
  const t = useTranslations("settings");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<{ field?: PasswordField; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!current) return setError({ field: "current", message: t("accountErrors.wrongPassword") });
    if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) {
      return setError({ field: "next", message: t("accountErrors.passwordLength") });
    }
    if (next !== confirm) return setError({ field: "confirm", message: t("passwordsDontMatch") });
    setError(null);
    setBusy(true);
    try {
      const result = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
      });
      if (result.error) {
        const key = getAccountErrorKey(result.error, true);
        setError({
          field:
            key === "wrongPassword" ? "current" : key === "passwordLength" ? "next" : undefined,
          message: t(`accountErrors.${key}`),
        });
        return;
      }
      await onChanged();
    } catch {
      setError({ message: t(`accountErrors.${getAccountErrorKey(null, true)}`) });
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (field: PasswordField) => (error?.field === field ? error.message : null);
  return (
    <>
      <TextField
        label={t("currentPassword")}
        error={fieldError("current")}
        value={current}
        onChangeText={setCurrent}
        password
        maxLength={PASSWORD_MAX}
        textContentType="password"
        autoComplete="current-password"
      />
      <TextField
        label={t("newPassword")}
        hint={t("passwordLengthHint")}
        error={fieldError("next")}
        value={next}
        onChangeText={setNext}
        password
        maxLength={PASSWORD_MAX}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <TextField
        label={t("confirmPassword")}
        error={fieldError("confirm")}
        value={confirm}
        onChangeText={setConfirm}
        password
        maxLength={PASSWORD_MAX}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <FormError message={error && !error.field ? error.message : null} />
      <Button label={submitLabel} busy={busy} onPress={() => void submit()} />
    </>
  );
}
