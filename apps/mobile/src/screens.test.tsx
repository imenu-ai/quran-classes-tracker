import { screen } from "@testing-library/react-native";
import ar from "@qct/core/messages/ar.json";
import { IntlCheck } from "@/components/intl-check";
import { renderWithApp } from "@/test/app-services";
import { renderArabic } from "@/test/render";
import HomeScreen from "./app/(tabs)/(home)/index";

describe("screens in Arabic", () => {
  it("home shows the sync state and the classes' empty state", async () => {
    await renderWithApp(<HomeScreen />);
    expect(await screen.findByText(ar.sync.connected)).toBeOnTheScreen();
    expect(screen.getByText(ar.classes.emptyTitle)).toBeOnTheScreen();
    expect(screen.getByText(ar.classes.emptyDescription)).toBeOnTheScreen();
  });

  it("the development check renders Arabic plurals and dates", async () => {
    await renderArabic(<IntlCheck />);
    expect(screen.getByText("11 طالبًا")).toBeOnTheScreen();
    expect(screen.getByText("طالبان")).toBeOnTheScreen();
  });
});
