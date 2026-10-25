import { useTranslations } from "use-intl";
import { DeletionForm } from "@/components/deletion-form";
import { Text } from "@/components/text";
import { deleteOwnAccount } from "@/data/account";
import { useApp } from "@/data/app-data";
import { useLocalQuery } from "@/data/use-local-query";
import { useTheme } from "@/theme/theme";

/**
 * Settings → Account → "حذف الحساب": the user deletes his own account. The
 * center's records stay; changes not yet synced from this device are lost,
 * so it says how many.
 */
export default function DeleteAccountScreen() {
  const t = useTranslations("deletion");
  const { session } = useApp();
  const { colors } = useTheme();
  const pending = useLocalQuery((db) => db.count("outbox"), [], ["outbox"]) ?? 0;
  return (
    <DeletionForm
      submitLabel={t("deleteAccount")}
      doneMessage={t("accountDeleted")}
      onDelete={deleteOwnAccount}
    >
      <Text>{t("accountDescription")}</Text>
      {session.role === "admin" ? <Text tone="muted">{t("accountAdminHint")}</Text> : null}
      {pending > 0 ? (
        <Text style={{ color: colors.destructive }}>{t("pending", { count: pending })}</Text>
      ) : null}
    </DeletionForm>
  );
}
