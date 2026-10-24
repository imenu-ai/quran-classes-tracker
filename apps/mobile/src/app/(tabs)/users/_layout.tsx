import { Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { useStackOptions } from "@/components/stack-options";

export default function UsersStack() {
  const t = useTranslations("users");
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ title: t("title"), headerLargeTitle: true }} />
    </Stack>
  );
}
