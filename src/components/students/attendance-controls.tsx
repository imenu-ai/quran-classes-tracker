"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useApp } from "@/client/app-context";
import { setExcuseNote } from "@/client/data/attendance";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_STATUSES,
  EXCUSE_NOTE_MAX,
  type AttendanceStatus,
} from "@/shared/schemas/attendance";

/** Each status has its own color when selected: green, red, amber. */
const SELECTED: Record<AttendanceStatus, string> = {
  present:
    "data-[state=on]:border-success data-[state=on]:bg-success data-[state=on]:text-success-foreground",
  absent:
    "data-[state=on]:border-destructive data-[state=on]:bg-destructive data-[state=on]:text-white",
  excused:
    "data-[state=on]:border-warning data-[state=on]:bg-warning data-[state=on]:text-warning-foreground",
};

/**
 * حاضر / غائب / غائب بعذر as three large buttons. Tapping the selected one
 * again clears it (not marked); `onChange` gets null then.
 */
export function AttendanceToggle({
  value,
  onChange,
  label,
}: {
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus | null) => void;
  label: string;
}) {
  const t = useTranslations("glossary");
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      className="w-full"
      aria-label={label}
      value={value ?? ""}
      onValueChange={(next) => onChange(next ? (next as AttendanceStatus) : null)}
    >
      {ATTENDANCE_STATUSES.map((status) => (
        <ToggleGroupItem
          key={status}
          value={status}
          className={cn("h-11 flex-1", SELECTED[status])}
        >
          {t(status)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Autosaving excuse note (written ~0.6 s after typing stops, and on blur). */
export function ExcuseNoteInput({
  lessonId,
  studentId,
  saved,
}: {
  lessonId: string;
  studentId: string;
  saved: string;
}) {
  const t = useTranslations("attendance");
  const { store } = useApp();
  const [value, setValue] = useState(saved);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(saved), [saved]);

  const save = (note: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (note !== saved) void setExcuseNote(store, lessonId, studentId, note);
  };

  return (
    <Input
      dir="auto"
      className="h-11"
      maxLength={EXCUSE_NOTE_MAX}
      placeholder={t("excuseNotePlaceholder")}
      aria-label={t("excuseNotePlaceholder")}
      value={value}
      onChange={(event) => {
        const note = event.target.value;
        setValue(note);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => save(note), 600);
      }}
      onBlur={() => save(value)}
    />
  );
}
