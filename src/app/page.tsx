import { getTranslations } from "next-intl/server";
import { HomePlaceholder } from "@/components/auth/home-placeholder";

export default async function HomePage() {
  const t = await getTranslations("app");
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      <h1 className="text-2xl font-semibold">{t("name")}</h1>
      <HomePlaceholder />
    </main>
  );
}
