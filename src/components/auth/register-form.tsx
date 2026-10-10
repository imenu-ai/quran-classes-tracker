"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { rememberCenterCode } from "@/client/auth/center-code";
import { bootstrapSession, startPathFor } from "@/client/session/session";
import { timeZoneOptions, type TimeZoneOption } from "@/client/time-zones";
import { DEFAULT_TIME_ZONE, toAppLocale } from "@/i18n/config";
import { useErrorMessage } from "@/i18n/use-error-message";
import { PASSWORD_MAX, registerCenterSchema, USERNAME_MAX } from "@/shared/access";
import { parseWithCodes, type FieldError as CodedError } from "@/shared/schemas/errors";

const FIELDS = ["centerName", "timezone", "adminName", "email", "username", "password"] as const;
type FieldName = (typeof FIELDS)[number];
type FormErrors = Partial<Record<FieldName, string>>;
type FormErrorKey = "emailTaken" | "rateLimited" | "offline" | "generic";

interface Registered {
  code: string;
  centerName: string;
}

/** The device's own time zone when known, else the app default. */
function deviceTimeZone(options: readonly TimeZoneOption[]): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return options.some((option) => option.value === zone) ? zone : DEFAULT_TIME_ZONE;
}

/** Public registration of a center and its admin, then the center code to share. */
export function RegisterForm() {
  const t = useTranslations("auth.register");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const id = useId();
  const fieldId = (field: FieldName) => `${id}-${field}`;

  const [zones, setZones] = useState<{ options: TimeZoneOption[]; initial: string } | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<FormErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState<Registered | null>(null);

  // Built on the device: labels follow the locale, the default follows the device.
  useEffect(() => {
    const options = timeZoneOptions(locale);
    setZones({ options, initial: deviceTimeZone(options) });
  }, [locale]);

  const toFormErrors = (list: readonly CodedError[]): FormErrors => {
    const result: FormErrors = {};
    for (const error of list) {
      const field = error.path as FieldName;
      if (FIELDS.includes(field) && !result[field]) result[field] = errorMessage(error);
    }
    return result;
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      ...Object.fromEntries(FIELDS.map((field) => [field, String(data.get(field) ?? "")])),
      locale: toAppLocale(locale),
    };
    const parsed = parseWithCodes(registerCenterSchema, values);
    setFormError(null);
    if (!parsed.success) return setErrors(toFormErrors(parsed.errors));
    setErrors({});

    setBusy(true);
    try {
      const response = await fetch("/api/centers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.status === 201) {
        const body = (await response.json()) as Registered;
        rememberCenterCode(body.code);
        setRegistered(body);
        return;
      }
      if (response.status === 400) {
        const body = (await response.json()) as { errors?: CodedError[] };
        setErrors(toFormErrors(body.errors ?? []));
        return;
      }
      if (response.status === 409) {
        setErrors({ email: t("errors.emailTaken") });
        return;
      }
      setFormError(response.status === 429 ? "rateLimited" : "generic");
    } catch {
      setFormError(navigator.onLine ? "generic" : "offline");
    } finally {
      setBusy(false);
    }
  }

  if (registered) return <CenterCodeCard code={registered.code} />;

  const field = (name: FieldName, label: string, input: React.ReactNode, hint?: string) => (
    <Field data-invalid={errors[name] ? true : undefined}>
      <FieldLabel htmlFor={fieldId(name)}>{label}</FieldLabel>
      {input}
      {hint && <FieldDescription>{hint}</FieldDescription>}
      {errors[name] && <FieldError>{errors[name]}</FieldError>}
    </Field>
  );
  const invalid = (name: FieldName) => (errors[name] ? true : undefined);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 font-semibold">{t("centerSection")}</legend>
          {field(
            "centerName",
            t("centerName"),
            <Input
              id={fieldId("centerName")}
              name="centerName"
              dir="auto"
              autoComplete="organization"
              className="h-12"
              aria-invalid={invalid("centerName")}
            />,
          )}
          {field(
            "timezone",
            t("timezone"),
            <select
              id={fieldId("timezone")}
              name="timezone"
              key={zones?.initial ?? "loading"}
              defaultValue={zones?.initial ?? DEFAULT_TIME_ZONE}
              disabled={!zones}
              aria-invalid={invalid("timezone")}
              className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
            >
              {(zones?.options ?? [{ value: DEFAULT_TIME_ZONE, label: DEFAULT_TIME_ZONE }]).map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ),
              )}
            </select>,
            t("timezoneHint"),
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 font-semibold">{t("adminSection")}</legend>
          {field(
            "adminName",
            t("adminName"),
            <Input
              id={fieldId("adminName")}
              name="adminName"
              dir="auto"
              autoComplete="name"
              className="h-12"
              aria-invalid={invalid("adminName")}
            />,
          )}
          {field(
            "email",
            t("email"),
            <Input
              id={fieldId("email")}
              name="email"
              type="email"
              dir="auto"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              className="h-12"
              aria-invalid={invalid("email")}
            />,
            t("emailHint"),
          )}
          {field(
            "username",
            t("username"),
            <Input
              id={fieldId("username")}
              name="username"
              dir="auto"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={USERNAME_MAX}
              className="h-12"
              aria-invalid={invalid("username")}
            />,
            t("usernameHint"),
          )}
          {field(
            "password",
            t("password"),
            <Input
              id={fieldId("password")}
              name="password"
              type="password"
              autoComplete="new-password"
              maxLength={PASSWORD_MAX}
              className="h-12"
              aria-invalid={invalid("password")}
            />,
            t("passwordHint"),
          )}
        </fieldset>

        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {t(`errors.${formError}`)}
          </p>
        )}

        <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
          {busy ? t("submitting") : t("submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}

/** Shown once after registration: the code teachers will type at sign-in. */
function CenterCodeCard({ code }: { code: string }) {
  const t = useTranslations("auth.register.done");
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [entering, setEntering] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t("copied"));
    } catch {
      // Clipboard blocked: the code stays on screen to copy by hand.
    }
  }

  async function enter() {
    setEntering(true);
    try {
      const snapshot = await bootstrapSession();
      router.replace(startPathFor(snapshot));
      router.refresh();
    } catch {
      setEntering(false);
      router.replace("/login");
    }
  }

  return (
    <section className="flex flex-col items-center gap-5 rounded-xl border p-6 text-center">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("codeLabel")}</span>
        <output className="text-4xl font-bold tracking-[0.25em] tabular-nums" aria-live="polite">
          {code}
        </output>
      </div>
      <p className="text-sm text-muted-foreground">{t("codeHint")}</p>
      <Button variant="outline" className="h-11" onClick={copy}>
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {t("copy")}
      </Button>
      <Button className="h-12 w-full text-base" onClick={enter} disabled={entering}>
        {t("continue")}
      </Button>
    </section>
  );
}
