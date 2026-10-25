import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useTranslations } from "use-intl";
import { DEFAULT_TIME_ZONE, getIntlLocale } from "@qct/core/i18n/config";
import { timeZoneOptions } from "@qct/core/i18n/time-zones";
import { PASSWORD_MAX, registerCenterSchema, USERNAME_MAX } from "@qct/core/shared/access";
import { parseWithCodes, type FieldError } from "@qct/core/shared/schemas/errors";
import { apiFetch } from "@/auth/client";
import { Button } from "@/components/button";
import { CodeCard } from "@/components/code-card";
import { FormError } from "@/components/form-error";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { rememberCenterCode } from "@/device/device-store";
import { useAppLocale } from "@/i18n/locale";
import { useErrorMessage } from "@/i18n/use-error-message";
import { useSession } from "@/session/session";
import { useTheme } from "@/theme/theme";

const FIELDS = ["centerName", "timezone", "adminName", "email", "username", "password"] as const;
type FieldName = (typeof FIELDS)[number];
type FormErrorKey = "rateLimited" | "offline" | "generic";

/** The device's own time zone when it's in the list, else the app default. */
function deviceTimeZone(values: readonly string[]): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && values.includes(zone) ? zone : DEFAULT_TIME_ZONE;
}

/** Public registration of a center and its admin, then the center code to share. */
export default function RegisterScreen() {
  const t = useTranslations("auth.register");
  const locale = useAppLocale();
  const errorMessage = useErrorMessage();
  const { colors, fonts } = useTheme();
  const zones = useMemo(() => timeZoneOptions(getIntlLocale(locale)), [locale]);
  const [values, setValues] = useState<Record<FieldName, string>>(() => ({
    centerName: "",
    timezone: deviceTimeZone(zones.map((zone) => zone.value)),
    adminName: "",
    email: "",
    username: "",
    password: "",
  }));
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<FormErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const set = (field: FieldName) => (text: string) =>
    setValues((current) => ({ ...current, [field]: text }));

  const toFieldErrors = (list: readonly FieldError[]) => {
    const result: Partial<Record<FieldName, string>> = {};
    for (const error of list) {
      const field = error.path as FieldName;
      if (FIELDS.includes(field) && !result[field]) result[field] = errorMessage(error);
    }
    return result;
  };

  async function submit() {
    const parsed = parseWithCodes(registerCenterSchema, { ...values, locale });
    setFormError(null);
    if (!parsed.success) return setErrors(toFieldErrors(parsed.errors));
    setErrors({});
    setBusy(true);
    try {
      // The server signs the new admin in: apiFetch keeps the session cookie.
      const response = await apiFetch("/api/centers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.status === 201) {
        const body = (await response.json()) as { code: string };
        rememberCenterCode(body.code);
        setCode(body.code);
      } else if (response.status === 400) {
        const body = (await response.json()) as { errors?: FieldError[] };
        setErrors(toFieldErrors(body.errors ?? []));
      } else if (response.status === 409) {
        setErrors({ email: t("errors.emailTaken") });
      } else {
        setFormError(response.status === 429 ? "rateLimited" : "generic");
      }
    } catch {
      setFormError("offline");
    } finally {
      setBusy(false);
    }
  }

  if (code) return <CenterCode code={code} />;

  return (
    <Screen>
      <Text tone="muted">{t("subtitle")}</Text>
      <Text weight="semibold" size={18}>
        {t("centerSection")}
      </Text>
      <TextField
        label={t("centerName")}
        error={errors.centerName}
        value={values.centerName}
        onChangeText={set("centerName")}
        textContentType="organizationName"
      />
      <View style={styles.field}>
        <Text weight="medium">{t("timezone")}</Text>
        <View style={[styles.picker, { borderColor: colors.input, backgroundColor: colors.card }]}>
          <Picker
            selectedValue={values.timezone}
            onValueChange={(value) => set("timezone")(String(value))}
            accessibilityLabel={t("timezone")}
            itemStyle={{ fontFamily: fonts.regular, color: colors.foreground, fontSize: 16 }}
            style={{ color: colors.foreground }}
            dropdownIconColor={colors.mutedForeground}
          >
            {zones.map((zone) => (
              <Picker.Item key={zone.value} label={zone.label} value={zone.value} />
            ))}
          </Picker>
        </View>
        <Text tone="muted" size={14}>
          {t("timezoneHint")}
        </Text>
        {errors.timezone ? (
          <Text size={14} style={{ color: colors.destructive }}>
            {errors.timezone}
          </Text>
        ) : null}
      </View>
      <Text weight="semibold" size={18}>
        {t("adminSection")}
      </Text>
      <TextField
        label={t("adminName")}
        error={errors.adminName}
        value={values.adminName}
        onChangeText={set("adminName")}
        textContentType="name"
        autoComplete="name"
      />
      <TextField
        label={t("email")}
        hint={t("emailHint")}
        error={errors.email}
        value={values.email}
        onChangeText={set("email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        autoComplete="email"
      />
      <TextField
        label={t("username")}
        hint={t("usernameHint")}
        error={errors.username}
        value={values.username}
        onChangeText={set("username")}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={USERNAME_MAX}
        textContentType="username"
        autoComplete="username-new"
      />
      <TextField
        label={t("password")}
        hint={t("passwordHint")}
        error={errors.password}
        value={values.password}
        onChangeText={set("password")}
        password
        maxLength={PASSWORD_MAX}
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <FormError message={formError ? t(`errors.${formError}`) : null} />
      <Button
        label={busy ? t("submitting") : t("submit")}
        busy={busy}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

/** After registering: the center code to share with the teachers, then into the app. */
function CenterCode({ code }: Readonly<{ code: string }>) {
  const t = useTranslations("auth.register.done");
  const tErrors = useTranslations("auth.register.errors");
  const { enter } = useSession();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <Screen>
      <Text weight="semibold" size={20}>
        {t("title")}
      </Text>
      <CodeCard
        label={t("codeLabel")}
        code={code}
        hint={t("codeHint")}
        copyLabel={t("copy")}
        copiedLabel={t("copied")}
      />
      <FormError message={failed ? tErrors("offline") : null} />
      <Button
        label={t("continue")}
        busy={busy}
        onPress={() => {
          setBusy(true);
          setFailed(false);
          enter()
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  picker: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
});
