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
