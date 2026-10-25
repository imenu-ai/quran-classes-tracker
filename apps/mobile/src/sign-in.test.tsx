import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import ar from "@qct/core/messages/ar.json";
import { renderArabic } from "@/test/render";
import SignInScreen from "./app/sign-in";

const mockSignIn = jest.fn();
const mockEnter = jest.fn();
const mockRemember = jest.fn();

jest.mock("@/auth/client", () => ({
  authClient: { signIn: { username: (...args: unknown[]) => mockSignIn(...args) } },
}));
jest.mock("@/session/session", () => ({
  useSession: () => ({ enter: mockEnter }),
}));
jest.mock("@/device/device-store", () => ({
  readRememberedCenterCode: () => "",
  rememberCenterCode: (code: string) => mockRemember(code),
}));

const renderSignIn = () => renderArabic(<SignInScreen />);

const field = (label: string) => screen.getByLabelText(label);
const submit = () => fireEvent.press(screen.getByRole("button", { name: ar.auth.login.submit }));

describe("sign-in", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockEnter.mockReset();
    mockRemember.mockReset();
  });

  it("checks the fields before calling the server", async () => {
    await renderSignIn();
    await fireEvent.changeText(field(ar.auth.login.centerCode), "12");
    await submit();
    expect(await screen.findByText(ar.auth.errors.invalidCenterCode)).toBeOnTheScreen();
    expect(screen.getAllByText(ar.errors.validation.REQUIRED)).toHaveLength(2);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("signs in with <code>:<username>, remembers the code and enters the app", async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: null });
    await renderSignIn();
    // Arabic-Indic digits are fine; the username is lowercased.
    await fireEvent.changeText(field(ar.auth.login.centerCode), "٤٨٢٩١٣");
    await fireEvent.changeText(field(ar.auth.login.username), "Ahmad");
    await fireEvent.changeText(field(ar.auth.login.password), "secret-pass");
    await submit();
    await waitFor(() => expect(mockEnter).toHaveBeenCalledTimes(1));
    expect(mockSignIn).toHaveBeenCalledWith({ username: "482913:ahmad", password: "secret-pass" });
    expect(mockRemember).toHaveBeenCalledWith("482913");
  });

  it("says when the username or password is wrong", async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: { status: 401, code: "INVALID_USERNAME_OR_PASSWORD" },
    });
    await renderSignIn();
    await fireEvent.changeText(field(ar.auth.login.centerCode), "482913");
    await fireEvent.changeText(field(ar.auth.login.username), "ahmad");
    await fireEvent.changeText(field(ar.auth.login.password), "wrong");
    await submit();
    expect(await screen.findByText(ar.auth.errors.invalidCredentials)).toBeOnTheScreen();
    expect(mockEnter).not.toHaveBeenCalled();
  });

  it("says sign-in needs a connection when the server can't be reached", async () => {
    mockSignIn.mockRejectedValue(new TypeError("Network request failed"));
    await renderSignIn();
    await fireEvent.changeText(field(ar.auth.login.centerCode), "482913");
    await fireEvent.changeText(field(ar.auth.login.username), "ahmad");
    await fireEvent.changeText(field(ar.auth.login.password), "secret-pass");
    await submit();
    expect(await screen.findByText(ar.auth.errors.offline)).toBeOnTheScreen();
  });
});
