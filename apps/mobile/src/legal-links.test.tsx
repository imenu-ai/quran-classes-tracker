import { fireEvent, screen } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import ar from "@qct/core/messages/ar.json";
import { createTestServices, renderWithApp } from "@/test/app-services";
import { renderArabic } from "@/test/render";
import SettingsScreen from "./app/(tabs)/settings/index";
import SignInScreen from "./app/sign-in";

jest.mock("expo-router", () => jest.requireActual("@/test/expo-router-mock"));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({})) }));
jest.mock("@/session/session", () => ({ useSession: () => ({ enter: jest.fn(async () => {}) }) }));
jest.mock("@/config", () => ({ API_URL: "https://quran.example" }));

const open = WebBrowser.openBrowserAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe("the privacy policy and support pages", () => {
  it("open on the web from Settings", async () => {
    await renderWithApp(<SettingsScreen />, createTestServices());
    await fireEvent.press(await screen.findByRole("link", { name: ar.legal.privacy }));
    expect(open).toHaveBeenLastCalledWith("https://quran.example/privacy");
    await fireEvent.press(screen.getByRole("link", { name: ar.legal.support }));
    expect(open).toHaveBeenLastCalledWith("https://quran.example/support");
  });

  it("are under the sign-in form", async () => {
    await renderArabic(<SignInScreen />);
    await fireEvent.press(await screen.findByRole("link", { name: ar.legal.privacy }));
    expect(open).toHaveBeenLastCalledWith("https://quran.example/privacy");
  });
});
