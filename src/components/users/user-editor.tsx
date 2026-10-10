"use client";

import { KeyRound, SearchX, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/client/app-context";
import { useActiveClasses } from "@/client/data/classes";
import {
  createUser,
  setUserPassword,
  updateUser,
  useCenterUsers,
  type CenterUser,
  type UsersErrorCode,
} from "@/client/data/users";
import { bootstrapSession } from "@/client/session/session";
import { toWesternDigits } from "@/domain/text/digits";
import { useErrorMessage } from "@/i18n/use-error-message";
import {
  createMemberSchema,
  PASSWORD_MAX,
  PERMISSIONS,
  PHONE_MAX,
  updateMemberSchema,
  USERNAME_MAX,
  type Permission,
  type Role,
} from "@/shared/access";
import { parseWithCodes, type FieldError as CodedError } from "@/shared/schemas/errors";

const PERMISSION_KEY: Record<
  Permission,
  "classesManage" | "studentsManage" | "lessonsRun" | "reportsView"
> = {
  "classes.manage": "classesManage",
  "students.manage": "studentsManage",
  "lessons.run": "lessonsRun",
  "reports.view": "reportsView",
};

type FieldName = "name" | "username" | "phone" | "password";

/** /users?id=new or /users?id=<user id>: create or edit a user (admin only). */
export function UserEditor({ userId }: { userId: string }) {
  const t = useTranslations("users");
  const { state, reload } = useCenterUsers();
  const isNew = userId === "new";

  if (isNew) return <UserForm onSaved={reload} />;
  if (state.status === "loading") {
    return (
      <PageContainer aria-busy="true">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }
  const user = state.status === "ready" ? state.users.find((u) => u.id === userId) : undefined;
  if (!user) {
    return (
      <PageContainer>
        <PageHeader title={t("editTitle")} backHref="/users" />
        <EmptyState
          icon={SearchX}
          title={
            state.status === "error" && state.code === "OFFLINE"
              ? t("errors.offline")
              : t("notFound")
          }
          action={
            <Button asChild variant="outline">
              <Link href="/users">{t("title")}</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }
  return <UserForm key={user.id} user={user} onSaved={reload} />;
}

function UserForm({ user, onSaved }: { user?: CenterUser; onSaved: () => Promise<void> }) {
  const t = useTranslations("users");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const { engine, session } = useApp();
  const classes = useActiveClasses();
  const id = useId();
  const isNew = !user;
  const isSelf = user?.id === session.userId;

  const [role, setRole] = useState<Role>(user?.role ?? "teacher");
  const [permissions, setPermissions] = useState<Set<Permission>>(
    new Set(user?.permissions ?? ["lessons.run", "reports.view"]),
  );
  const [classIds, setClassIds] = useState<Set<string>>(new Set(user?.classIds ?? []));
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  function showError(code: UsersErrorCode, fieldErrors: readonly CodedError[] = []) {
    if (code === "INVALID_INPUT") {
      const next: Partial<Record<FieldName, string>> = {};
      for (const error of fieldErrors) {
        const field = error.path as FieldName;
        if (!next[field]) next[field] = errorMessage(error);
      }
      setErrors(next);
      return;
    }
    if (code === "USERNAME_TAKEN") return setErrors({ username: t("errors.usernameTaken") });
    const key =
      code === "LAST_ADMIN"
        ? "lastAdmin"
        : code === "CLASS_NOT_FOUND"
          ? "classNotFound"
          : code === "OFFLINE"
            ? "offline"
            : "generic";
    setFormError(t(`errors.${key}`));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: FieldName) => String(data.get(name) ?? "");
    const access = {
      role,
      permissions: [...permissions],
      classIds: role === "teacher" ? [...classIds] : [],
    };
    const input = isNew
      ? {
          name: text("name"),
          username: text("username"),
          phone: toWesternDigits(text("phone")),
          password: text("password"),
          ...access,
        }
      : {
          name: text("name"),
          username: text("username"),
          phone: toWesternDigits(text("phone")),
          ...access,
        };
    const parsed = isNew
      ? parseWithCodes(createMemberSchema, input)
      : parseWithCodes(updateMemberSchema, input);
    setErrors({});
    setFormError(null);
    if (!parsed.success) return showError("INVALID_INPUT", parsed.errors);

    setBusy(true);
    try {
      // Classes created on this device must reach the server before they're assigned.
      if (access.classIds.length > 0 && navigator.onLine) await engine.syncNow();
      const result = isNew
        ? await createUser(parsed.data as Parameters<typeof createUser>[0])
        : await updateUser(user.id, parsed.data);
      if (!result.ok) return showError(result.code, result.errors);
      if (isSelf) await bootstrapSession().catch(() => {});
      await onSaved();
      toast.success(isNew ? t("created") : t("saved"));
      router.push("/users");
    } finally {
      setBusy(false);
    }
  }

  const fieldId = (name: string) => `${id}-${name}`;
  const field = (name: FieldName, label: string, input: React.ReactNode, hint?: string) => (
    <Field data-invalid={errors[name] ? true : undefined}>
      <FieldLabel htmlFor={fieldId(name)}>{label}</FieldLabel>
      {input}
      {hint && <FieldDescription>{hint}</FieldDescription>}
      {errors[name] && <FieldError>{errors[name]}</FieldError>}
    </Field>
  );

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader title={isNew ? t("newTitle") : t("editTitle")} backHref="/users" />
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border p-4">
          <h2 className="font-semibold">{t("detailsSection")}</h2>
          {field(
            "name",
            t("name"),
            <Input
              id={fieldId("name")}
              name="name"
              dir="auto"
              defaultValue={user?.name}
              className="h-12"
              aria-invalid={errors.name ? true : undefined}
            />,
          )}
          {field(
            "username",
            t("username"),
            <Input
              id={fieldId("username")}
              name="username"
              dir="auto"
              defaultValue={user?.username}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              maxLength={USERNAME_MAX}
              className="h-12"
              aria-invalid={errors.username ? true : undefined}
            />,
            t("usernameHint"),
          )}
          {field(
            "phone",
            t("phone"),
            <Input
              id={fieldId("phone")}
              name="phone"
              type="tel"
              inputMode="tel"
              dir="auto"
              defaultValue={user?.phone}
              maxLength={PHONE_MAX}
              autoComplete="off"
              className="h-12"
              aria-invalid={errors.phone ? true : undefined}
            />,
            t("phoneHint"),
          )}
          {isNew &&
            field(
              "password",
              t("password"),
              <Input
                id={fieldId("password")}
                name="password"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={PASSWORD_MAX}
                className="h-12"
                aria-invalid={errors.password ? true : undefined}
              />,
              t("passwordHint"),
            )}
        </section>

        <fieldset className="flex flex-col gap-3 rounded-xl border p-4">
          <legend className="px-1 font-semibold">{t("roleSection")}</legend>
          {(["teacher", "admin"] as const).map((value) => (
            <label
              key={value}
              className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="mt-1 size-5 accent-primary"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {value === "admin" ? t("roleAdmin") : t("roleTeacher")}
                </span>
                <span className="text-sm text-muted-foreground">
                  {value === "admin" ? t("roleAdminHint") : t("roleTeacherHint")}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {role === "teacher" && (
          <>
            <fieldset className="flex flex-col gap-1 rounded-xl border p-4">
              <legend className="px-1 font-semibold">{t("permissionsSection")}</legend>
              {PERMISSIONS.map((permission) => (
                <label key={permission} className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={permissions.has(permission)}
                    onChange={() => setPermissions((current) => toggle(current, permission))}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span>{t(`permissions.${PERMISSION_KEY[permission]}`)}</span>
                </label>
              ))}
            </fieldset>

            <fieldset className="flex flex-col gap-1 rounded-xl border p-4">
              <legend className="px-1 font-semibold">{t("classesSection")}</legend>
              {classes && classes.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("noClasses")}</p>
              )}
              {(classes ?? []).map((cls) => (
                <label key={cls.id} className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={classIds.has(cls.id)}
                    onChange={() => setClassIds((current) => toggle(current, cls.id))}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span dir="auto" className="truncate">
                    {cls.name}
                  </span>
                </label>
              ))}
            </fieldset>
          </>
        )}

        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="h-12 text-base" disabled={busy}>
          {isNew ? t("create") : t("save")}
        </Button>
      </form>

      {user && <AccountActions user={user} isSelf={isSelf} onChanged={onSaved} />}
    </PageContainer>
  );
}

/** Reset the password; disable or enable the account. */
function AccountActions({
  user,
  isSelf,
  onChanged,
}: {
  user: CenterUser;
  isSelf: boolean;
  onChanged: () => Promise<void>;
}) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const passwordId = useId();
  const [resetting, setResetting] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const failureText = (code: UsersErrorCode) =>
    t(`errors.${code === "LAST_ADMIN" ? "lastAdmin" : code === "OFFLINE" ? "offline" : "generic"}`);

  async function setPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setBusy(true);
    try {
      const result = await setUserPassword(user.id, password);
      if (!result.ok) {
        const [first] = result.errors;
        setPasswordError(first ? errorMessage(first) : failureText(result.code));
        return;
      }
      setResetting(false);
      toast.success(t("passwordSet"));
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function setDisabled(disabled: boolean) {
    setBusy(true);
    try {
      const result = await updateUser(user.id, { disabled });
      if (!result.ok) {
        toast.error(failureText(result.code));
        return;
      }
      toast.success(disabled ? t("disabledToast") : t("enabledToast"));
      setConfirmingDisable(false);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="font-semibold">{t("accountSection")}</h2>
      {!isSelf && (
        <Button
          variant="outline"
          className="h-11 justify-start"
          onClick={() => {
            setPasswordError(null);
            setResetting(true);
          }}
        >
          <KeyRound aria-hidden />
          {t("resetPassword")}
        </Button>
      )}
      {user.disabled ? (
        <Button
          variant="outline"
          className="h-11 justify-start"
          disabled={busy}
          onClick={() => void setDisabled(false)}
        >
          <UserCheck aria-hidden />
          {t("enable")}
        </Button>
      ) : (
        !isSelf && (
          <Button
            variant="outline"
            className="h-11 justify-start text-destructive"
            onClick={() => setConfirmingDisable(true)}
          >
            <UserX aria-hidden />
            {t("disable")}
          </Button>
        )
      )}
      {isSelf && <p className="text-sm text-muted-foreground">{t("selfHint")}</p>}

      <Dialog open={resetting} onOpenChange={setResetting}>
        <DialogContent>
          <form onSubmit={setPassword} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("resetPassword")}</DialogTitle>
              <DialogDescription>{t("resetPasswordDescription")}</DialogDescription>
            </DialogHeader>
            <Field data-invalid={passwordError ? true : undefined}>
              <FieldLabel htmlFor={passwordId}>{t("newPassword")}</FieldLabel>
              <Input
                id={passwordId}
                name="password"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={PASSWORD_MAX}
                className="h-12"
                aria-invalid={passwordError ? true : undefined}
              />
              <FieldDescription>{t("passwordHint")}</FieldDescription>
              {passwordError && <FieldError>{passwordError}</FieldError>}
            </Field>
            <DialogFooter>
              <Button type="submit" className="h-11" disabled={busy}>
                {t("setPassword")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingDisable} onOpenChange={setConfirmingDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("disableConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("disableConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void setDisabled(true);
              }}
            >
              {t("disable")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
