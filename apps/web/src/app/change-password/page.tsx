import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/components/auth/auth-page";
import { ForcedPasswordChange } from "@/components/auth/forced-password-change";

export async function generateMetadata() {
  const t = await getTranslations("auth.changePassword");
  return { title: t("title") };
}

/** A user whose password an admin set must choose his own before using the app. */
export default async function ChangePasswordPage() {
  const t = await getTranslations("auth.changePassword");
  return (
    <AuthPage title={t("title")} subtitle={t("subtitle")}>
      <ForcedPasswordChange />
    </AuthPage>
  );
}
