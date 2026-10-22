"use client";

import { Check, Copy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useApp } from "@/client/app-context";
import { updateCenterSettings } from "@/client/data/account";
import { bootstrapSession } from "@/client/session/session";
import { timeZoneOptions, type TimeZoneOption } from "@/client/time-zones";
import { useErrorMessage } from "@/i18n/use-error-message";
import { updateCenterSchema } from "@/shared/access";
import { NAME_MAX } from "@/shared/schemas/base";
import { parseWithCodes } from "@/shared/schemas/errors";

/**
 * The center: its code (everyone may need to share it), and for admins its
 * name and time zone. The time zone decides what "today" is for lessons.
 */
export function CenterSection() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const { session } = useApp();
  const isAdmin = session.role === "admin";
  const ids = { name: useId(), timezone: useId() };
  const [zones, setZones] = useState<TimeZoneOption[] | null>(null);
  const [errors, setErrors] = useState<{ name?: string; form?: string }>({});
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin) setZones(timeZoneOptions(locale));
  }, [isAdmin, locale]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(session.centerCode);
      setCopied(true);
      toast.success(t("codeCopied"));
    } catch {
      // Clipboard blocked: the code is on screen.
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = parseWithCodes(updateCenterSchema, {
      name: String(data.get("name") ?? ""),
      timezone: String(data.get("timezone") ?? session.timezone),
    });
    setErrors({});
    if (!parsed.success) {
      const nameError = parsed.errors.find((error) => error.path === "name");
      return setErrors(
        nameError ? { name: errorMessage(nameError) } : { form: t("accountErrors.generic") },
      );
    }
    setBusy(true);
    try {
      const result = await updateCenterSettings(parsed.data);
      if (!result.ok) {
        setErrors({
          form: t(`accountErrors.${result.code === "OFFLINE" ? "offline" : "generic"}`),
        });
        return;
      }
      await bootstrapSession().catch(() => {});
      toast.success(t("centerSaved"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-4">
      <h2 className="font-semibold">{t("centerTitle")}</h2>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{t("centerCode")}</span>
          <span className="text-2xl font-bold tracking-[0.2em] tabular-nums">
            {session.centerCode}
          </span>
          <span className="text-sm text-muted-foreground">{t("centerCodeHint")}</span>
        </div>
        <Button variant="outline" className="h-11" onClick={() => void copy()}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {t("copyCode")}
        </Button>
      </div>

      {isAdmin ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor={ids.name}>{t("centerName")}</FieldLabel>
            <Input
              id={ids.name}
              name="name"
              dir="auto"
              className="h-12"
              maxLength={NAME_MAX}
              defaultValue={session.tenantName}
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name && <FieldError>{errors.name}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.timezone}>{t("timezone")}</FieldLabel>
            <select
              id={ids.timezone}
              name="timezone"
              key={zones ? "ready" : "loading"}
              defaultValue={session.timezone}
              disabled={!zones}
              className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {(zones ?? [{ value: session.timezone, label: session.timezone }]).map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </select>
          </Field>
          {errors.form && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errors.form}
            </p>
          )}
          <Button type="submit" className="h-11 self-start" disabled={busy}>
            {tCommon("save")}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{t("centerName")}</span>
          <span dir="auto" className="font-medium">
            {session.tenantName}
          </span>
        </div>
      )}
    </section>
  );
}
