"use client";

import { ChevronRight, ShieldAlert, UserPlus, Users, WifiOff } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DirectionalIcon } from "@/components/directional-icon";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/client/app-context";
import { useCenterUsers, type CenterUser } from "@/client/data/users";

/** The admin's list of the center's users (needs a connection). */
export function UsersView() {
  const t = useTranslations("users");
  const { session } = useApp();
  const { state, reload } = useCenterUsers();

  const addButton = (
    <Button asChild size="lg" className="h-11">
      <Link href="/users?id=new">
        <UserPlus aria-hidden />
        {t("add")}
      </Link>
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader title={t("title")} actions={addButton} />
      {state.status === "loading" && (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}
      {state.status === "error" && (
        <EmptyState
          icon={state.code === "OFFLINE" ? WifiOff : ShieldAlert}
          title={state.code === "OFFLINE" ? t("errors.offline") : t("errors.loadFailed")}
          action={
            <Button variant="outline" className="h-11" onClick={() => void reload()}>
              {t("retry")}
            </Button>
          }
        />
      )}
      {state.status === "ready" &&
        (state.users.length === 0 ? (
          <EmptyState icon={Users} title={t("title")} action={addButton} />
        ) : (
          <ul className="flex flex-col gap-2">
            {sortUsers(state.users, session.userId).map((user) => (
              <li key={user.id}>
                <UserRow user={user} isSelf={user.id === session.userId} />
              </li>
            ))}
          </ul>
        ))}
    </PageContainer>
  );
}

/** You first, then admins, then everyone else by name. */
function sortUsers(users: readonly CenterUser[], selfId: string) {
  const rank = (user: CenterUser) => (user.id === selfId ? 0 : user.role === "admin" ? 1 : 2);
  return [...users].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

function UserRow({ user, isSelf }: { user: CenterUser; isSelf: boolean }) {
  const t = useTranslations("users");
  return (
    <Link
      href={`/users?id=${user.id}`}
      className="group flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <span dir="auto" className="truncate font-semibold">
            {user.name}
          </span>
          {isSelf && <Badge variant="outline">{t("you")}</Badge>}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span dir="auto">{user.username}</span>
          <Badge variant="secondary">
            {user.role === "admin" ? t("roleAdmin") : t("roleTeacher")}
          </Badge>
          {user.role === "teacher" && (
            <span>{t("classCount", { count: user.classIds.length })}</span>
          )}
          {user.disabled && <Badge variant="destructive">{t("statusDisabled")}</Badge>}
          {!user.disabled && user.mustChangePassword && (
            <Badge variant="outline">{t("statusMustChange")}</Badge>
          )}
        </span>
      </div>
      <DirectionalIcon
        icon={ChevronRight}
        className="size-5 shrink-0 text-muted-foreground group-hover:text-foreground"
      />
    </Link>
  );
}
