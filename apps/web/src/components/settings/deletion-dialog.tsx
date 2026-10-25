"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PASSWORD_MAX } from "@qct/core/shared/access";
import { deletionErrorKey, type ApiResult } from "@qct/core/shared/api";

/**
 * Deleting one's account or the center (PLAN.md §0 #50): what goes, the
 * password again, then a destructive button. `onDeleted` runs once the
 * server has deleted it (the caller forgets the device and leaves).
 */
export function DeletionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitLabel,
  onDelete,
  onDeleted,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children?: ReactNode;
  submitLabel: string;
  onDelete: (password: string) => Promise<ApiResult<unknown>>;
  onDeleted: () => Promise<void>;
}>) {
  const t = useTranslations("deletion");
  const tCommon = useTranslations("common");
  const passwordId = useId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function changeOpen(next: boolean) {
    if (!next) {
      setPassword("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await onDelete(password);
      if (!result.ok) {
        setError(t(`errors.${deletionErrorKey(result.code)}`));
        return;
      }
      await onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={passwordId}>{t("password")}</FieldLabel>
            <Input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={PASSWORD_MAX}
              className="h-12"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
            />
            <FieldDescription>{t("passwordHint")}</FieldDescription>
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => changeOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              className="h-11 bg-destructive text-white hover:bg-destructive/90"
              disabled={busy || password === ""}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
