"use client";

import { useTranslations } from "next-intl";
import { LogoutSection } from "@/components/settings/logout-section";
import { PageContainer, PageHeader } from "@/components/shell/page";

/** Settings (Phase 6 adds profile, password, theme and sync details). */
export default function SettingsPage() {
  const t = useTranslations("settings");
  return (
    <PageContainer>
      <PageHeader title={t("title")} />
      <LogoutSection />
    </PageContainer>
  );
}
