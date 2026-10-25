import { Alert } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { createClass } from "@qct/core/data/entities/classes";
import ar from "@qct/core/messages/ar.json";
import { apiFetch } from "@/auth/client";
import { createTestServices, renderWithApp } from "@/test/app-services";
import CenterScreen from "./app/(tabs)/settings/center";
import SettingsScreen from "./app/(tabs)/settings/index";
import DeleteAccountScreen from "./app/delete-account";
import DeleteCenterScreen from "./app/delete-center";

jest.mock("expo-router", () => jest.requireActual("@/test/expo-router-mock"));
jest.mock("@/session/session", () => ({ useSession: () => ({ enter: jest.fn(async () => {}) }) }));

const fetchMock = apiFetch as jest.Mock;
const t = ar.deletion;
const button = (name: string) => screen.getByRole("button", { name });

/** The server answers every call with this status and body. */
const respond = (status: number, body: unknown = {}) =>
  fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => body });

const lastCall = () => {
  const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { path, method: init.method, body: JSON.parse(String(init.body)) as unknown };
};

async function typePassword(password: string) {
  await fireEvent.changeText(screen.getByLabelText(t.password), password);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("deleting one's account", () => {
  it("is offered in Settings → Account", async () => {
    await renderWithApp(<SettingsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: t.accountButton }));
    expect(router.push).toHaveBeenCalledWith("/delete-account");
  });

  it("needs the password, says when it's wrong, then deletes and signs out", async () => {
    const services = createTestServices();
    await renderWithApp(<DeleteAccountScreen />, services);
    expect(screen.getByText(t.accountDescription)).toBeOnTheScreen();
    expect(screen.queryByText(t.accountAdminHint)).toBeNull();
    expect(button(t.deleteAccount)).toBeDisabled();

    respond(400, { error: "WRONG_PASSWORD" });
    await typePassword("guess");
    await fireEvent.press(button(t.deleteAccount));
    expect(await screen.findByText(t.errors.wrongPassword)).toBeOnTheScreen();
    expect(lastCall()).toEqual({
      path: "/api/account",
      method: "DELETE",
      body: { password: "guess" },
    });
    expect(services.signOut).not.toHaveBeenCalled();

    respond(200, { ok: true });
    await typePassword("my-password");
    await fireEvent.press(button(t.deleteAccount));
    await waitFor(() => expect(services.signOut).toHaveBeenCalled());
    expect(Alert.alert).toHaveBeenCalledWith(t.accountDeleted, undefined, expect.any(Array));
  });

  it("tells the only admin what to do instead", async () => {
    const services = createTestServices({ session: { role: "admin" } });
    await renderWithApp(<DeleteAccountScreen />, services);
    expect(screen.getByText(t.accountAdminHint)).toBeOnTheScreen();
    respond(409, { error: "LAST_ADMIN" });
    await typePassword("my-password");
    await fireEvent.press(button(t.deleteAccount));
    expect(await screen.findByText(t.errors.lastAdmin)).toBeOnTheScreen();
    expect(services.signOut).not.toHaveBeenCalled();
  });

  it("warns about changes this device hasn't synced", async () => {
    const services = createTestServices({ session: { permissions: ["classes.manage"] } });
    await createClass(services.store, "حلقة الفجر");
    await renderWithApp(<DeleteAccountScreen />, services);
    expect(await screen.findByText(/تغيير واحد على هذا الجهاز/)).toBeOnTheScreen();
  });

  it("says when there's no connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await renderWithApp(<DeleteAccountScreen />);
    await typePassword("my-password");
    await fireEvent.press(button(t.deleteAccount));
    // deviceIsOnline() is true in tests, so it's the generic message.
    expect(await screen.findByText(t.errors.generic)).toBeOnTheScreen();
  });
});

describe("deleting the center", () => {
  it("is offered to admins in Settings → Center", async () => {
    await renderWithApp(<CenterScreen />, createTestServices({ session: { role: "admin" } }));
    await fireEvent.press(await screen.findByRole("button", { name: t.centerButton }));
    expect(router.push).toHaveBeenCalledWith("/delete-center");
  });

  it("isn't offered to teachers", async () => {
    await renderWithApp(<CenterScreen />);
    expect(await screen.findByText(ar.settings.centerCode)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: t.centerButton })).toBeNull();
  });

  it("names the center, says what goes, and deletes it with the password", async () => {
    const services = createTestServices({ session: { role: "admin" } });
    await renderWithApp(<DeleteCenterScreen />, services);
    expect(screen.getByText(services.session.tenantName)).toBeOnTheScreen();
    expect(screen.getByText(t.centerDescription)).toBeOnTheScreen();

    respond(200, { ok: true });
    await typePassword("my-password");
    await fireEvent.press(button(t.deleteCenter));
    await waitFor(() => expect(services.signOut).toHaveBeenCalled());
    expect(lastCall()).toEqual({
      path: "/api/center",
      method: "DELETE",
      body: { password: "my-password" },
    });
    expect(Alert.alert).toHaveBeenCalledWith(t.centerDeleted, undefined, expect.any(Array));
  });

  it("says when there were too many attempts", async () => {
    await renderWithApp(<DeleteCenterScreen />, createTestServices({ session: { role: "admin" } }));
    respond(429, { error: "RATE_LIMITED" });
    await typePassword("guess");
    await fireEvent.press(button(t.deleteCenter));
    expect(await screen.findByText(t.errors.rateLimited)).toBeOnTheScreen();
  });
});
