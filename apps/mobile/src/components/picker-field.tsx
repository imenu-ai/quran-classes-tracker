import { StyleSheet, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

export interface PickerOption {
  value: string;
  label: string;
}

/**
 * A labelled native picker: the wheel on iOS, a dropdown on Android. With a
 * `placeholder`, an empty first option asks for a choice.
 */
export function PickerField({
  label,
  value,
  options,
  onChange,
  placeholder,
  error,
}: Readonly<{
  label: string;
  value: string;
  options: readonly PickerOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
}>) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.field}>
      <Text weight="medium">{label}</Text>
      <View
        style={[
          styles.picker,
          { borderColor: error ? colors.destructive : colors.input, backgroundColor: colors.card },
        ]}
      >
        <Picker
          selectedValue={value}
          onValueChange={(next) => onChange(String(next))}
          accessibilityLabel={label}
          itemStyle={{ fontFamily: fonts.regular, color: colors.foreground, fontSize: 16 }}
          style={{ color: colors.foreground }}
          dropdownIconColor={colors.mutedForeground}
        >
          {placeholder !== undefined ? (
            <Picker.Item label={placeholder} value="" color={colors.mutedForeground} />
          ) : null}
          {options.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </View>
      {error ? (
        <Text size={14} style={{ color: colors.destructive }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  picker: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
});
