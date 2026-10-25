import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useTranslations } from "use-intl";
import { RATE_MAX, RATE_MIN } from "@qct/core/shared/schemas/homework";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

const SCORES = Array.from({ length: RATE_MAX - RATE_MIN + 1 }, (_, i) => RATE_MIN + i);

/**
 * A mark from 1 to 10 in the native picker: the wheel on iOS, a dropdown on
 * Android. "—" means no mark (choosing it clears one), as on the web.
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
}: Readonly<{
  label: string;
  value: number | null;
  onChange: (score: number | null) => Promise<unknown>;
  disabled?: boolean;
}>) {
  const t = useTranslations("common");
  const { colors, fonts } = useTheme();
  const [chosen, setChosen] = useState<{ score: number | null; from: number | null }>();
  // The stored value moved (this write, or a sync): it wins from here on.
  if (chosen && chosen.from !== value) setChosen(undefined);
  const shown = chosen && chosen.from === value ? chosen.score : value;

  const choose = (score: number | null) => {
    if (score === shown) return;
    const pick = { score, from: value };
    setChosen(pick);
    onChange(score).catch((error: unknown) => {
      setChosen((current) => (current === pick ? undefined : current));
      console.error(error);
    });
  };

  const marked = shown !== null;
  return (
    <View style={styles.field}>
      <Text tone="muted" weight="medium" size={14}>
        {label}
      </Text>
      <View
        style={[
          styles.box,
          {
            borderColor: marked ? colors.primary : colors.input,
            backgroundColor: colors.card,
          },
        ]}
      >
        <Picker
          enabled={!disabled}
          mode="dropdown"
          selectedValue={shown === null ? "" : String(shown)}
          onValueChange={(next) => choose(next === "" ? null : Number(next))}
          accessibilityLabel={label}
          itemStyle={[styles.item, { fontFamily: fonts.semibold, color: colors.foreground }]}
          style={[styles.picker, { color: marked ? colors.primary : colors.foreground }]}
          dropdownIconColor={colors.mutedForeground}
        >
          <Picker.Item label={t("noValue")} value="" />
          {SCORES.map((score) => (
            <Picker.Item key={score} label={String(score)} value={String(score)} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, gap: 6 },
  box: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  // A shorter wheel on iOS: two sit side by side inside a homework item.
  picker: Platform.OS === "ios" ? { height: 140 } : {},
  item: { fontSize: 22, height: 140 },
});
