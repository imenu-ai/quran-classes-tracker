"use client";

import { Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ClassCard } from "@/components/classes/class-card";
import { ClassFormDrawer } from "@/components/classes/class-form-drawer";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClassList } from "@/client/data/classes";

export default function HomePage() {
  const t = useTranslations();
  const router = useRouter();
  const list = useClassList();
  const [creating, setCreating] = useState(false);

  const createButton = (
    <Button size="lg" className="h-11" onClick={() => setCreating(true)}>
      <Plus aria-hidden />
      {t("classes.create")}
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader title={t("classes.title")} actions={list?.active.length ? createButton : null} />

      <Link
        href="/search"
        className="flex h-12 items-center gap-2 rounded-lg border bg-background px-3 text-muted-foreground hover:bg-accent/40"
      >
        <Search className="size-5" aria-hidden />
        {t("search.placeholder")}
      </Link>

      {list === undefined ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <span className="sr-only">{t("common.loading")}</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : list.active.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("classes.emptyTitle")}
          description={t("classes.emptyDescription")}
          action={createButton}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.active.map((summary) => (
            <li key={summary.record.id}>
              <ClassCard summary={summary} />
            </li>
          ))}
        </ul>
      )}

      <ClassFormDrawer
        open={creating}
        onOpenChange={setCreating}
        onSaved={(record) => router.push(`/class?id=${record.id}`)}
      />
    </PageContainer>
  );
}
