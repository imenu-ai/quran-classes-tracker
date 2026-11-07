import { StyleSheet, Switch, View } from "react-native";
import { useTranslations } from "use-intl";
import type { AyahRangeErrors, AyahRangeField } from "@qct/core/forms/ayah-range";
import { emptyPortionDraft, type PortionDraft } from "@qct/core/forms/portions";
import { PORTIONS_MAX } from "@qct/core/shared/schemas/homework";
import { useTheme } from "@/theme/theme";
import { AyahRangeFields } from "./ayah-range-fields";
import { Button } from "./button";
import { Text } from "./text";

const FIELDS: readonly AyahRangeField[] = ["surah", "fromAyah", "toAyah"];

/** A touched field of one sura in the list: `${draft.key}:${field}`. */
export const touchedKey = (draft: PortionDraft, field: AyahRangeField) => `${draft.key}:${field}`;

/** Every field of every sura, to show all errors after a save attempt. */
export const allTouched = (drafts: readonly PortionDraft[]) =>
  new Set(drafts.flatMap((draft) => FIELDS.map((field) => touchedKey(draft, field))));

/**
 * The suras of one homework (the web's PortionsFields): each with its sura
 * sheet and ayah fields, or "السورة كاملة" (a native switch); "إضافة سورة"
 * adds one, and each can be removed while there are several.
 */
export function PortionsFields({
  value,
  onChange,
  errors,
  visibleErrors,
}: Readonly<{
  value: readonly PortionDraft[];
  /** `touched` is the field that changed (touchedKey), if any. */
  onChange: (next: PortionDraft[], touched?: string) => void;
  errors: readonly AyahRangeErrors[];
  visibleErrors: ReadonlySet<string>;
}>) {
  const t = useTranslations("homework");
  const { colors } = useTheme();
  const several = value.length > 1;
  const replace = (index: number, draft: PortionDraft) =>
    value.map((current, i) => (i === index ? draft : current));

  return (
    <View style={styles.list}>
      {value.map((draft, index) => (
        <View
          key={draft.key}
          style={[
            styles.portion,
            several && [styles.card, { borderColor: colors.border, backgroundColor: colors.card }],
          ]}
        >
          <AyahRangeFields
            value={draft}
            ayahs={!draft.whole}
            errors={errors[index] ?? {}}
            visibleErrors={
              new Set(FIELDS.filter((field) => visibleErrors.has(touchedKey(draft, field))))
            }
            onChange={(next, field) =>
              onChange(replace(index, { ...draft, ...next }), touchedKey(draft, field))
            }
          />
          <View style={styles.whole}>
            <Text style={styles.wholeLabel}>{t("wholeSurah")}</Text>
            <Switch
              testID={`portion.whole.${index}`}
              accessibilityLabel={t("wholeSurah")}
              value={draft.whole}
              onValueChange={(whole) => onChange(replace(index, { ...draft, whole }))}
              trackColor={{ true: colors.primary }}
            />
          </View>
          {several ? (
            <Button
              variant="plain"
              label={t("removeSurah")}
              onPress={() => onChange(value.filter((_, i) => i !== index))}
            />
          ) : null}
        </View>
      ))}
      {value.length < PORTIONS_MAX ? (
        <Button
          variant="plain"
          label={t("addSurah")}
          onPress={() => onChange([...value, emptyPortionDraft()])}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  portion: { gap: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12 },
  whole: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  wholeLabel: { flex: 1 },
});
