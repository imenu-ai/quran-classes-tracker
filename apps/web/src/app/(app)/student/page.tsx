"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StudentView } from "@/components/students/student-view";

/**
 * /student?id=… (query params, so one cached shell serves every student
 * offline), with &date=YYYY-MM-DD for a past day's session.
 */
function StudentPageContent() {
  const params = useSearchParams();
  return <StudentView studentId={params.get("id")} date={params.get("date")} />;
}

export default function StudentPage() {
  return (
    <Suspense>
      <StudentPageContent />
    </Suspense>
  );
}
