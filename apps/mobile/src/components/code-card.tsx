import { useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "@/theme/theme";
import { Button } from "./button";
import { Text } from "./text";

/**
 * The center code, large, with a copy button that says when it's copied.
 * After registering and in the center settings: teachers type it to sign in.
 */
export function CodeCard({
  label,
  code,
  hint,
  copyLabel,
  copiedLabel,
}: Readonly<{
  label: string;
  code: string;
  hint: string;
  copyLabel: string;
  copiedLabel: string;
}>) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <>
      <View style={[styles.box, { borderColor: colors.primary }]}>
        <Text tone="muted" style={styles.centered}>
          {label}
        </Text>
        <Text
          weight="bold"
          size={36}
          tone="primary"
          selectable
          style={[styles.centered, styles.code]}
        >
          {code}
        </Text>
      </View>
      <Text tone="muted">{hint}</Text>
      <Button
        variant="plain"
        label={copied ? copiedLabel : copyLabel}
        onPress={() => {
          void Clipboard.setStringAsync(code).then(() => setCopied(true));
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, borderRadius: 12, padding: 16, gap: 4 },
  // Centred across the full width, never sized to the text (see Text).
  centered: { alignSelf: "stretch", textAlign: "center" },
  code: { letterSpacing: 4, writingDirection: "ltr" },
});
