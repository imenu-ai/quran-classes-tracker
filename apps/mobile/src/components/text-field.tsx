import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useTranslations } from "use-intl";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

/**
 * A labelled text field with an optional hint and error. Passwords get a
 * show/hide toggle. At least 48 pt tall, 16 pt text (no zoom on iOS).
 */
export function TextField({
  label,
  hint,
  error,
  password = false,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string | null; password?: boolean }) {
  const t = useTranslations("auth.login");
  const { colors, fonts } = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text weight="medium">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry={password && !visible}
        autoCapitalize={password ? "none" : input.autoCapitalize}
        autoCorrect={password ? false : input.autoCorrect}
        {...input}
        style={[
          styles.input,
          {
            fontFamily: fonts.regular,
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : colors.input,
          },
          input.style,
        ]}
      />
      {password ? (
        <Pressable
          onPress={() => setVisible((value) => !value)}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.toggle}
        >
          <Text tone="primary" size={14}>
            {visible ? t("hidePassword") : t("showPassword")}
          </Text>
        </Pressable>
      ) : null}
      {hint ? (
        <Text tone="muted" size={14}>
          {hint}
        </Text>
      ) : null}
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
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  // Full width: shrink-to-fit text in an RTL row could be measured too narrow on Android.
  toggle: { minHeight: 32, justifyContent: "center" },
});
