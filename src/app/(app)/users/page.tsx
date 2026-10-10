"use client";

import { ShieldAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/shell/page";
import { UserEditor } from "@/components/users/user-editor";
import { UsersView } from "@/components/users/users-view";
import { useAccess } from "@/client/access";

/** /users (the list) and /users?id=new | <id> (create or edit). Admins only. */
function UsersPageContent() {
  const t = useTranslations("users");
  const id = useSearchParams().get("id");
  if (!useAccess().isAdmin) {
    return (
      <PageContainer>
        <EmptyState icon={ShieldAlert} title={t("adminsOnly")} />
      </PageContainer>
    );
  }
  return id ? <UserEditor userId={id} /> : <UsersView />;
}

export default function UsersPage() {
  return (
    <Suspense>
      <UsersPageContent />
    </Suspense>
  );
}
