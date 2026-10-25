import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import {
  activeStudentsOf,
  archiveClass,
  archiveClassWithStudents,
  moveStudentsAndArchive,
} from "@qct/core/data/entities/classes";
import { Button } from "@/components/button";
import { Loading } from "@/components/loading";
import { PickerField } from "@/components/picker-field";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { useApp } from "@/data/app-data";
import { useActiveClasses } from "@/data/queries";
import { useLocalQuery } from "@/data/use-local-query";

/**
 * Form sheet confirming a class's archiving, like the web's dialog. With
 * active students still in it, the user chooses: move them to another class
 * first, or archive them with it.
 */
export default function ArchiveClassSheet() {
  const t = useTranslations();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store } = useApp();
  const studentCount = useLocalQuery(
    async (db) => (await activeStudentsOf(db, id)).length,
    [id],
    ["students"],
  );
  const otherClasses = (useActiveClasses() ?? []).filter((c) => c.id !== id);
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);

  /** `action` resolves to false when nothing was archived (the sheet stays). */
  async function run(action: () => Promise<boolean | void>) {
    setBusy(true);
    try {
      if ((await action()) === false) return;
      // The class's page would show an archived class; go back to the list.
      router.dismissTo("/");
    } finally {
      setBusy(false);
    }
  }

  if (studentCount === undefined) {
    return (
      <Sheet title={t("classes.archiveConfirmTitle")}>
        <Loading />
      </Sheet>
    );
  }

  if (studentCount === 0) {
    return (
      <Sheet title={t("classes.archiveConfirmTitle")} description={t("classes.archiveConfirm")}>
        <Button
          variant="destructive"
          label={t("classes.archive")}
          busy={busy}
          onPress={() =>
            void run(async () => {
              // If a student was added meanwhile (e.g. synced from another
              // device), nothing is archived and the sheet shows the choices.
              const result = await archiveClass(store, id);
              return result.status === "archived";
            })
          }
        />
        <Button variant="plain" label={t("common.cancel")} onPress={() => router.back()} />
      </Sheet>
    );
  }

  return (
    <Sheet
      title={t("classes.archiveBlockedTitle")}
      description={t("classes.archiveBlocked", { count: studentCount })}
    >
      {otherClasses.length > 0 ? (
        <>
          <PickerField
            label={t("classes.moveStudentsTo")}
            placeholder={t("students.moveTo")}
            value={targetId}
            onChange={setTargetId}
            options={otherClasses.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Button
            label={t("classes.moveAndArchive")}
            disabled={!targetId}
            busy={busy}
            onPress={() => void run(() => moveStudentsAndArchive(store, id, targetId))}
          />
        </>
      ) : (
        <Text tone="muted">{t("classes.noOtherClass")}</Text>
      )}
      <Button
        variant="destructive"
        label={t("classes.archiveAll")}
        busy={busy}
        onPress={() => void run(() => archiveClassWithStudents(store, id))}
      />
      <Button variant="plain" label={t("common.cancel")} onPress={() => router.back()} />
    </Sheet>
  );
}
