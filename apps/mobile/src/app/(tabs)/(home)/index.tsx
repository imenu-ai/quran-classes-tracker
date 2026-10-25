import { router, Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { unarchiveClass } from "@qct/core/data/entities/classes";
import { ArchivedList } from "@/components/archived-list";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { useToolbarIcon } from "@/components/icons";
import { ListRow } from "@/components/list-row";
import { Loading } from "@/components/loading";
import { Screen } from "@/components/screen";
import { SyncIndicator } from "@/components/sync-indicator";
import { useAccess } from "@/data/access";
import { useApp } from "@/data/app-data";
import { useClassList } from "@/data/queries";

/** The classes: one row each with its student count, and the archived ones below. */
export default function HomeScreen() {
  const t = useTranslations();
  const { store } = useApp();
  const list = useClassList();
  const canManage = useAccess().can("classes.manage");
  const addIcon = useToolbarIcon("plus", "add");
  const create = () => router.push("/class-form");
  const open = (id: string) => router.push({ pathname: "/class/[id]", params: { id } });

  return (
    <>
      {canManage && list?.active.length ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={addIcon}
            onPress={create}
            accessibilityLabel={t("classes.create")}
          >
            {t("classes.create")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <Screen>
        <SyncIndicator />
        {list === undefined ? (
          <Loading />
        ) : list.active.length === 0 ? (
          <>
            <EmptyState
              title={canManage ? t("classes.emptyTitle") : t("classes.emptyAssignedTitle")}
              description={
                canManage ? t("classes.emptyDescription") : t("classes.emptyAssignedDescription")
              }
            />
            {canManage ? <Button label={t("classes.create")} onPress={create} /> : null}
          </>
        ) : (
          list.active.map(({ record, studentCount }) => (
            <ListRow
              key={record.id}
              title={record.name}
              subtitle={t("classes.studentCount", { count: studentCount })}
              onPress={() => open(record.id)}
            />
          ))
        )}
        {list ? (
          <ArchivedList
            title={t("classes.archivedTitle")}
            items={list.archived}
            restoreLabel={t("classes.unarchive")}
            onOpen={open}
            onRestore={canManage ? (id) => void unarchiveClass(store, id) : undefined}
          />
        ) : null}
      </Screen>
    </>
  );
}
