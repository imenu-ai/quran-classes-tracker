import { BookOpenText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage() {
  const t = await getTranslations();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <BookOpenText className="size-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold">{t("app.name")}</h1>
        <p className="text-muted-foreground">{t("auth.login.subtitle")}</p>
      </div>
      <LoginForm />
    </main>
  );
}
