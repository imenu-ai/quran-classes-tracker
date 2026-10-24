import { useTranslations } from "use-intl";
import { EmptyState } from "@/components/empty-state";
import { Screen } from "@/components/screen";
import { SyncIndicator } from "@/components/sync-indicator";

/** Student search (the header search bar comes in 2.8). */
export default function SearchScreen() {
  const t = useTranslations("search");
  return (
    <Screen>
      <SyncIndicator />
      <EmptyState title={t("title")} description={t("hint")} />
    </Screen>
  );
}
