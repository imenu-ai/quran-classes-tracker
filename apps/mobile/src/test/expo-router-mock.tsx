import type { ReactNode } from "react";
import { Pressable, Text, TextInput } from "react-native";

/**
 * expo-router for screen tests: `jest.mock("expo-router", () =>
 * jest.requireActual("@/test/expo-router-mock"))`. Navigation calls are
 * spies; header toolbar buttons and menu actions render as plain buttons
 * named by their label, and the header search bar as a text field, so tests
 * can find and press them.
 */
export const router = { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };

export const useLocalSearchParams = jest.fn(() => ({}));

interface ItemProps {
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const Item = ({ children, onPress, accessibilityLabel }: ItemProps) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? (typeof children === "string" ? children : undefined)}
    onPress={onPress}
  >
    <Text>{children}</Text>
  </Pressable>
);

const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;

/** Header titles show as text, so a test can check them. */
const Screen = ({ options }: { options?: { title?: string } }) =>
  options?.title ? <Text accessibilityRole="header">{options.title}</Text> : null;

const SearchBar = ({
  placeholder,
  onChangeText,
}: {
  placeholder?: string;
  onChangeText?: (event: { nativeEvent: { text: string } }) => void;
}) => (
  <TextInput
    accessibilityLabel={placeholder}
    onChangeText={(text) => onChangeText?.({ nativeEvent: { text } })}
  />
);

export const Stack = Object.assign(Passthrough, {
  Screen,
  SearchBar,
  Toolbar: Object.assign(Passthrough, {
    Button: Item,
    Menu: Passthrough,
    MenuAction: Item,
    Label: () => null,
    Icon: () => null,
  }),
});
