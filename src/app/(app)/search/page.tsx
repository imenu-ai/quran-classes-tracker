"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";

/** Global student search (filled in at step 3.5). */
export default function SearchPage() {
  const t = useTranslations("search");
  return (
    <PageContainer>
      <PageHeader title={t("title")} />
      <EmptyState icon={Search} title={t("title")} description={t("hint")} />
    </PageContainer>
  );
}
