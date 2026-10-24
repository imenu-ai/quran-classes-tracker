import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useTranslations } from "use-intl";
import { composeUsername } from "@qct/core/shared/access";
import { getLoginErrorKey, type LoginErrorKey } from "@qct/core/shared/login-error";
import { authClient } from "@/auth/client";
import { Button } from "@/components/button";
import { FormError } from "@/components/form-error";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { useApp } from "@/data/app-data";
import { useTheme } from "@/theme/theme";

/**
 * The server ended the session (sync got a 401), but the device keeps the
 * user and every local change. Only the password is asked; signing in again
 * resumes syncing what waited (PLAN.md §2.7). Signing in as someone else is
 * a sign-out first, in Settings.
 */
export default function SignInAgainScreen() {
  const t = useTranslations("auth");
  const tSync = useTranslations("sync");
  const tValidation = useTranslations("errors.validation");
  const { session, engine } = useApp();
  const { colors } = useTheme();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<LoginErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setFieldError(password ? null : tValidation("REQUIRED"));
    setError(null);
    if (!password) return;
    setBusy(true);
    try {
      const result = await authClient.signIn.username({
        username: composeUsername(session.centerCode, session.username),
        password,
      });
      if (result.error) {
        setError(getLoginErrorKey(result.error, true));
        return;
      }
      void engine.resumeAfterLogin();
      router.back();
    } catch {
      setError(getLoginErrorKey(null, true));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text tone="muted">{tSync("signInAgainHint")}</Text>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text weight="semibold">{session.name}</Text>
        <Text tone="muted" style={styles.ltr}>
          {session.username}
        </Text>
        <Text tone="muted">
          {t("login.centerCode")}: <Text style={styles.ltr}>{session.centerCode}</Text>
        </Text>
      </View>
      <TextField
        label={t("login.password")}
        error={fieldError}
        value={password}
        onChangeText={setPassword}
        password
        textContentType="password"
        autoComplete="current-password"
        onSubmitEditing={() => void submit()}
        returnKeyType="go"
      />
      <FormError message={error ? t(`errors.${error}`) : null} />
      <Button
        label={busy ? t("login.submitting") : t("login.submit")}
        busy={busy}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  // Latin user names and codes keep their own order inside Arabic text.
  ltr: { writingDirection: "ltr" },
});
