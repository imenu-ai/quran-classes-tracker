import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/components/auth/auth-page";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.forgot");
  return { title: t("title") };
}

/** A center admin asks for a password reset link by email. */
export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot");
  return (
    <AuthPage title={t("title")} subtitle={t("subtitle")}>
      <ForgotPasswordForm />
    </AuthPage>
  );
}
