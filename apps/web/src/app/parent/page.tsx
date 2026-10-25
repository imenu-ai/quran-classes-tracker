"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ParentView } from "@/components/parent/parent-view";
import { MONTH_PATTERN } from "@qct/core/shared/parent";

/** /parent?s=<studentId>[&month=YYYY-MM]: a student's month for his parent. */
function ParentContent() {
  const params = useSearchParams();
  const month = params.get("month");
  return (
    <ParentView
      studentId={params.get("s")}
      month={month !== null && MONTH_PATTERN.test(month) ? month : null}
    />
  );
}

export default function ParentPage() {
  return (
    <Suspense>
      <ParentContent />
    </Suspense>
  );
}
