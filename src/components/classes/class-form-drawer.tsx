"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useApp } from "@/client/app-context";
import { createClass, renameClass } from "@/client/data/classes";
import { LocalValidationError } from "@/client/db/local-store";
import { useErrorMessage } from "@/i18n/use-error-message";
import { CLASS_NAME_MAX, type ClassRecord } from "@/shared/schemas/class";

/** Bottom sheet to create a class, or rename one when `existing` is given. */
export function ClassFormDrawer({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: ClassRecord;
  onSaved?: (record: ClassRecord) => void;
}) {
  const t = useTranslations();
  const errorMessage = useErrorMessage();
  const { store } = useApp();
  const inputId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setError(null);
    }
  }, [open, existing]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const saved = existing
        ? await renameClass(store, existing.id, name)
        : await createClass(store, name);
      toast.success(t(existing ? "classes.renamed" : "classes.created"));
      onOpenChange(false);
      onSaved?.(saved);
    } catch (caught) {
      if (!(caught instanceof LocalValidationError)) throw caught;
      const fieldError = caught.errors.find((e) => e.path === "name") ?? caught.errors[0];
      setError(fieldError ? errorMessage(fieldError) : null);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent>
        <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>{t(existing ? "classes.renameTitle" : "classes.createTitle")}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4">
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={inputId}>{t("classes.name")}</FieldLabel>
              <Input
                id={inputId}
                dir="auto"
                autoFocus
                className="h-12"
                maxLength={CLASS_NAME_MAX}
                placeholder={t("classes.namePlaceholder")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={error ? true : undefined}
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </div>
          <DrawerFooter className="flex-row">
            <Button type="submit" size="lg" className="h-12 flex-1">
              {t(existing ? "common.save" : "classes.create")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
