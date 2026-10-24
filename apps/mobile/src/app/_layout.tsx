import { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { DEFAULT_LOCALE } from "@qct/core/i18n/config";
import { AppIntlProvider } from "@/i18n/intl-provider";
import { FONT_FILES } from "@/theme/fonts";
import { navigationTheme, useTheme } from "@/theme/theme";

// Keep the splash screen up until the fonts are ready (they're bundled, so it's brief).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  return (
    <AppIntlProvider locale={DEFAULT_LOCALE}>
      <ThemedStack />
    </AppIntlProvider>
  );
}

function ThemedStack() {
  const theme = useTheme();
  return (
    <ThemeProvider value={navigationTheme(theme)}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
