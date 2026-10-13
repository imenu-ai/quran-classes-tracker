"use client";

import { BookOpenText, LinkIcon, LogOut, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { ParentError, ParentReport as ParentReportData } from "@/shared/parent";
import { ParentReport } from "./parent-report";

type Ask = "WRONG_PARENT_ID" | "TOO_MANY_ATTEMPTS" | "RATE_LIMITED" | null;

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "ask"; error: Ask }
  | { kind: "report"; report: ParentReportData }
  | { kind: "offline" }
  | { kind: "error" };

/** One call to the parent API; the browser sends the remembered-phone cookie. */
async function fetchReport(body: {
  studentId: string;
  parentId?: string;
  month?: string;
}): Promise<{ report: ParentReportData } | { error: ParentError | "NETWORK" | "SERVER" }> {
  let response: Response;
  try {
    response = await fetch("/api/parent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { error: "NETWORK" };
  }
  if (response.ok) return { report: (await response.json()) as ParentReportData };
  const data = (await response.json().catch(() => null)) as { error?: ParentError } | null;
  return { error: data?.error ?? "SERVER" };
}

function stateFor(error: ParentError | "NETWORK" | "SERVER"): State {
  switch (error) {
    case "INVALID_LINK":
    case "INVALID_REQUEST":
      return { kind: "invalid" };
    case "PARENT_ID_REQUIRED":
      return { kind: "ask", error: null };
    case "WRONG_PARENT_ID":
    case "TOO_MANY_ATTEMPTS":
    case "RATE_LIMITED":
      return { kind: "ask", error };
    case "NETWORK":
      return { kind: "offline" };
    default:
      return { kind: "error" };
  }
}

/**
 * The parent page: the student's month from the server, opened with the
 * parent's ID number (remembered on this phone afterwards).
 */
export function ParentView({
  studentId,
  month,
}: {
  studentId: string | null;
  month: string | null;
}) {
  const t = useTranslations("parent");
  const tApp = useTranslations("app");
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(
    async (parentId?: string) => {
      if (!studentId) {
        setState({ kind: "invalid" });
        return;
      }
      const result = await fetchReport({
        studentId,
        ...(parentId !== undefined ? { parentId } : {}),
        ...(month ? { month } : {}),
      });
      setState(
        "report" in result ? { kind: "report", report: result.report } : stateFor(result.error),
      );
    },
    [studentId, month],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const setMonth = (next: string) => {
    const params = new URLSearchParams({ s: studentId ?? "", month: next });
    router.replace(`/parent?${params.toString()}`, { scroll: false });
  };

  async function forget() {
    if (!studentId) return;
    await fetch(`/api/parent?s=${encodeURIComponent(studentId)}`, { method: "DELETE" }).catch(
      () => undefined,
    );
    setState({ kind: "ask", error: null });
  }

  const report = state.kind === "report" ? state.report : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col gap-1 border-b pb-3">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpenText aria-hidden className="size-4 text-primary" />
          {tApp("name")}
        </span>
        {report ? (
          <>
            <p dir="auto" className="text-sm font-medium text-muted-foreground">
              {report.centerName}
            </p>
            <h1 dir="auto" className="text-2xl font-bold">
              {report.studentName}
            </h1>
            <p dir="auto" className="text-muted-foreground">
              {report.className}
            </p>
          </>
        ) : (
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        )}
      </header>

      {state.kind === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">{t("loading")}</span>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
      {state.kind === "invalid" && (
        <EmptyState icon={LinkIcon} title={t("invalidTitle")} description={t("invalidHint")} />
      )}
      {state.kind === "offline" && (
        <EmptyState
          icon={WifiOff}
          title={t("offline")}
          action={<Button onClick={() => void load()}>{t("retry")}</Button>}
        />
      )}
      {state.kind === "error" && (
        <EmptyState
          icon={LinkIcon}
          title={t("error")}
          action={<Button onClick={() => void load()}>{t("retry")}</Button>}
        />
      )}
      {state.kind === "ask" && <ParentIdForm error={state.error} onSubmit={(id) => load(id)} />}
      {report && (
        <>
          <ParentReport report={report} onMonthChange={setMonth} />
          <Button variant="ghost" className="h-11 self-center" onClick={() => void forget()}>
            <LogOut aria-hidden />
            {t("forget")}
          </Button>
        </>
      )}
    </main>
  );
}

function ParentIdForm({
  error,
  onSubmit,
}: {
  error: Ask;
  onSubmit: (parentId: string) => Promise<void>;
}) {
  const t = useTranslations("parent");
  const id = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit(value);
    } finally {
      setBusy(false);
    }
  }

  const message =
    error === "WRONG_PARENT_ID"
      ? t("wrong")
      : error === "TOO_MANY_ATTEMPTS" || error === "RATE_LIMITED"
        ? t("tooMany")
        : null;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("askTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("askHint")}</p>
      </div>
      <Field data-invalid={message ? true : undefined}>
        <FieldLabel htmlFor={id}>{t("parentId")}</FieldLabel>
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          dir="auto"
          maxLength={30}
          className="h-12 text-lg"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={message ? true : undefined}
        />
        {message && <FieldError>{message}</FieldError>}
      </Field>
      <Button type="submit" size="lg" className="h-12" disabled={busy || !value.trim()}>
        {t("show")}
      </Button>
    </form>
  );
}
