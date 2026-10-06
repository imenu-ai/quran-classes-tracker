"use client";

import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/client/app-context";
import { startLesson } from "@/client/data/lessons";
import { todayInTimeZone } from "@/domain/dates/local-date";
import { cn } from "@/lib/utils";

/** "درس جديد": opens today's lesson for the class, creating it only if needed. */
export function StartLessonButton({
  classId,
  hasLessonToday = false,
  className,
}: {
  classId: string;
  hasLessonToday?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { store, session } = useApp();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const lesson = await startLesson(store, classId, todayInTimeZone(session.timezone));
      router.push(`/lesson?id=${lesson.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="lg"
      variant={hasLessonToday ? "secondary" : "default"}
      className={cn("h-12 text-base", className)}
      disabled={busy}
      onClick={() => void start()}
    >
      <CalendarPlus aria-hidden />
      {t(hasLessonToday ? "lessons.open" : "glossary.newLesson")}
    </Button>
  );
}
