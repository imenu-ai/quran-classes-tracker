import { useMemo, useState } from "react";
import { router } from "expo-router";
import { useTranslations } from "use-intl";
import { getIntlLocale } from "@qct/core/i18n/config";
import { timeZoneOptions } from "@qct/core/i18n/time-zones";
import { updateCenterSchema } from "@qct/core/shared/access";
import { NAME_MAX } from "@qct/core/shared/schemas/base";
import { parseWithCodes } from "@qct/core/shared/schemas/errors";
import { Button } from "@/components/button";
import { CodeCard } from "@/components/code-card";
import { FormError } from "@/components/form-error";
import { PickerField } from "@/components/picker-field";
import { Screen } from "@/components/screen";
import { Section } from "@/components/section";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { updateCenterSettings } from "@/data/account";
import { useApp } from "@/data/app-data";
import { useAppLocale } from "@/i18n/locale";
import { useErrorMessage } from "@/i18n/use-error-message";
import { useSession } from "@/session/session";

/**
 * The center: its code (everyone may need to share it), and for admins its
 * name and time zone, like the web's center section. The time zone decides
 * what "today" is for lessons.
 */
export default function CenterScreen() {
  const t = useTranslations("settings");
  const { session } = useApp();
  return (
    <Screen>
      <CodeCard
        label={t("centerCode")}
        code={session.centerCode}
        hint={t("centerCodeHint")}
        copyLabel={t("copyCode")}
        copiedLabel={t("codeCopied")}
      />
      {session.role === "admin" ? (
        <CenterForm />
      ) : (
        <Section title={t("centerName")}>
          <Text>{session.tenantName}</Text>
        </Section>
      )}
    </Screen>
  );
}

function CenterForm() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const locale = useAppLocale();
  const { session } = useApp();
  const { enter } = useSession();
  const zones = useMemo(() => timeZoneOptions(getIntlLocale(locale)), [locale]);
  const [name, setName] = useState(session.tenantName);
  const [timezone, setTimezone] = useState(session.timezone);
  const [errors, setErrors] = useState<{ name?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const parsed = parseWithCodes(updateCenterSchema, { name, timezone });
    setErrors({});
    if (!parsed.success) {
      const nameError = parsed.errors.find((error) => error.path === "name");
      return setErrors(
        nameError ? { name: errorMessage(nameError) } : { form: t("accountErrors.generic") },
      );
    }
    setBusy(true);
    try {
      const result = await updateCenterSettings(parsed.data);
      if (!result.ok) {
        return setErrors({
          form: t(`accountErrors.${result.code === "OFFLINE" ? "offline" : "generic"}`),
        });
      }
      await enter().catch(() => {});
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TextField
        label={t("centerName")}
        value={name}
        onChangeText={setName}
        error={errors.name}
        maxLength={NAME_MAX}
      />
      <PickerField
        label={t("timezone")}
        value={timezone}
        onChange={setTimezone}
        // The saved zone stays offered even if the list no longer has it.
        options={
          zones.some((zone) => zone.value === timezone)
            ? zones
            : [{ value: timezone, label: timezone }, ...zones]
        }
      />
      <FormError message={errors.form ?? null} />
      <Button label={tCommon("save")} busy={busy} onPress={() => void save()} />
    </>
  );
}
