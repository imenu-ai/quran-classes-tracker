import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useTranslations } from "use-intl";
import { composeUsername, isCenterCode, normalizeCenterCode } from "@qct/core/shared/access";
import { getLoginErrorKey, type LoginErrorKey } from "@qct/core/shared/login-error";
import { authClient } from "@/auth/client";
import { Button } from "@/components/button";
import { FormError } from "@/components/form-error";
import { LegalLinks } from "@/components/legal-links";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { TextLink } from "@/components/text-link";
import { API_URL } from "@/config";
import { readRememberedCenterCode, rememberCenterCode } from "@/device/device-store";
import { useSession } from "@/session/session";

type FieldName = "code" | "username" | "password";

/** Center code + username + password (PLAN.md §0 #24). The code is remembered. */
export default function SignInScreen() {
  const t = useTranslations("auth");
  const tValidation = useTranslations("errors.validation");
  const { enter } = useSession();
  const [code, setCode] = useState(() => readRememberedCenterCode());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState<LoginErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const centerCode = normalizeCenterCode(code);
    const errors: Partial<Record<FieldName, string>> = {};
    if (!centerCode) errors.code = tValidation("REQUIRED");
    else if (!isCenterCode(centerCode)) errors.code = t("errors.invalidCenterCode");
    if (!username.trim()) errors.username = tValidation("REQUIRED");
    if (!password) errors.password = tValidation("REQUIRED");
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    try {
      const result = await authClient.signIn.username({
        username: composeUsername(centerCode, username),
        password,
      });
      if (result.error) {
        // No HTTP status means the request never reached the server.
        setError(getLoginErrorKey(result.error, true));
        return;
      }
      rememberCenterCode(centerCode);
      // The gate moves on once the session is saved (to the tabs, or to
      // the forced password change).
      await enter();
    } catch {
      setError(getLoginErrorKey(null, true));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen width="form">
      <Text tone="muted">{t("login.subtitle")}</Text>
      <TextField
        testID="sign-in.code"
        label={t("login.centerCode")}
        hint={t("login.centerCodeHint")}
        error={fieldErrors.code}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={10}
        textContentType="oneTimeCode"
        autoComplete="off"
      />
      <TextField
        testID="sign-in.username"
        label={t("login.username")}
        error={fieldErrors.username}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        autoComplete="username"
      />
      <TextField
        testID="sign-in.password"
        label={t("login.password")}
        error={fieldErrors.password}
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
      <View style={styles.links}>
        <TextLink label={t("login.forgotLink")} onPress={() => void openForgotPassword()} />
        <View style={styles.row}>
          <Text tone="muted">{t("login.registerPrompt")}</Text>
          <TextLink label={t("login.registerLink")} onPress={() => router.push("/register")} />
        </View>
      </View>
      <LegalLinks />
    </Screen>
  );
}

/**
 * Admins reset a forgotten password by email on the web; the link in the
 * email opens the web reset page too (PLAN.md §0 #45).
 */
function openForgotPassword() {
  return WebBrowser.openBrowserAsync(`${API_URL}/forgot-password`);
}

const styles = StyleSheet.create({
  links: { gap: 8, alignItems: "center", paddingTop: 8 },
  row: { flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" },
});
