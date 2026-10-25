import { useState, type ReactNode } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { useTranslations } from "use-intl";
import { PASSWORD_MAX } from "@qct/core/shared/access";
import { deletionErrorKey, type ApiResult } from "@qct/core/shared/api";
import { useApp } from "@/data/app-data";
import { Button } from "./button";
import { Screen } from "./screen";
import { TextField } from "./text-field";

/**
 * Deleting one's account or the center (PLAN.md §0 #50, the web's deletion
 * dialogs): what goes, the password again, then a destructive button. Once
 * the server has deleted it, the device forgets the user and his data, and
 * says so.
 */
export function DeletionForm({
  children,
  submitLabel,
  doneMessage,
  onDelete,
}: Readonly<{
  children: ReactNode;
  submitLabel: string;
  doneMessage: string;
  onDelete: (password: string) => Promise<ApiResult<unknown>>;
}>) {
  const t = useTranslations("deletion");
  const tCommon = useTranslations("common");
  const { signOut } = useApp();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const result = await onDelete(password);
      if (!result.ok) return setError(t(`errors.${deletionErrorKey(result.code)}`));
      // The server already ended the sessions; this wipes the device.
      await signOut();
      Alert.alert(doneMessage, undefined, [{ text: tCommon("close") }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen width="form">
      {children}
      <TextField
        testID="deletion.password"
        label={t("password")}
        hint={t("passwordHint")}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setError(null);
        }}
        error={error}
        password
        maxLength={PASSWORD_MAX}
        textContentType="password"
        autoComplete="current-password"
      />
      <Button
        variant="destructive"
        label={submitLabel}
        busy={busy}
        disabled={password === ""}
        onPress={() => void submit()}
      />
      <Button variant="plain" label={tCommon("cancel")} onPress={() => router.back()} />
    </Screen>
  );
}
