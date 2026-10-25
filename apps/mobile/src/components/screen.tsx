import type { ReactNode } from "react";
import { Platform, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";

/**
 * How wide content may get on a tablet, like the web's containers: a page
 * (`max-w-4xl`), a settings-like page (`max-w-2xl`), a form (`max-w-md`).
 * On a phone the screen is narrower than all of them.
 */
export const CONTENT_WIDTH = { page: 896, narrow: 672, form: 448 } as const;

export type ContentWidth = keyof typeof CONTENT_WIDTH;

/**
 * A scrolling screen body under the native header. On iOS the system insets
 * it (notch, home indicator, the tab bar). Android draws edge to
 * edge, so the bottom inset keeps the last control clear of the gesture bar.
 * On both, the field being typed in scrolls above the keyboard (Android's
 * edge-to-edge mode no longer resizes the window for it). On a tablet the
 * content is centred at a readable width.
 */
export function Screen({
  children,
  width = "page",
}: Readonly<{ children: ReactNode; width?: ContentWidth }>) {
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
        { maxWidth: CONTENT_WIDTH[width] },
        Platform.OS === "android" && { paddingBottom: bottom + 16 },
      ]}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: "100%", alignSelf: "center", padding: 16, gap: 12 },
});
