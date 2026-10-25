import { useState } from "react";
import { Appearance } from "react-native";
import {
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from "@/device/device-store";

/**
 * Applies the choice to the whole app: React Native's colour scheme
 * override, which `useColorScheme` (so `useTheme`) and the native headers,
 * tabs and alerts all follow.
 */
export function applyThemePreference(preference: ThemePreference): void {
  Appearance.setColorScheme(preference === "system" ? "auto" : preference);
}

/** The saved choice, applied at start (from the root layout). */
export const applySavedThemePreference = () => applyThemePreference(readThemePreference());

/** The theme choice for Settings: saved on the device and applied at once. */
export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
  const [preference, setPreference] = useState(readThemePreference);
  const choose = (next: ThemePreference) => {
    saveThemePreference(next);
    applyThemePreference(next);
    setPreference(next);
  };
  return [preference, choose];
}
