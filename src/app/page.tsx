import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("app");
  return (
    <main className="p-4">
      <h1 className="text-start text-2xl font-semibold">{t("name")}</h1>
    </main>
  );
}
