// Native modules without a JavaScript fallback, replaced by their own test mocks.
jest.mock("react-native-keyboard-controller", () =>
  jest.requireActual("react-native-keyboard-controller/jest"),
);
