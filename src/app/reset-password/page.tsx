import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuthPage } from "@/components/auth/auth-page";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

/** Where the emailed reset link lands (Better Auth adds ?token=… or ?error=…). */
export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  return (
    <AuthPage title={t("title")}>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthPage>
  );
}
