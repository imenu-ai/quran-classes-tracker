import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useTranslations } from "use-intl";
import {
  NOT_MEMORIZED,
  RATE_VALUES,
  type MemorizationChoice,
} from "@qct/core/shared/schemas/homework";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

/**
 * A mark from 0 to 10 in halves in the native picker: the wheel on iOS, a
 * dropdown on Android. "—" means no mark (choosing it clears one), as on the
 * web; 0 is a mark. The memorization picker can also offer "لم يحفظ" as its
 * first entry (`notMemorized`), and hide the marks (`marks={false}`) where only
 * that or nothing may be chosen.
 *
 * The chosen mark shows at once, before the local write and the live query
 * catch up, and stays until `value` moves off what it was when chosen. A
 * failed write drops it again.
 */
export function ScorePicker({
  label,
  value,
  onChange,
  disabled = false,
  testID,
  notMemorized = false,
  marks = true,
}: Readonly<{
  label: string;
  value: MemorizationChoice;
  onChange: (score: MemorizationChoice) => Promise<unknown>;
  disabled?: boolean;
  testID?: string;
  /** Offer "لم يحفظ" (memorization of due homework only). */
  notMemorized?: boolean;
  /** Offer the marks (false where only "لم يحفظ" or nothing may be chosen). */
  marks?: boolean;
}>) {
  const t = useTranslations();
  const { colors, fonts } = useTheme();
  const [chosen, setChosen] = useState<{ score: MemorizationChoice; from: MemorizationChoice }>();
  // The stored value moved (this write, or a sync): it wins from here on.
  if (chosen && chosen.from !== value) setChosen(undefined);
  const shown = chosen && chosen.from === value ? chosen.score : value;

  const choose = (score: MemorizationChoice) => {
    if (score === shown) return;
    const pick = { score, from: value };
    setChosen(pick);
    onChange(score).catch((error: unknown) => {
      setChosen((current) => (current === pick ? undefined : current));
      console.error(error);
    });
  };

  const marked = typeof shown === "number";
  const failed = shown === NOT_MEMORIZED;
  return (
    <View style={styles.field}>
      <Text tone="muted" weight="medium" size={14}>
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            borderColor: marked ? colors.primary : failed ? colors.warning : colors.input,
            backgroundColor: failed ? `${colors.warning}26` : colors.card,
          },
        ]}
      >
        <Picker
          enabled={!disabled}
          testID={testID}
          mode="dropdown"
          selectedValue={shown === null ? "" : String(shown)}
          onValueChange={(next: string) => choose(parseChoice(next))}
          accessibilityLabel={label}
          itemStyle={[styles.item, { fontFamily: fonts.semibold, color: colors.foreground }]}
          style={[styles.picker, { color: marked ? colors.primary : colors.foreground }]}
          dropdownIconColor={colors.mutedForeground}
        >
          <Picker.Item label={t("common.noValue")} value="" />
          {notMemorized || failed ? (
            <Picker.Item label={t("glossary.notMemorized")} value={NOT_MEMORIZED} />
          ) : null}
          {marks || marked
            ? RATE_VALUES.map((score) => (
                <Picker.Item key={score} label={String(score)} value={String(score)} />
              ))
            : null}
        </Picker>
      </View>
    </View>
  );
}

function parseChoice(value: string): MemorizationChoice {
  if (value === "") return null;
  if (value === NOT_MEMORIZED) return NOT_MEMORIZED;
  return Number(value);
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: 6 },
  box: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  // A shorter wheel on iOS: two sit side by side inside a homework item.
  picker: Platform.OS === "ios" ? { height: 140 } : {},
  item: { fontSize: 22, height: 140 },
});
