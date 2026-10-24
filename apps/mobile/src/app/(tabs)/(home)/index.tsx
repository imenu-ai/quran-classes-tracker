import { useTranslations } from "use-intl";
import { EmptyState } from "@/components/empty-state";
import { Screen } from "@/components/screen";

/** The classes (filled in 2.8). */
export default function HomeScreen() {
  const t = useTranslations("classes");
  return (
    <Screen>
      <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
    </Screen>
  );
}
