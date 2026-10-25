import { useEffect, type ReactNode } from "react";
import { useFonts } from "expo-font";
import { Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useTranslations } from "use-intl";
import { DEFAULT_LOCALE } from "@qct/core/i18n/config";
import { useStackOptions } from "@/components/stack-options";
import { AppDataProvider } from "@/data/app-data";
import { AppIntlProvider } from "@/i18n/intl-provider";
import { SessionProvider, useSession } from "@/session/session";
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
    <KeyboardProvider>
      <SessionProvider>
        <SessionIntl>
          <AppDataProvider>
            <GatedStack />
          </AppDataProvider>
        </SessionIntl>
      </SessionProvider>
    </KeyboardProvider>
  );
}

/** Messages and formats, in the center's time zone once someone is signed in. */
function SessionIntl({ children }: Readonly<{ children: ReactNode }>) {
  const { snapshot } = useSession();
  // Only Arabic is enabled (PLAN.md §0 #9); direction is fixed at start (#53).
  return (
    <AppIntlProvider locale={DEFAULT_LOCALE} timeZone={snapshot?.timezone}>
      {children}
    </AppIntlProvider>
  );
}

/**
 * The signed-out gate (PLAN.md §2.8): the saved session decides, so the app
 * opens offline. Signed out: sign-in and registration. An admin-set password:
 * its change first. Otherwise: the tabs (and signing in again when the
 * server ended the session).
 */
const formSheet = {
  presentation: "formSheet",
  sheetAllowedDetents: "fitToContents",
  sheetGrabberVisible: true,
} as const;

function GatedStack() {
  const theme = useTheme();
  const t = useTranslations("auth");
  const tSync = useTranslations("sync");
  const tStudents = useTranslations("students");
  const stackOptions = useStackOptions();
  const withHeader = (title: string) => ({ ...stackOptions, headerShown: true, title });
  const { snapshot } = useSession();
  const signedIn = snapshot !== null;
  const mustChangePassword = snapshot?.mustChangePassword === true;
  return (
    <ThemeProvider value={navigationTheme(theme)}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn && !mustChangePassword}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="sign-in-again"
            options={{ ...withHeader(tSync("signInAgain")), presentation: "modal" }}
          />
          {/* Short forms are sheets sized to their content; the student form is a page sheet. */}
          <Stack.Screen name="class-form" options={formSheet} />
          <Stack.Screen name="archive-class" options={formSheet} />
          <Stack.Screen name="move-student" options={formSheet} />
          <Stack.Screen
            name="student-form"
            options={{ ...withHeader(tStudents("addTitle")), presentation: "modal" }}
          />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && mustChangePassword}>
          <Stack.Screen name="change-password" options={withHeader(t("changePassword.title"))} />
        </Stack.Protected>
        {/* Screens, not a group: a protected route falls back to the first available screen. */}
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" options={withHeader(t("login.title"))} />
          <Stack.Screen name="register" options={withHeader(t("register.title"))} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
