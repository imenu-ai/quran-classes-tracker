import { StyleSheet, View } from "react-native";
import { useTranslations } from "use-intl";
import { PAGE_COUNT } from "@qct/core/domain/quran/pages";
import type { PageRangeCheck, PageRangeDraft, PageRangeField } from "@qct/core/forms/pages";
import { useErrorMessage } from "@/i18n/use-error-message";
import { usePortionLabel } from "@/i18n/portion";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";
import { TextField } from "./text-field";

/**
 * From page / to page of the Madinah Mushaf (1–604), with the suras and
 * ayahs those pages hold shown underneath once the range is valid (the web's
 * PageRangeFields).
 */
export function PageRangeFields({
  value,
  onChange,
  check,
  visibleErrors,
}: Readonly<{
  value: PageRangeDraft;
  onChange: (next: PageRangeDraft, changed: PageRangeField) => void;
  check: PageRangeCheck;
  visibleErrors: ReadonlySet<PageRangeField>;
}>) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const label = usePortionLabel();
  const { colors } = useTheme();

  const field = (name: PageRangeField, key: "from" | "to") => {
    const error = visibleErrors.has(name) ? check.errors[name] : undefined;
    return (
      <View style={styles.half}>
        <TextField
          testID={`page.${key}`}
          label={t(`homework.${name}`)}
          value={value[key]}
          onChangeText={(text) => onChange({ ...value, [key]: text }, name)}
          error={error ? errorMessage(error) : null}
          keyboardType="number-pad"
          maxLength={3}
          autoComplete="off"
          style={styles.page}
        />
      </View>
    );
  };

  return (
    <View style={styles.fields}>
      <View style={styles.row}>
        {field("fromPage", "from")}
        {field("toPage", "to")}
      </View>
      <Text tone="muted" size={14}>
        {t("homework.pagesHint", { pageCount: PAGE_COUNT })}
      </Text>
      {check.ok ? (
        <View style={[styles.preview, { backgroundColor: colors.muted }]}>
          <Text size={14}>
            {t("homework.pagesPreview", { portions: label({ portions: check.portions }) })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 12 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  page: { textAlign: "center", fontSize: 18 },
  preview: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
});
