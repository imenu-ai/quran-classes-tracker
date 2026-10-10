"use client";

import { BookOpenText, Search, Settings, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SyncIndicator } from "@/components/sync-indicator";
import { useAccess } from "@/client/access";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  labelKey: "home" | "search" | "users" | "settings";
  icon: LucideIcon;
  /** Other paths that belong to this section. */
  matches: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    labelKey: "home",
    icon: BookOpenText,
    matches: ["/", "/class", "/student", "/lesson"],
  },
  { href: "/search", labelKey: "search", icon: Search, matches: ["/search"] },
  { href: "/users", labelKey: "users", icon: UsersRound, matches: ["/users"] },
  { href: "/settings", labelKey: "settings", icon: Settings, matches: ["/settings"] },
];

/** The nav for this user: "Users" is for center admins only. */
function useNavItems() {
  const { isAdmin } = useAccess();
  return NAV_ITEMS.filter((item) => item.href !== "/users" || isAdmin);
}

function useActiveHref(items: readonly NavItem[]) {
  const pathname = usePathname();
  return items.find((item) => item.matches.includes(pathname))?.href;
}

/**
 * Signed-in layout. Phones: top bar + bottom navigation within thumb reach.
 * Tablets and laptops (md+): a side rail at the start edge and wider content.
 */
export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const t = useTranslations();
  const items = useNavItems();
  const active = useActiveHref(items);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-e bg-sidebar p-4 md:flex">
        <span className="flex items-center gap-2 text-lg font-bold">
          <BookOpenText className="size-6 text-primary" aria-hidden />
          {t("app.shortName")}
        </span>
        <nav aria-label={t("nav.main")} className="flex flex-col gap-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-sidebar-accent",
                active === item.href && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {t(`nav.${item.labelKey}`)}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-2">
            <span className="text-lg font-semibold md:invisible">{t("app.shortName")}</span>
            <SyncIndicator />
          </div>
        </header>

        <main className="flex-1 overflow-x-clip pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </main>
      </div>

      <nav
        aria-label={t("nav.main")}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
      >
        <ul
          className={cn(
            "mx-auto grid max-w-md",
            items.length === 4 ? "grid-cols-4" : "grid-cols-3",
          )}
        >
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active === item.href ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground",
                  active === item.href && "text-primary",
                )}
              >
                <item.icon className="size-6" aria-hidden />
                {t(`nav.${item.labelKey}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
