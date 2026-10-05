"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useTranslations } from "next-intl";
import { useApp } from "@/client/app-context";
import { PageContainer, PageHeader } from "@/components/shell/page";

/** Temporary home; step 3.2 replaces it with the class list. */
export function HomePlaceholder() {
  const t = useTranslations();
  const { session, db } = useApp();
  const classes = useLiveQuery(() => db.classes.filter((c) => c.deletedAt === null).count(), [db]);
  const students = useLiveQuery(
    () => db.students.filter((s) => s.deletedAt === null).count(),
    [db],
  );

  return (
    <PageContainer>
      <PageHeader title={t("classes.title")} />
      <p className="text-xl" dir="auto">
        {t("home.greeting", { name: session.name })}
      </p>
      <p className="text-muted-foreground">
        {t("home.localData", { classes: classes ?? 0, students: students ?? 0 })}
      </p>
    </PageContainer>
  );
}
