import { Alert, type AlertButton } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { createClass } from "@qct/core/data/entities/classes";
import { getLoginErrorKey } from "@qct/core/shared/login-error";
import ar from "@qct/core/messages/ar.json";
import { authClient } from "@/auth/client";
import { SyncIndicator } from "@/components/sync-indicator";
import { createTestServices, renderWithApp, respondWith } from "@/test/app-services";
import SettingsScreen from "./app/(tabs)/settings/index";
import SignInAgainScreen from "./app/sign-in-again";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const signIn = authClient.signIn.username as unknown as jest.Mock;
const pendingOne = "تغيير واحد بانتظار المزامنة";

beforeEach(() => jest.clearAllMocks());

describe("the sync indicator", () => {
  it("says connected, then counts a change waiting to sync", async () => {
    const services = createTestServices();
    await renderWithApp(<SyncIndicator />, services);
    expect(await screen.findByText(ar.sync.connected)).toBeOnTheScreen();
    await createClass(services.store, "حلقة الفجر");
    expect(await screen.findByText(pendingOne)).toBeOnTheScreen();
  });

  it("syncs on tap; a lost session keeps the change and asks to sign in again", async () => {
    const fetch = respondWith(401);
    const services = createTestServices({ fetch });
    await createClass(services.store, "حلقة الفجر");
    await renderWithApp(<SyncIndicator />, services);
    await fireEvent.press(await screen.findByTestId("sync-indicator"));
    expect(fetch).toHaveBeenCalledWith("https://server.test/api/sync/push", expect.anything());
    expect(await screen.findByText(`${ar.sync.needsLogin} · ${pendingOne}`)).toBeOnTheScreen();
    expect(await services.db.count("outbox")).toBe(1);
    await fireEvent.press(screen.getByTestId("sync-indicator"));
    expect(router.push).toHaveBeenCalledWith("/sign-in-again");
  });
});

describe("signing out", () => {
  const signOutButton = () => screen.getByRole("button", { name: ar.auth.logout });

  it("signs out (and wipes) at once when everything is synced", async () => {
    const services = createTestServices();
    await renderWithApp(<SettingsScreen />, services);
    await fireEvent.press(signOutButton());
    await waitFor(() => expect(services.signOut).toHaveBeenCalledTimes(1));
  });

  it("warns about unsynced changes, offering to sync them first", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const services = createTestServices();
    const syncNow = jest.spyOn(services.engine, "syncNow");
    await createClass(services.store, "حلقة الفجر");
    await renderWithApp(<SettingsScreen />, services);
    await fireEvent.press(signOutButton());
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    const [title, message, buttons] = alert.mock.calls[0]! as [string, string, AlertButton[]];
    expect(title).toBe(ar.auth.logout);
    expect(message).toContain("يوجد تغيير واحد لم تتم مزامنته");
    expect(buttons.map((button) => button.text)).toEqual([
      ar.common.cancel,
      ar.sync.syncNow,
      ar.auth.logoutAnyway,
    ]);
    expect(services.signOut).not.toHaveBeenCalled();
    syncNow.mockClear();
    buttons[1]!.onPress?.();
    expect(syncNow).toHaveBeenCalledTimes(1);
    buttons[2]!.onPress?.();
    await waitFor(() => expect(services.signOut).toHaveBeenCalledTimes(1));
  });
});

describe("signing in again", () => {
  const password = () => screen.getByLabelText(ar.auth.login.password);
  const submit = () => fireEvent.press(screen.getByRole("button", { name: ar.auth.login.submit }));

  it("asks only for the password and resumes syncing", async () => {
    signIn.mockResolvedValue({ data: {}, error: null });
    const services = createTestServices();
    const resume = jest.spyOn(services.engine, "resumeAfterLogin");
    await renderWithApp(<SignInAgainScreen />, services);
    expect(screen.getByText("ahmad")).toBeOnTheScreen();
    await fireEvent.changeText(password(), "secret-pass");
    await submit();
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith({ username: "482913:ahmad", password: "secret-pass" });
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("shows a wrong password and stays", async () => {
    const error = { status: 401, code: "INVALID_USERNAME_OR_PASSWORD", message: "" };
    signIn.mockResolvedValue({ data: null, error });
    await renderWithApp(<SignInAgainScreen />);
    await fireEvent.changeText(password(), "wrong-pass");
    await submit();
    const key = getLoginErrorKey(error, true);
    expect(await screen.findByText(ar.auth.errors[key])).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
  });
});
