"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StudentView } from "@/components/students/student-view";

/** /student?id=… (query param, so one cached shell serves every student offline). */
function StudentPageContent() {
  const id = useSearchParams().get("id");
  return <StudentView studentId={id} />;
}

export default function StudentPage() {
  return (
    <Suspense>
      <StudentPageContent />
    </Suspense>
  );
}
