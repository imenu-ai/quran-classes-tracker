import { useState } from "react";
import { router } from "expo-router";
import { useTranslations } from "use-intl";
import { toWesternDigits } from "@qct/core/domain/text/digits";
import type { ApiErrorCode } from "@qct/core/shared/api";
import { PHONE_MAX, updateProfileSchema, USERNAME_MAX } from "@qct/core/shared/access";
import { NAME_MAX } from "@qct/core/shared/schemas/base";
import { parseWithCodes, type FieldError } from "@qct/core/shared/schemas/errors";
import { Button } from "@/components/button";
import { FormError } from "@/components/form-error";
import { Screen } from "@/components/screen";
import { TextField } from "@/components/text-field";
import { updateProfile } from "@/data/account";
import { useApp } from "@/data/app-data";
import { useErrorMessage } from "@/i18n/use-error-message";
import { useSession } from "@/session/session";

type FieldName = "name" | "username" | "phone" | "email";

/**
 * The user's own name, username and phone, plus the email for admins
 * (password reset), like the web's profile section. Online only: the server
 * checks uniqueness in the center.
 */
export default function ProfileScreen() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { session } = useApp();
  const { enter } = useSession();
  const isAdmin = session.role === "admin";
  const [values, setValues] = useState<Record<FieldName, string>>({
    name: session.name,
    username: session.username,
    phone: session.phone,
    email: session.email ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName | "form", string>>>({});
  const [busy, setBusy] = useState(false);
  const set = (field: FieldName) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  function showFailure(code: ApiErrorCode, fieldErrors: readonly FieldError[]) {
    if (code === "INVALID_INPUT") {
      const next: Partial<Record<FieldName, string>> = {};
      for (const error of fieldErrors) {
        const field = error.path as FieldName;
        next[field] ??= errorMessage(error);
      }
      return setErrors(next);
    }
    if (code === "USERNAME_TAKEN") return setErrors({ username: t("accountErrors.usernameTaken") });
    if (code === "EMAIL_TAKEN") return setErrors({ email: t("accountErrors.emailTaken") });
    setErrors({ form: t(`accountErrors.${code === "OFFLINE" ? "offline" : "generic"}`) });
  }

  async function save() {
    const parsed = parseWithCodes(updateProfileSchema, {
      name: values.name,
      username: values.username,
      phone: toWesternDigits(values.phone),
      ...(isAdmin ? { email: values.email } : {}),
    });
    setErrors({});
    if (!parsed.success) return showFailure("INVALID_INPUT", parsed.errors);

    // Only what changed, so an unchanged username or email is never re-checked.
    const changes = Object.fromEntries(
      Object.entries(parsed.data).filter(
        ([key, value]) => value !== (session as unknown as Record<string, unknown>)[key],
      ),
    );
    if (Object.keys(changes).length === 0) return router.back();

    setBusy(true);
    try {
      const result = await updateProfile(changes);
      if (!result.ok) return showFailure(result.code, result.errors);
      // Refresh what the app shows (the name, the normalized username…).
      await enter().catch(() => {});
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TextField
        label={t("displayName")}
        value={values.name}
        onChangeText={set("name")}
        error={errors.name}
        maxLength={NAME_MAX}
      />
      <TextField
        label={t("username")}
        hint={t("usernameHint")}
        value={values.username}
        onChangeText={set("username")}
        error={errors.username}
        maxLength={USERNAME_MAX}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
      />
      <TextField
        label={t("phone")}
        hint={t("phoneHint")}
        value={values.phone}
        onChangeText={set("phone")}
        error={errors.phone}
        maxLength={PHONE_MAX}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      {isAdmin ? (
        <TextField
          label={t("email")}
          hint={t("emailHint")}
          value={values.email}
          onChangeText={set("email")}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
        />
      ) : null}
      <FormError message={errors.form ?? null} />
      <Button label={tCommon("save")} busy={busy} onPress={() => void save()} />
    </Screen>
  );
}
