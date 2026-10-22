"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ClassView } from "@/components/classes/class-view";

/** /class?id=… (query param, so one cached shell serves every class offline). */
function ClassPageContent() {
  const id = useSearchParams().get("id");
  return <ClassView classId={id} />;
}

export default function ClassPage() {
  return (
    <Suspense>
      <ClassPageContent />
    </Suspense>
  );
}
