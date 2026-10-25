import { StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { unarchiveClass } from "@qct/core/data/entities/classes";
import { unarchiveStudent } from "@qct/core/data/entities/students";
import { ageFromBirthYear, todayInTimeZone } from "@qct/core/domain/dates/local-date";
import { ArchivedList } from "@/components/archived-list";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Grid } from "@/components/grid";
import { useToolbarIcon } from "@/components/icons";
import { ListRow } from "@/components/list-row";
import { Badge, Loading } from "@/components/loading";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useAccess } from "@/data/access";
import { useApp } from "@/data/app-data";
import { useClass, useClassStudents } from "@/data/queries";

/** A class: its students (tapping one opens their page), and the archived ones. */
export default function ClassScreen() {
  const t = useTranslations();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store, session } = useApp();
  const access = useAccess();
  const cls = useClass(id);
  const students = useClassStudents(id);
  const menuIcon = useToolbarIcon("ellipsis.circle", "more_vert");

  if (cls === undefined || students === undefined) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (cls === null || cls.deletedAt !== null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t("classes.notFound") }} />
        <EmptyState title={t("classes.notFound")} />
        <Button variant="plain" label={t("common.backHome")} onPress={() => router.back()} />
      </Screen>
    );
  }

  const archived = cls.archivedAt !== null;
  const today = todayInTimeZone(session.timezone);
  const openStudent = (studentId: string) =>
    router.push({ pathname: "/student/[id]", params: { id: studentId } });
  const addButton = access.can("students.manage") ? (
    <Button
      label={t("students.add")}
      onPress={() => router.push({ pathname: "/student-form", params: { classId: cls.id } })}
    />
  ) : null;

  return (
    <>
      <Stack.Screen options={{ title: cls.name }} />
      {access.can("classes.manage") ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon={menuIcon} accessibilityLabel={t("classes.actions")}>
            <Stack.Toolbar.Label>{t("common.options")}</Stack.Toolbar.Label>
            <Stack.Toolbar.MenuAction
              onPress={() => router.push({ pathname: "/class-form", params: { id: cls.id } })}
            >
              {t("classes.rename")}
            </Stack.Toolbar.MenuAction>
            {archived ? (
              <Stack.Toolbar.MenuAction onPress={() => void unarchiveClass(store, cls.id)}>
                {t("classes.unarchive")}
              </Stack.Toolbar.MenuAction>
            ) : (
              <Stack.Toolbar.MenuAction
                destructive
                onPress={() => router.push({ pathname: "/archive-class", params: { id: cls.id } })}
              >
                {t("classes.archive")}
              </Stack.Toolbar.MenuAction>
            )}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      <Screen>
        {archived ? <Badge label={t("classes.archivedBadge")} /> : null}
        {students.active.length === 0 ? (
          <>
            <EmptyState
              title={t("students.emptyTitle")}
              description={t("students.emptyDescription")}
            />
            {addButton}
          </>
        ) : (
          <>
            <View style={styles.heading}>
              <Text tone="muted" weight="semibold">
                {t("classes.studentCount", { count: students.active.length })}
              </Text>
            </View>
            {access.can("reports.view") ? (
              <Button
                variant="plain"
                label={t("classStats.button")}
                onPress={() =>
                  router.push({ pathname: "/class-stats/[id]", params: { id: cls.id } })
                }
              />
            ) : null}
            {addButton}
            <Grid maxColumns={2}>
              {students.active.map((student) => (
                <ListRow
                  key={student.id}
                  title={student.fullName}
                  subtitle={t("students.age", { age: ageFromBirthYear(student.birthYear, today) })}
                  onPress={() => openStudent(student.id)}
                />
              ))}
            </Grid>
          </>
        )}
        <ArchivedList
          title={t("students.archivedTitle")}
          items={students.archived.map((student) => ({ id: student.id, name: student.fullName }))}
          restoreLabel={t("students.unarchive")}
          onOpen={openStudent}
          onRestore={
            access.can("students.manage") ? (sid) => void unarchiveStudent(store, sid) : undefined
          }
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { paddingTop: 4 },
});
