import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

/**
 * A labelled single choice among a few options, as full-width radio rows.
 * `hideLabel` when a heading above already says it (it still names the group).
 */
export function ChoiceList<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
}: Readonly<{
  label: string;
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
}>) {
  const { colors } = useTheme();
  return (
    <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {hideLabel ? null : <Text weight="medium">{label}</Text>}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.option,
              {
                borderColor: selected ? colors.primary : colors.input,
                backgroundColor: selected ? colors.accent : colors.card,
              },
            ]}
          >
            <View
              style={[
                styles.radio,
                { borderColor: selected ? colors.primary : colors.mutedForeground },
              ]}
            >
              {selected ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
            </View>
            <View style={styles.label}>
              <Text weight={option.hint ? "medium" : "regular"}>{option.label}</Text>
              {option.hint ? (
                <Text tone="muted" size={14}>
                  {option.hint}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  option: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1, gap: 2 },
});
