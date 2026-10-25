// Native modules without a JavaScript fallback, replaced by their own test mocks.
jest.mock("react-native-keyboard-controller", () =>
  jest.requireActual("react-native-keyboard-controller/jest"),
);

// The app's own native edges. Screens get their services from
// src/test/app-services.tsx instead; a test that needs one of these mocks
// its own version.
jest.mock("@/auth/client", () => ({
  authClient: { signIn: { username: jest.fn() }, signOut: jest.fn(), changePassword: jest.fn() },
  sessionFetch: jest.fn(),
  apiFetch: jest.fn(),
  clearStoredCookie: jest.fn(),
}));
jest.mock("@/data/expo-sqlite-driver", () => ({ openUserDatabaseFile: jest.fn() }));
jest.mock("@/sync/device", () => ({
  deviceIsOnline: () => true,
  deviceTriggerSources: {
    isActive: () => true,
    onActive: () => () => {},
    onConnectivity: () => () => {},
  },
}));
// qct-app.db (expo-sqlite): an in-memory stand-in. The sign-in test mocks its own.
jest.mock("@/device/device-store", () => {
  const values = new Map<string, unknown>();
  return {
    readSession: () => null,
    saveSession: jest.fn(),
    clearSession: jest.fn(),
    getDeviceId: () => "device-1",
    readRememberedCenterCode: () => "",
    rememberCenterCode: jest.fn(),
    readThemePreference: () => values.get("theme") ?? "system",
    saveThemePreference: (preference: string) => values.set("theme", preference),
  };
});
