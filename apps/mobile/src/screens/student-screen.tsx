import { Alert, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { archiveStudent, unarchiveStudent } from "@qct/core/data/entities/students";
import { ageFromBirthYear, todayInTimeZone } from "@qct/core/domain/dates/local-date";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { useToolbarIcon } from "@/components/icons";
import { Badge, Loading } from "@/components/loading";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useAccess } from "@/data/access";
import { useApp } from "@/data/app-data";
import { useClass, useStudent } from "@/data/queries";
import { useTheme } from "@/theme/theme";

/**
 * A student's page, opened from a class or from search (both stacks route
 * here). For now their details and the actions menu (edit, move, archive);
 * the today card and the month table come in 2.9.
 */
export default function StudentScreen() {
  const t = useTranslations();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store, session } = useApp();
  const { colors } = useTheme();
  const canManage = useAccess().can("students.manage");
  const student = useStudent(id);
  const cls = useClass(student?.classId ?? null);
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
  const age = ageFromBirthYear(student.birthYear, todayInTimeZone(session.timezone));

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
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Detail label={t("students.class")} value={cls?.name ?? t("common.noValue")} />
          <Detail
            label={t("students.birthYear")}
            value={String(student.birthYear)}
            extra={t("students.age", { age })}
          />
          <Detail
            label={t("students.direction")}
            value={t(`students.${student.memorizationDirection}`)}
          />
          {student.note ? <Detail label={t("students.note")} value={student.note} /> : null}
          {student.parentId ? (
            <Detail label={t("students.parentId")} value={student.parentId} ltr />
          ) : null}
        </View>
      </Screen>
    </>
  );
}

/** A labelled detail; `extra` adds a muted line (two numbers on one line could reorder in RTL). */
function Detail({
  label,
  value,
  extra,
  ltr = false,
}: Readonly<{ label: string; value: string; extra?: string; ltr?: boolean }>) {
  return (
    <View style={styles.detail}>
      <Text tone="muted" size={14}>
        {label}
      </Text>
      <Text style={ltr ? styles.ltr : undefined}>{value}</Text>
      {extra ? (
        <Text tone="muted" size={14}>
          {extra}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  detail: { gap: 2 },
  // Digits keep their own order inside Arabic text.
  ltr: { writingDirection: "ltr" },
});
