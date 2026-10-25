import { useState } from "react";
import { Alert } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { toWesternDigits } from "@qct/core/domain/text/digits";
import type { ApiErrorCode } from "@qct/core/shared/api";
import {
  createMemberSchema,
  PASSWORD_MAX,
  PERMISSIONS,
  PHONE_MAX,
  updateMemberSchema,
  USERNAME_MAX,
  type Permission,
  type Role,
} from "@qct/core/shared/access";
import { PERMISSION_MESSAGE_KEY, type CenterUser } from "@qct/core/shared/center-users";
import { parseWithCodes, type FieldError } from "@qct/core/shared/schemas/errors";
import { Button } from "@/components/button";
import { CheckboxList } from "@/components/checkbox-list";
import { ChoiceList } from "@/components/choice-list";
import { EmptyState } from "@/components/empty-state";
import { FormError } from "@/components/form-error";
import { Loading } from "@/components/loading";
import { Screen } from "@/components/screen";
import { Section } from "@/components/section";
import { Text } from "@/components/text";
import { TextField } from "@/components/text-field";
import { createUser, updateUser, useCenterUsers } from "@/data/account";
import { useApp } from "@/data/app-data";
import { useActiveClasses } from "@/data/queries";
import { useErrorMessage } from "@/i18n/use-error-message";
import { useSession } from "@/session/session";

type FieldName = "name" | "username" | "phone" | "password";

/** `users/new` or `users/<id>`: create or edit a user (admins), like the web's editor. */
export default function UserEditorScreen() {
  const t = useTranslations("users");
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, reload } = useCenterUsers();
  if (id === "new") return <UserForm onChanged={reload} />;
  if (state.status === "loading") {
    return (
      <Screen width="narrow">
        <Loading />
      </Screen>
    );
  }
  const user = state.status === "ready" ? state.users.find((u) => u.id === id) : undefined;
  if (!user) {
    return (
      <Screen width="narrow">
        <Stack.Screen options={{ title: t("editTitle") }} />
        <EmptyState
          title={
            state.status === "error" && state.code === "OFFLINE"
              ? t("errors.offline")
              : t("notFound")
          }
        />
      </Screen>
    );
  }
  return <UserForm key={user.id} user={user} onChanged={reload} />;
}

function UserForm({
  user,
  onChanged,
}: Readonly<{ user?: CenterUser; onChanged: () => Promise<void> }>) {
  const t = useTranslations("users");
  const errorMessage = useErrorMessage();
  const { engine, session } = useApp();
  const { enter } = useSession();
  const classes = useActiveClasses();
  const isNew = !user;
  const isSelf = user?.id === session.userId;

  const [values, setValues] = useState<Record<FieldName, string>>({
    name: user?.name ?? "",
    username: user?.username ?? "",
    phone: user?.phone ?? "",
    password: "",
  });
  const [role, setRole] = useState<Role>(user?.role ?? "teacher");
  const [permissions, setPermissions] = useState<ReadonlySet<string>>(
    new Set(user?.permissions ?? ["lessons.run", "reports.view"]),
  );
  const [classIds, setClassIds] = useState<ReadonlySet<string>>(new Set(user?.classIds ?? []));
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (field: FieldName) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const toggle = (current: ReadonlySet<string>, value: string) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  function showError(code: ApiErrorCode, fieldErrors: readonly FieldError[] = []) {
    if (code === "INVALID_INPUT") {
      const next: Partial<Record<FieldName, string>> = {};
      for (const error of fieldErrors) next[error.path as FieldName] ??= errorMessage(error);
      return setErrors(next);
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

  async function save() {
    const access = {
      role,
      permissions: [...permissions] as Permission[],
      classIds: role === "teacher" ? [...classIds] : [],
    };
    const details = {
      name: values.name,
      username: values.username,
      phone: toWesternDigits(values.phone),
    };
    const parsed = isNew
      ? parseWithCodes(createMemberSchema, { ...details, password: values.password, ...access })
      : parseWithCodes(updateMemberSchema, { ...details, ...access });
    setErrors({});
    setFormError(null);
    if (!parsed.success) return showError("INVALID_INPUT", parsed.errors);

    setBusy(true);
    try {
      // Classes created on this device must reach the server before they're assigned.
      if (access.classIds.length > 0) await engine.syncNow();
      const result = isNew
        ? await createUser(parsed.data as Parameters<typeof createUser>[0])
        : await updateUser(user.id, parsed.data);
      if (!result.ok) return showError(result.code, result.errors);
      if (isSelf) await enter().catch(() => {});
      await onChanged();
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen width="narrow">
      <Stack.Screen options={{ title: isNew ? t("newTitle") : t("editTitle") }} />
      <Section title={t("detailsSection")}>
        <TextField
          label={t("name")}
          value={values.name}
          onChangeText={set("name")}
          error={errors.name}
        />
        <TextField
          label={t("username")}
          hint={t("usernameHint")}
          value={values.username}
          onChangeText={set("username")}
          error={errors.username}
          maxLength={USERNAME_MAX}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
        <TextField
          label={t("phone")}
          hint={t("phoneHint")}
          value={values.phone}
          onChangeText={set("phone")}
          error={errors.phone}
          maxLength={PHONE_MAX}
          keyboardType="phone-pad"
          autoComplete="off"
        />
        {isNew ? (
          <TextField
            label={t("password")}
            hint={t("passwordHint")}
            value={values.password}
            onChangeText={set("password")}
            error={errors.password}
            maxLength={PASSWORD_MAX}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />
        ) : null}
      </Section>

      <Section title={t("roleSection")}>
        <ChoiceList
          label={t("roleSection")}
          hideLabel
          value={role}
          onChange={setRole}
          options={[
            { value: "teacher", label: t("roleTeacher"), hint: t("roleTeacherHint") },
            { value: "admin", label: t("roleAdmin"), hint: t("roleAdminHint") },
          ]}
        />
      </Section>

      {role === "teacher" ? (
        <>
          <Section title={t("permissionsSection")}>
            <CheckboxList
              label={t("permissionsSection")}
              selected={permissions}
              onToggle={(value) => setPermissions((current) => toggle(current, value))}
              options={PERMISSIONS.map((permission) => ({
                value: permission,
                label: t(`permissions.${PERMISSION_MESSAGE_KEY[permission]}`),
              }))}
            />
          </Section>
          <Section title={t("classesSection")}>
            {classes && classes.length === 0 ? (
              <Text tone="muted" size={14}>
                {t("noClasses")}
              </Text>
            ) : null}
            <CheckboxList
              label={t("classesSection")}
              selected={classIds}
              onToggle={(value) => setClassIds((current) => toggle(current, value))}
              options={(classes ?? []).map((cls) => ({ value: cls.id, label: cls.name }))}
            />
          </Section>
        </>
      ) : null}

      <FormError message={formError} />
      <Button label={isNew ? t("create") : t("save")} busy={busy} onPress={() => void save()} />

      {user ? <AccountActions user={user} isSelf={isSelf} onChanged={onChanged} /> : null}
    </Screen>
  );
}

/** Reset the password; disable or enable the account. */
function AccountActions({
  user,
  isSelf,
  onChanged,
}: Readonly<{ user: CenterUser; isSelf: boolean; onChanged: () => Promise<void> }>) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const [busy, setBusy] = useState(false);

  async function setDisabled(disabled: boolean) {
    setBusy(true);
    try {
      const result = await updateUser(user.id, { disabled });
      if (!result.ok) {
        const key =
          result.code === "LAST_ADMIN"
            ? "lastAdmin"
            : result.code === "OFFLINE"
              ? "offline"
              : "generic";
        return Alert.alert(t(`errors.${key}`), undefined, [{ text: tCommon("close") }]);
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  const confirmDisable = () =>
    Alert.alert(t("disableConfirmTitle"), t("disableConfirm"), [
      { text: tCommon("cancel"), style: "cancel" },
      { text: t("disable"), style: "destructive", onPress: () => void setDisabled(true) },
    ]);

  return (
    <Section title={t("accountSection")}>
      {!isSelf ? (
        <Button
          variant="plain"
          label={t("resetPassword")}
          onPress={() =>
            router.push({ pathname: "/reset-password", params: { id: user.id, name: user.name } })
          }
        />
      ) : null}
      {user.disabled ? (
        <Button
          variant="plain"
          label={t("enable")}
          busy={busy}
          onPress={() => void setDisabled(false)}
        />
      ) : !isSelf ? (
        <Button variant="destructive" label={t("disable")} busy={busy} onPress={confirmDisable} />
      ) : null}
      {isSelf ? (
        <Text tone="muted" size={14}>
          {t("selfHint")}
        </Text>
      ) : null}
    </Section>
  );
}
