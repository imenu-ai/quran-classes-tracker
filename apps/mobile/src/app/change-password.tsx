import { useState } from "react";
import { useTranslations } from "use-intl";
import { getAccountErrorKey } from "@qct/core/shared/account-errors";
import { PASSWORD_MAX, PASSWORD_MIN } from "@qct/core/shared/access";
import { authClient } from "@/auth/client";
import { Button } from "@/components/button";
import { FormError } from "@/components/form-error";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useSession } from "@/session/session";

type PasswordField = "current" | "next" | "confirm";

/**
 * A teacher's first sign-in: the password the admin set must be replaced
 * before anything else (PLAN.md §0 #26). The server clears the flag.
 */
export default function ChangePasswordScreen() {
  const t = useTranslations("settings");
  const tChange = useTranslations("auth.changePassword");
  const { enter } = useSession();
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
      // The server cleared mustChangePassword; saving that opens the app.
      await enter();
    } catch {
      setError({ message: t(`accountErrors.${getAccountErrorKey(null, true)}`) });
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (field: PasswordField) => (error?.field === field ? error.message : null);
  return (
    <Screen>
      <Text tone="muted">{tChange("subtitle")}</Text>
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
      <Button label={tChange("submit")} busy={busy} onPress={() => void submit()} />
    </Screen>
  );
}
