import { Pressable, StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { sortCenterUsers, type CenterUser } from "@qct/core/shared/center-users";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Chevron, useToolbarIcon } from "@/components/icons";
import { Badge, Loading } from "@/components/loading";
import { Screen } from "@/components/screen";
import { SyncIndicator } from "@/components/sync-indicator";
import { Text } from "@/components/text";
import { useCenterUsers } from "@/data/account";
import { useAccess } from "@/data/access";
import { useApp } from "@/data/app-data";
import { useTheme } from "@/theme/theme";

/** The admin's list of the center's users, like the web's (needs a connection). */
export default function UsersScreen() {
  const t = useTranslations("users");
  const { session } = useApp();
  const isAdmin = useAccess().isAdmin;
  const { state, reload } = useCenterUsers();
  const addIcon = useToolbarIcon("person.badge.plus", "person_add");
  const add = () => router.push({ pathname: "/users/[id]", params: { id: "new" } });

  if (!isAdmin) {
    return (
      <Screen>
        <EmptyState title={t("adminsOnly")} />
      </Screen>
    );
  }

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon={addIcon} onPress={add} accessibilityLabel={t("add")}>
          {t("add")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Screen>
        <SyncIndicator />
        {state.status === "loading" ? <Loading /> : null}
        {state.status === "error" ? (
          <>
            <EmptyState
              title={state.code === "OFFLINE" ? t("errors.offline") : t("errors.loadFailed")}
            />
            <Button variant="plain" label={t("retry")} onPress={() => void reload()} />
          </>
        ) : null}
        {state.status === "ready"
          ? sortCenterUsers(state.users, session.userId).map((user) => (
              <UserRow key={user.id} user={user} isSelf={user.id === session.userId} />
            ))
          : null}
      </Screen>
    </>
  );
}

function UserRow({ user, isSelf }: Readonly<{ user: CenterUser; isSelf: boolean }>) {
  const t = useTranslations("users");
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/users/[id]", params: { id: user.id } })}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { borderColor: colors.border, backgroundColor: pressed ? colors.accent : colors.card },
      ]}
    >
      <View style={styles.texts}>
        <Text weight="semibold" numberOfLines={2}>
          {user.name}
        </Text>
        <Text tone="muted" size={14} style={styles.ltr}>
          {user.username}
        </Text>
        <View style={styles.badges}>
          {isSelf ? <Badge label={t("you")} /> : null}
          <Badge label={user.role === "admin" ? t("roleAdmin") : t("roleTeacher")} />
          {user.role === "teacher" ? (
            <Text tone="muted" size={14}>
              {t("classCount", { count: user.classIds.length })}
            </Text>
          ) : null}
          {user.disabled ? (
            <Badge label={t("statusDisabled")} background={colors.destructive} color="#ffffff" />
          ) : user.mustChangePassword ? (
            <Badge label={t("statusMustChange")} />
          ) : null}
        </View>
      </View>
      <Chevron />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  texts: { flex: 1, gap: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  // Latin user names keep their own order inside Arabic text.
  ltr: { writingDirection: "ltr" },
});
