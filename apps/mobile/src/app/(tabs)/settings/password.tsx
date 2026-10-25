import { Alert } from "react-native";
import { router } from "expo-router";
import { useTranslations } from "use-intl";
import { PasswordForm } from "@/components/password-form";
import { Screen } from "@/components/screen";

/** Change password: the current one is required (and rate limited on the server). */
export default function PasswordScreen() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  return (
    <Screen width="narrow">
      <PasswordForm
        submitLabel={t("changePassword")}
        onChanged={() => {
          // Nothing on screen changes, so say it worked.
          // With our own button: without one, Android shows its English "OK".
          Alert.alert(t("passwordChanged"), undefined, [{ text: tCommon("close") }]);
          router.back();
        }}
      />
    </Screen>
  );
}
