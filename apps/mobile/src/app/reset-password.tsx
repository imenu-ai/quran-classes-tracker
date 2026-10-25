import { useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { PASSWORD_MAX } from "@qct/core/shared/access";
import { Button } from "@/components/button";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { setUserPassword } from "@/data/account";
import { useErrorMessage } from "@/i18n/use-error-message";

/**
 * Form sheet: an admin sets a new password for a user, who must replace it
 * at their next sign-in (the web's reset dialog).
 */
export default function ResetPasswordSheet() {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const result = await setUserPassword(id, password);
      if (!result.ok) {
        const [first] = result.errors;
        const key =
          result.code === "LAST_ADMIN"
            ? "lastAdmin"
            : result.code === "OFFLINE"
              ? "offline"
              : "generic";
        return setError(first ? errorMessage(first) : t(`errors.${key}`));
      }
      // With our own button: without one, Android shows its English "OK".
      Alert.alert(t("passwordSet"), undefined, [{ text: tCommon("close") }]);
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    // The name on its own line: a sentence that starts with a Latin name takes a
    // left-to-right base direction, and its full stop lands on the wrong side.
    <Sheet title={t("resetPassword")} description={name}>
      <Text tone="muted">{t("resetPasswordDescription")}</Text>
      <TextField
        label={t("newPassword")}
        hint={t("passwordHint")}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setError(null);
        }}
        error={error}
        maxLength={PASSWORD_MAX}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        autoFocus
      />
      <Button label={t("setPassword")} busy={busy} onPress={() => void save()} />
      <Button variant="plain" label={tCommon("cancel")} onPress={() => router.back()} />
    </Sheet>
  );
}
