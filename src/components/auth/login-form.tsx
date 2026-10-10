"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/client/auth/auth-client";
import {
  normalizeCenterCode,
  readRememberedCenterCode,
  rememberCenterCode,
} from "@/client/auth/center-code";
import { getLoginErrorKey, type LoginErrorKey } from "@/client/auth/login-error";
import { bootstrapSession, startPathFor } from "@/client/session/session";
import { composeUsername, isCenterCode } from "@/shared/access";

type FieldName = "code" | "username" | "password";
type FieldErrors = Partial<Record<FieldName, "REQUIRED" | "invalidCenterCode">>;

export function LoginForm() {
  const t = useTranslations("auth");
  const tValidation = useTranslations("errors.validation");
  const router = useRouter();
  const ids = {
    code: useId(),
    codeHint: useId(),
    username: useId(),
    password: useId(),
    error: useId(),
  };
  const session = authClient.useSession();
  const codeInput = useRef<HTMLInputElement>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<LoginErrorKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Set once the app is being entered, so only one path ever navigates
  // (a late second redirect would yank the user back to the home page).
  const entered = useRef(false);

  // The center code is typed once per device.
  useEffect(() => {
    const input = codeInput.current;
    if (input && !input.value) input.value = readRememberedCenterCode();
  }, []);

  // Already signed in on the server (e.g. local data was cleared): remember
  // the session on this device again and go straight to the app.
  useEffect(() => {
    if (!session.data || entered.current) return;
    entered.current = true;
    void bootstrapSession()
      .then((snapshot) => router.replace(startPathFor(snapshot)))
      .catch(() => {});
  }, [session.data, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Uncontrolled inputs: anything typed before hydration is kept.
    const form = new FormData(event.currentTarget);
    const code = normalizeCenterCode(String(form.get("code") ?? ""));
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const errors: FieldErrors = {};
    if (!code) errors.code = "REQUIRED";
    else if (!isCenterCode(code)) errors.code = "invalidCenterCode";
    if (!username) errors.username = "REQUIRED";
    if (!password) errors.password = "REQUIRED";
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await authClient.signIn.username({
        username: composeUsername(code, username),
        password,
      });
      if (result.error) {
        setError(getLoginErrorKey(result.error, navigator.onLine));
        return;
      }
      rememberCenterCode(code);
      // Remember the user on this device (the offline gate), then enter the
      // app; its first sync is a full pull. The server also set the locale
      // cookie, so refresh to render in that locale.
      if (entered.current) return;
      entered.current = true;
      const snapshot = await bootstrapSession();
      router.replace(startPathFor(snapshot));
      router.refresh();
    } catch {
      setError(getLoginErrorKey(null, navigator.onLine));
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (field: FieldName) => {
    const key = fieldErrors[field];
    if (!key) return null;
    return (
      <p className="text-sm text-destructive">
        {key === "REQUIRED" ? tValidation("REQUIRED") : t(`errors.${key}`)}
      </p>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={onSubmit}
        noValidate
        aria-describedby={error ? ids.error : undefined}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.code}>{t("login.centerCode")}</Label>
          <Input
            ref={codeInput}
            id={ids.code}
            name="code"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            className="h-12 text-center text-lg tracking-[0.3em] tabular-nums"
            aria-describedby={ids.codeHint}
            aria-invalid={fieldErrors.code ? true : undefined}
          />
          <p id={ids.codeHint} className="text-sm text-muted-foreground">
            {t("login.centerCodeHint")}
          </p>
          {fieldError("code")}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.username}>{t("login.username")}</Label>
          <Input
            id={ids.username}
            name="username"
            dir="auto"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-12"
            aria-invalid={fieldErrors.username ? true : undefined}
          />
          {fieldError("username")}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.password}>{t("login.password")}</Label>
          <div className="relative">
            <Input
              id={ids.password}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="h-12 pe-12"
              aria-invalid={fieldErrors.password ? true : undefined}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute inset-y-0 end-0 my-auto me-1 size-10"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
          </div>
          {fieldError("password")}
        </div>

        {error && (
          <p
            id={ids.error}
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {t(`errors.${error}`)}
          </p>
        )}

        <Button type="submit" size="lg" className="h-12 text-base" disabled={submitting}>
          {submitting ? t("login.submitting") : t("login.submit")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t("login.registerPrompt")}{" "}
        <Link
          href="/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("login.registerLink")}
        </Link>
      </p>
    </div>
  );
}
