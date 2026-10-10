import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/components/auth/auth-page";
import { RegisterForm } from "@/components/auth/register-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.register");
  return { title: t("title") };
}

/** Public: a center admin registers his center (needs a connection). */
export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  return (
    <AuthPage title={t("title")} subtitle={t("subtitle")} wide>
      <RegisterForm />
    </AuthPage>
  );
}
