import { Pressable, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

/** Several choices that can each be on or off (permissions, classes), as checkbox rows. */
export function CheckboxList({
  label,
  options,
  selected,
  onToggle,
}: Readonly<{
  label: string;
  options: readonly { value: string; label: string }[];
  selected: ReadonlySet<string>;
  onToggle: (value: string) => void;
}>) {
  const { colors } = useTheme();
  return (
    <View style={styles.list} accessibilityLabel={label}>
      {options.map((option) => {
        const checked = selected.has(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => onToggle(option.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            style={styles.row}
          >
            <View
              style={[
                styles.box,
                checked
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { borderColor: colors.mutedForeground },
              ]}
            >
              {checked ? (
                <SymbolView
                  name={{ ios: "checkmark", android: "check" }}
                  size={16}
                  tintColor={colors.primaryForeground}
                />
              ) : null}
            </View>
            <Text style={styles.label}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1 },
});
