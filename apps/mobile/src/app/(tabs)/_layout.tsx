import { NativeTabs } from "expo-router/native-tabs";
import { useTranslations } from "use-intl";
import { isAdmin } from "@qct/core/shared/access";
import { useAppReady } from "@/data/app-data";
import { useSession } from "@/session/session";
import { useTheme } from "@/theme/theme";

/** The native tabs, each with its own stack. Users is for admins only. */
export default function TabsLayout() {
  const t = useTranslations("nav");
  const { colors, fonts } = useTheme();
  const ready = useAppReady();
  const { snapshot } = useSession();
  const admin = snapshot !== null && isAdmin(snapshot);
  // The user's database opens at start (a few milliseconds); screens read it.
  if (!ready) return null;
  return (
    <NativeTabs
      tintColor={colors.primary}
      backgroundColor={colors.card}
      indicatorColor={colors.accent}
      labelStyle={{ fontFamily: fonts.medium }}
      // Always show every tab's name, as the web's bottom navigation does.
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>{t("home")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="books.vertical.fill" md="menu_book" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label>{t("search")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="users" hidden={!admin}>
        <NativeTabs.Trigger.Label>{t("users")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2.fill" md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t("settings")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
