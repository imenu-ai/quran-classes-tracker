import { Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { useStackOptions } from "@/components/stack-options";

export default function HomeStack() {
  const t = useTranslations();
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ title: t("classes.title") }} />
    </Stack>
  );
}
