"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PrintView } from "@/components/print/print-view";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * /print?class=…&month=YYYY-MM&students=id,id,… (query params, so one
 * cached shell serves every printout offline).
 */
function PrintContent() {
  const params = useSearchParams();
  const month = params.get("month");
  const studentIds = (params.get("students") ?? "").split(",").filter((id) => id !== "");
  return (
    <PrintView
      classId={params.get("class")}
      month={month !== null && MONTH.test(month) ? month : null}
      studentIds={studentIds}
    />
  );
}

export default function PrintPage() {
  return (
    <Suspense>
      <PrintContent />
    </Suspense>
  );
}
