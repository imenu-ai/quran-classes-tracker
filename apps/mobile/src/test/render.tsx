import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppIntlProvider } from "@/i18n/intl-provider";

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  // eslint-disable-next-line no-restricted-syntax -- safe-area insets are physical by API
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Renders a screen as the app does: the real Arabic messages, a phone's safe area. */
export function renderArabic(ui: ReactNode) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AppIntlProvider locale="ar">{ui}</AppIntlProvider>
    </SafeAreaProvider>,
  );
}
