import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage() {
  const t = await getTranslations();
  return (
    <AuthPage title={t("app.name")} subtitle={t("auth.login.subtitle")}>
      <LoginForm />
    </AuthPage>
  );
}
