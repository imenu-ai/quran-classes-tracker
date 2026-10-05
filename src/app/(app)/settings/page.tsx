"use client";

import { useTranslations } from "next-intl";
import { LogoutSection } from "@/components/settings/logout-section";
import { PasswordSection } from "@/components/settings/password-section";
import { ProfileSection } from "@/components/settings/profile-section";
import { SyncSection } from "@/components/settings/sync-section";
import { ThemeSection } from "@/components/settings/theme-section";
import { PageContainer, PageHeader } from "@/components/shell/page";

/** Profile, password, appearance, sync details and sign-out. */
export default function SettingsPage() {
  const t = useTranslations("settings");
  return (
    <PageContainer className="max-w-2xl">
      <PageHeader title={t("title")} />
      <SyncSection />
      <ProfileSection />
      <PasswordSection />
      <ThemeSection />
      <LogoutSection />
    </PageContainer>
  );
}
