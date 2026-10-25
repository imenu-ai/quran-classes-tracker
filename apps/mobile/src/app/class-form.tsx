import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { createClass, renameClass } from "@qct/core/data/entities/classes";
import { LocalValidationError } from "@qct/core/data/local-store";
import { CLASS_NAME_MAX } from "@qct/core/shared/schemas/class";
import { Button } from "@/components/button";
import { Loading } from "@/components/loading";
import { Sheet } from "@/components/sheet";
import { TextField } from "@/components/text-field";
import { useApp } from "@/data/app-data";
import { useClass } from "@/data/queries";
import { useErrorMessage } from "@/i18n/use-error-message";

/** Form sheet: a new class (then opens it), or a new name with `?id=`. */
export default function ClassFormSheet() {
  const t = useTranslations();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useClass(id ?? null);
  // Renaming waits for the class, so the field starts from its name.
  if (id && existing === undefined) {
    return (
      <Sheet title={t("classes.renameTitle")}>
        <Loading />
      </Sheet>
    );
  }
  return <ClassForm id={id} initialName={existing?.name ?? ""} />;
}

function ClassForm({ id, initialName }: Readonly<{ id?: string; initialName: string }>) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const { store } = useApp();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      if (id) {
        await renameClass(store, id, name);
        router.back();
      } else {
        const created = await createClass(store, name);
        router.back();
        router.push({ pathname: "/class/[id]", params: { id: created.id } });
      }
    } catch (caught) {
      if (!(caught instanceof LocalValidationError)) throw caught;
      const fieldError = caught.errors.find((e) => e.path === "name") ?? caught.errors[0];
      setError(fieldError ? errorMessage(fieldError) : null);
    }
  }

  return (
    <Sheet title={t(id ? "classes.renameTitle" : "classes.createTitle")}>
      <TextField
        testID="class.name"
        label={t("classes.name")}
        placeholder={t("classes.namePlaceholder")}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        error={error}
        maxLength={CLASS_NAME_MAX}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      <Button label={t(id ? "common.save" : "classes.create")} onPress={() => void save()} />
      <Button variant="plain" label={t("common.cancel")} onPress={() => router.back()} />
    </Sheet>
  );
}
