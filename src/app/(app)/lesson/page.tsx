"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LessonView } from "@/components/lessons/lesson-view";

/** /lesson?id=…&step=attendance|evaluate (query params keep one cached shell for offline). */
function LessonPageContent() {
  const params = useSearchParams();
  const step = params.get("step") === "evaluate" ? "evaluate" : "attendance";
  return <LessonView lessonId={params.get("id")} step={step} />;
}

export default function LessonPage() {
  return (
    <Suspense>
      <LessonPageContent />
    </Suspense>
  );
}
