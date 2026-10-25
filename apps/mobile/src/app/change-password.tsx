import { useTranslations } from "use-intl";
import { PasswordForm } from "@/components/password-form";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useSession } from "@/session/session";

/**
 * A teacher's first sign-in: the password the admin set must be replaced
 * before anything else (PLAN.md §0 #26). The server clears the flag.
 */
export default function ChangePasswordScreen() {
  const t = useTranslations("auth.changePassword");
  const { enter } = useSession();
  return (
    <Screen width="form">
      <Text tone="muted">{t("subtitle")}</Text>
      <PasswordForm
        submitLabel={t("submit")}
        // The server cleared mustChangePassword; saving that opens the app.
        onChanged={async () => {
          await enter();
        }}
      />
    </Screen>
  );
}
