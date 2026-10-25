import { Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { useStackOptions } from "@/components/stack-options";

export default function SettingsStack() {
  const t = useTranslations("settings");
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ title: t("title") }} />
      <Stack.Screen name="profile" options={{ title: t("profileTitle") }} />
      <Stack.Screen name="password" options={{ title: t("passwordTitle") }} />
      <Stack.Screen name="center" options={{ title: t("centerTitle") }} />
    </Stack>
  );
}
