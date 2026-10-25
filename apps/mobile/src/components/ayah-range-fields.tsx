import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { getAyahCount } from "@qct/core/domain/quran/surahs";
import type { AyahRangeDraft, AyahRangeErrors, AyahRangeField } from "@qct/core/forms/ayah-range";
import { useErrorMessage } from "@/i18n/use-error-message";
import { SurahPicker } from "./surah-picker";
import { Text } from "./text";
import { TextField } from "./text-field";

/**
 * Sura + from/to ayah fields (the web's AyahRangeFields): the allowed range
 * shown ("من 1 إلى 286"), input limited to that many digits, and errors as
 * soon as a value is invalid. `visibleErrors` decides which fields show
 * theirs (touched fields, or all after a save attempt).
 */
export function AyahRangeFields({
  value,
  onChange,
  errors,
  visibleErrors,
}: Readonly<{
  value: AyahRangeDraft;
  onChange: (next: AyahRangeDraft, changed: AyahRangeField) => void;
  errors: AyahRangeErrors;
  visibleErrors: ReadonlySet<AyahRangeField>;
}>) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const ayahCount = value.surah ? getAyahCount(value.surah) : undefined;
  const maxDigits = ayahCount ? String(ayahCount).length : 3;
  const error = (field: AyahRangeField) => {
    const fieldError = visibleErrors.has(field) ? errors[field] : undefined;
    return fieldError ? errorMessage(fieldError) : null;
  };
  const ayahField = (field: "fromAyah" | "toAyah", key: "from" | "to") => (
    <View style={styles.half}>
      <TextField
        label={t(`glossary.${field}`)}
        value={value[key]}
        onChangeText={(text) => onChange({ ...value, [key]: text }, field)}
        error={error(field)}
        keyboardType="number-pad"
        maxLength={maxDigits}
        autoComplete="off"
        style={styles.ayah}
      />
    </View>
  );

  return (
    <View style={styles.fields}>
      <SurahPicker
        label={t("glossary.surah")}
        value={value.surah}
        onChange={(surah) => onChange({ ...value, surah }, "surah")}
        error={error("surah")}
      />
      <View style={styles.row}>
        {ayahField("fromAyah", "from")}
        {ayahField("toAyah", "to")}
      </View>
      {ayahCount ? (
        <Text tone="muted" size={14}>
          {t("quran.ayahRangeHint", { ayahCount })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 12 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  ayah: { textAlign: "center", fontSize: 18 },
});
