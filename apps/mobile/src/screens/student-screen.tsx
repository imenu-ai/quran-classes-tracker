import { Alert } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { archiveStudent, unarchiveStudent } from "@qct/core/data/entities/students";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { useToolbarIcon } from "@/components/icons";
import { Badge, Loading } from "@/components/loading";
import { MonthTable } from "@/components/month-table";
import { Screen } from "@/components/screen";
import { TodayCard } from "@/components/today-card";
import { useAccess } from "@/data/access";
import { useApp } from "@/data/app-data";
import { useStudent, useStudentProfile } from "@/data/queries";

/**
 * A student's page, opened from a class or from search (both stacks route
 * here), like the web's: their month as a table, then today (attendance,
 * marks, postponing, the next day's homework). Their details are in the
 * actions menu (edit student).
 */
export default function StudentScreen() {
  const t = useTranslations();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store } = useApp();
  const access = useAccess();
  const canManage = access.can("students.manage");
  const student = useStudent(id);
  const profile = useStudentProfile(id);
  const menuIcon = useToolbarIcon("ellipsis.circle", "more_vert");

  if (student === undefined) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (student === null || student.deletedAt !== null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("students.notFound") }} />
        <EmptyState title={t("students.notFound")} />
        <Button variant="plain" label={t("common.backHome")} onPress={() => router.back()} />
      </Screen>
    );
  }

  const archived = student.archivedAt !== null;
  const confirmArchive = () =>
    Alert.alert(t("students.archiveConfirmTitle"), t("students.archiveConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("students.archive"),
        style: "destructive",
        onPress: () => void archiveStudent(store, student.id),
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: student.fullName }} />
      {canManage ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon={menuIcon} accessibilityLabel={t("students.actions")}>
            <Stack.Toolbar.Label>{t("common.options")}</Stack.Toolbar.Label>
            <Stack.Toolbar.MenuAction
              onPress={() => router.push({ pathname: "/student-form", params: { id: student.id } })}
            >
              {t("students.edit")}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              onPress={() => router.push({ pathname: "/move-student", params: { id: student.id } })}
            >
              {t("students.move")}
            </Stack.Toolbar.MenuAction>
            {archived ? (
              <Stack.Toolbar.MenuAction onPress={() => void unarchiveStudent(store, student.id)}>
                {t("students.unarchive")}
              </Stack.Toolbar.MenuAction>
            ) : (
              <Stack.Toolbar.MenuAction destructive onPress={confirmArchive}>
                {t("students.archive")}
              </Stack.Toolbar.MenuAction>
            )}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      <Screen>
        {archived ? <Badge label={t("students.archivedBadge")} /> : null}
        {profile && access.can("reports.view") ? (
          // Without lessons.run the table is shown, not edited.
          <MonthTable profile={profile} student={student} editable={access.can("lessons.run")} />
        ) : null}
        {/* Today: attendance, marks, postponing and the next day's homework. */}
        {!archived ? <TodayCard student={student} /> : null}
      </Screen>
    </>
  );
}
