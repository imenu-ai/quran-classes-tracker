"use client";

import { ChevronRight, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useId, useState } from "react";
import { DirectionalIcon } from "@/components/directional-icon";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useStudentSearch } from "@/client/data/search";

/** Global student search. The query lives in the URL so "back" keeps it. */
function SearchContent() {
  const t = useTranslations();
  const router = useRouter();
  const inputId = useId();
  const urlQuery = useSearchParams().get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const results = useStudentSearch(query);

  // Keep the URL in step with what's typed, but don't navigate when it
  // already matches (on load): that extra navigation could cut off another.
  useEffect(() => {
    if (query === urlQuery) return;
    const url = query ? `/search?q=${encodeURIComponent(query)}` : "/search";
    router.replace(url, { scroll: false });
  }, [query, urlQuery, router]);

  return (
    <PageContainer>
      <PageHeader title={t("search.title")} />
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-5 text-muted-foreground"
        />
        <label htmlFor={inputId} className="sr-only">
          {t("search.label")}
        </label>
        <Input
          id={inputId}
          type="search"
          dir="auto"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus
          className="h-12 ps-10"
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {query.trim() === "" ? (
        <p className="text-sm text-muted-foreground">{t("search.hint")}</p>
      ) : results === undefined ? null : results.length === 0 ? (
        <EmptyState icon={SearchX} title={t("search.noResults")} />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border" aria-live="polite">
          {results.map(({ student, className, archived }) => (
            <li key={student.id}>
              <Link
                href={`/student?id=${student.id}`}
                className="group flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-accent/40"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span dir="auto" className="truncate font-semibold">
                    {student.fullName}
                  </span>
                  {className && (
                    <span dir="auto" className="truncate text-sm text-muted-foreground">
                      {className}
                    </span>
                  )}
                </div>
                {archived && <Badge variant="secondary">{t("students.archivedBadge")}</Badge>}
                <DirectionalIcon
                  icon={ChevronRight}
                  className="size-5 shrink-0 text-muted-foreground group-hover:text-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
