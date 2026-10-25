import { Alert, Appearance, type AlertButton } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import ar from "@qct/core/messages/ar.json";
import type { CenterUser } from "@qct/core/shared/center-users";
import { apiFetch } from "@/auth/client";
import { createTestServices, renderWithApp, TEST_SESSION } from "@/test/app-services";
import SettingsScreen from "./app/(tabs)/settings/index";
import CenterScreen from "./app/(tabs)/settings/center";
import ProfileScreen from "./app/(tabs)/settings/profile";
import UserEditorScreen from "./app/(tabs)/users/[id]";
import UsersScreen from "./app/(tabs)/users/index";
import ResetPasswordSheet from "./app/reset-password";

jest.mock("expo-router", () => jest.requireActual("@/test/expo-router-mock"));
const mockEnter = jest.fn(async () => {});
jest.mock("@/session/session", () => ({ useSession: () => ({ enter: mockEnter }) }));

const params = useLocalSearchParams as jest.Mock;
const fetchMock = apiFetch as jest.Mock;
const button = (name: string) => screen.getByRole("button", { name });
const admin = () => createTestServices({ session: { role: "admin" } });

/** The server answers every call with this status and body. */
const respond = (status: number, body: unknown = {}) =>
  fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => body });
/** The path and parsed body of the nth call. */
const call = (n = -1) => {
  const [path, init] = fetchMock.mock.calls.at(n) as [string, RequestInit | undefined];
  return {
    path,
    method: init?.method ?? "GET",
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
};

/** The last call made with this method. */
const callWith = (method: string) => {
  const index = fetchMock.mock.calls.findLastIndex(
    ([, init]) => (init?.method ?? "GET") === method,
  );
  return call(index);
};

const member = (id: string, name: string, extra: Partial<CenterUser> = {}): CenterUser => ({
  id,
  name,
  username: `user_${id}`,
  phone: "0599000000",
  role: "teacher",
  permissions: ["lessons.run"],
  classIds: [],
  disabled: false,
  mustChangePassword: false,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({});
});

describe("settings", () => {
  it("lists a refused change, retries it into the outbox, or discards it after asking", async () => {
    const services = createTestServices();
    await services.db.transaction(async (tx) => {
      await tx.put("rejected", {
        recordId: "r1",
        table: "students",
        code: "FORBIDDEN",
        params: {},
        rejectedAt: 1,
      });
      await tx.put("rejected", {
        recordId: "r2",
        table: "lessons",
        code: "FORBIDDEN",
        params: {},
        rejectedAt: 2,
      });
    });
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderWithApp(<SettingsScreen />, services);
    expect(
      await screen.findByText(`${ar.tables.students}: ${ar.syncErrors.FORBIDDEN}`),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole("button", { name: ar.settings.retry })[0]!);
    await waitFor(async () => expect(await services.db.count("outbox")).toBe(1));
    await fireEvent.press(screen.getAllByRole("button", { name: ar.settings.discard })[0]!);
    const buttons = alert.mock.calls[0]![2] as AlertButton[];
    buttons[1]!.onPress?.();
    await waitFor(async () => expect(await services.db.count("rejected")).toBe(0));
  });

  it("applies the chosen theme to the whole app", async () => {
    const setColorScheme = jest.spyOn(Appearance, "setColorScheme");
    await renderWithApp(<SettingsScreen />);
    await fireEvent.press(screen.getByRole("radio", { name: ar.settings.themeDark }));
    expect(setColorScheme).toHaveBeenLastCalledWith("dark");
    expect(
      screen.getByRole("radio", { name: ar.settings.themeDark, selected: true }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: ar.settings.themeSystem }));
    expect(setColorScheme).toHaveBeenLastCalledWith("auto");
  });

  it("saves only what changed in the profile, then refreshes the session", async () => {
    respond(200, { ok: true });
    await renderWithApp(<ProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText(ar.settings.displayName), "أحمد علي");
    await fireEvent.press(button(ar.common.save));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(call()).toEqual({ path: "/api/account", method: "PATCH", body: { name: "أحمد علي" } });
    expect(mockEnter).toHaveBeenCalledTimes(1);
  });

  it("shows a username taken in the center on its field", async () => {
    respond(409, { error: "USERNAME_TAKEN" });
    await renderWithApp(<ProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText(ar.settings.username), "omar");
    await fireEvent.press(button(ar.common.save));
    expect(await screen.findByText(ar.settings.accountErrors.usernameTaken)).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("lets an admin rename the center; a teacher only sees it", async () => {
    respond(200, { ok: true });
    await renderWithApp(<CenterScreen />, admin());
    expect(screen.getByText(TEST_SESSION.centerCode)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(ar.settings.centerName), "مركز الهدى");
    await fireEvent.press(button(ar.common.save));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(call()).toMatchObject({
      path: "/api/center",
      method: "PATCH",
      body: { name: "مركز الهدى" },
    });

    await renderWithApp(<CenterScreen />);
    expect(screen.queryByLabelText(ar.settings.centerName)).toBeNull();
    expect(screen.getByText(TEST_SESSION.tenantName)).toBeOnTheScreen();
  });
});

describe("user management", () => {
  it("lists the center's users, you first, after a failed load and a retry", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    await renderWithApp(<UsersScreen />, admin());
    expect(await screen.findByText(ar.users.errors.loadFailed)).toBeOnTheScreen();
    respond(200, {
      users: [
        member("t1", "زيد"),
        member(TEST_SESSION.userId, "أحمد", { role: "admin" }),
        member("t2", "علي", { disabled: true }),
      ],
    });
    await fireEvent.press(button(ar.users.retry));
    expect(await screen.findByText(ar.users.you)).toBeOnTheScreen();
    expect(screen.getByText(ar.users.statusDisabled)).toBeOnTheScreen();
    const names = screen.getAllByText(/^(أحمد|زيد|علي)$/).map((node) => node.props.children);
    expect(names).toEqual(["أحمد", "زيد", "علي"]);
  });

  it("creates a teacher with the default permissions", async () => {
    respond(201, { userId: "new-user" });
    params.mockReturnValue({ id: "new" });
    await renderWithApp(<UserEditorScreen />, admin());
    await fireEvent.changeText(screen.getByLabelText(ar.users.name), "خالد");
    await fireEvent.changeText(screen.getByLabelText(ar.users.username), "khalid");
    await fireEvent.changeText(screen.getByLabelText(ar.users.phone), "٠٥٩٩١٢٣٤٥٦");
    await fireEvent.changeText(screen.getByLabelText(ar.users.password), "secret-pass");
    await fireEvent.press(button(ar.users.create));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(callWith("POST")).toEqual({
      path: "/api/center/users",
      method: "POST",
      body: {
        name: "خالد",
        username: "khalid",
        phone: "0599123456",
        password: "secret-pass",
        role: "teacher",
        permissions: ["lessons.run", "reports.view"],
        classIds: [],
      },
    });
  });

  it("explains a refused save and disables an account after asking", async () => {
    respond(200, { users: [member("t1", "زيد")] });
    params.mockReturnValue({ id: "t1" });
    await renderWithApp(<UserEditorScreen />, admin());
    await screen.findByDisplayValue("زيد");
    respond(409, { error: "LAST_ADMIN" });
    await fireEvent.press(button(ar.users.save));
    expect(await screen.findByText(ar.users.errors.lastAdmin)).toBeOnTheScreen();

    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    respond(200, { ok: true });
    await fireEvent.press(button(ar.users.disable));
    (alert.mock.calls[0]![2] as AlertButton[])[1]!.onPress?.();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([path, init]) =>
            path === "/api/center/users/t1" &&
            String((init as RequestInit)?.body) === JSON.stringify({ disabled: true }),
        ),
      ).toBe(true),
    );
  });

  it("sets a new password from the reset sheet", async () => {
    respond(200, { ok: true });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    params.mockReturnValue({ id: "t1", name: "زيد" });
    await renderWithApp(<ResetPasswordSheet />, admin());
    await fireEvent.changeText(screen.getByLabelText(ar.users.newPassword), "new-secret-1");
    await fireEvent.press(button(ar.users.setPassword));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(call()).toEqual({
      path: "/api/center/users/t1/password",
      method: "POST",
      body: { password: "new-secret-1" },
    });
  });
});
