"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/client/auth/auth-client";
import { getLoginErrorKey, type LoginErrorKey } from "@/client/auth/login-error";

type FieldErrors = Partial<Record<"username" | "password", true>>;

export function LoginForm() {
  const t = useTranslations("auth");
  const tValidation = useTranslations("errors.validation");
  const router = useRouter();
  const ids = { username: useId(), password: useId(), error: useId() };
  const session = authClient.useSession();

  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<LoginErrorKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in: go straight to the app.
  useEffect(() => {
    if (session.data) router.replace("/");
  }, [session.data, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Uncontrolled inputs: anything typed before hydration is kept.
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    const missing: FieldErrors = {};
    if (!username.trim()) missing.username = true;
    if (!password) missing.password = true;
    setFieldErrors(missing);
    setError(null);
    if (missing.username || missing.password) return;

    setSubmitting(true);
    try {
      const result = await authClient.signIn.username({ username: username.trim(), password });
      if (result.error) {
        setError(getLoginErrorKey(result.error, navigator.onLine));
        return;
      }
      // The server set the locale cookie; refresh so the layout picks it up.
      router.replace("/");
      router.refresh();
    } catch {
      setError(getLoginErrorKey(null, navigator.onLine));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-describedby={error ? ids.error : undefined}
      className="flex flex-col gap-5"
    >
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
          aria-invalid={fieldErrors.username}
        />
        {fieldErrors.username && (
          <p className="text-sm text-destructive">{tValidation("REQUIRED")}</p>
        )}
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
            aria-invalid={fieldErrors.password}
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
        {fieldErrors.password && (
          <p className="text-sm text-destructive">{tValidation("REQUIRED")}</p>
        )}
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
  );
}
