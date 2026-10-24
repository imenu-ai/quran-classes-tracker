import { render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import ar from "@qct/core/messages/ar.json";
import { IntlCheck } from "@/components/intl-check";
import { AppIntlProvider } from "@/i18n/intl-provider";
import HomeScreen from "./app/(tabs)/(home)/index";

const renderArabic = (ui: ReactNode) => render(<AppIntlProvider locale="ar">{ui}</AppIntlProvider>);

describe("screens in Arabic", () => {
  it("home shows the classes' empty state", async () => {
    await renderArabic(<HomeScreen />);
    expect(screen.getByText(ar.classes.emptyTitle)).toBeOnTheScreen();
    expect(screen.getByText(ar.classes.emptyDescription)).toBeOnTheScreen();
  });

  it("the development check renders Arabic plurals and dates", async () => {
    await renderArabic(<IntlCheck />);
    expect(screen.getByText("11 طالبًا")).toBeOnTheScreen();
    expect(screen.getByText("طالبان")).toBeOnTheScreen();
  });
});
