import type { ReactNode } from "react";
import { Platform, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";

/**
 * A scrolling screen body under the native header. On iOS the system insets
 * it (notch, home indicator, the tab bar). Android draws edge to
 * edge, so the bottom inset keeps the last control clear of the gesture bar.
 * On both, the field being typed in scrolls above the keyboard (Android's
 * edge-to-edge mode no longer resizes the window for it).
 */
export function Screen({ children }: Readonly<{ children: ReactNode }>) {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollView
      contentInsetAdjustmentBehavior="automatic"
      // A tap on a button isn't swallowed by dismissing the keyboard.
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        Platform.OS === "android" && { paddingBottom: bottom + 16 },
      ]}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
});
