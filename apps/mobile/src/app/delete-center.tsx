import { useTranslations } from "use-intl";
import { DeletionForm } from "@/components/deletion-form";
import { Section } from "@/components/section";
import { Text } from "@/components/text";
import { deleteCenter } from "@/data/account";
import { useApp } from "@/data/app-data";

/** Settings → Center → "حذف المركز" (admins): the center and everything in it. */
export default function DeleteCenterScreen() {
  const t = useTranslations("deletion");
  const tSettings = useTranslations("settings");
  const { session } = useApp();
  return (
    <DeletionForm
      submitLabel={t("deleteCenter")}
      doneMessage={t("centerDeleted")}
      onDelete={deleteCenter}
    >
      {/* The name on its own line: it may be Latin, and would turn a sentence around. */}
      <Section title={tSettings("centerName")}>
        <Text weight="semibold">{session.tenantName}</Text>
      </Section>
      <Text>{t("centerDescription")}</Text>
      <Text tone="muted">{t("centerPrintHint")}</Text>
    </DeletionForm>
  );
}
