import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { moveStudent } from "@qct/core/data/entities/students";
import { Button } from "@/components/button";
import { PickerField } from "@/components/picker-field";
import { Sheet } from "@/components/sheet";
import { Text } from "@/components/text";
import { useApp } from "@/data/app-data";
import { useActiveClasses, useStudent } from "@/data/queries";

/** Form sheet: moves a student to another active class; their history goes with them. */
export default function MoveStudentSheet() {
  const t = useTranslations();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store } = useApp();
  const student = useStudent(id);
  const options = (useActiveClasses() ?? []).filter((c) => c.id !== student?.classId);
  const [targetId, setTargetId] = useState("");

  async function move() {
    await moveStudent(store, id, targetId);
    router.back();
  }

  return (
    <Sheet title={t("students.moveTitle")} description={student?.fullName}>
      {options.length > 0 ? (
        <PickerField
          label={t("students.moveTo")}
          placeholder={t("students.moveTo")}
          value={targetId}
          onChange={setTargetId}
          options={options.map((c) => ({ value: c.id, label: c.name }))}
        />
      ) : (
        <Text tone="muted">{t("classes.noOtherClass")}</Text>
      )}
      <Button label={t("students.move")} disabled={!targetId} onPress={() => void move()} />
      <Button variant="plain" label={t("common.cancel")} onPress={() => router.back()} />
    </Sheet>
  );
}
