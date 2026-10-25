/**
 * The web's green/teal theme (apps/web/src/app/globals.css), converted from
 * OKLCH to sRGB because React Native has no OKLCH. Keep both in step.
 */
export const COLORS = {
  light: {
    background: "#fcfefd",
    foreground: "#0d1915",
    card: "#ffffff",
    cardForeground: "#0d1915",
    primary: "#057558",
    primaryForeground: "#f4fcf8",
    secondary: "#ebf4f0",
    secondaryForeground: "#122f26",
    muted: "#eff5f2",
    mutedForeground: "#505f59",
    accent: "#daf2e6",
    accentForeground: "#003729",
    destructive: "#d4212d",
    success: "#298646",
    successForeground: "#f6fcf7",
    warning: "#e49e22",
    warningForeground: "#311d03",
    exam: "#7544cd",
    examForeground: "#f9f7ff",
    border: "#dce3df",
    input: "#d1dad5",
    ring: "#369375",
  },
  dark: {
    background: "#0a110f",
    foreground: "#edf4f0",
    card: "#111b18",
    cardForeground: "#edf4f0",
    primary: "#5bc19d",
    primaryForeground: "#081511",
    secondary: "#1c2a26",
    secondaryForeground: "#edf4f0",
    muted: "#1d2624",
    mutedForeground: "#9aa9a1",
    accent: "#17342b",
    accentForeground: "#edf4f0",
    destructive: "#ff6367",
    success: "#5bbd74",
    successForeground: "#07150a",
    warning: "#f2af48",
    warningForeground: "#291600",
    exam: "#b298f9",
    examForeground: "#18102a",
    border: "rgba(255, 255, 255, 0.1)",
    input: "rgba(255, 255, 255, 0.15)",
    ring: "#429176",
  },
} as const;

export type ColorScheme = keyof typeof COLORS;
export type ThemeColors = { [K in keyof (typeof COLORS)["light"]]: string };
