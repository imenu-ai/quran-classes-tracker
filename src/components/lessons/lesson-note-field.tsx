"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/client/app-context";
import { setLessonNote } from "@/client/data/lessons";
import { NOTE_MAX } from "@/shared/schemas/base";
import type { LessonRecord } from "@/shared/schemas/lesson";

/** Autosaving lesson note (~0.6 s after typing stops, and on blur). */
export function LessonNoteField({ lesson }: { lesson: LessonRecord }) {
  const t = useTranslations("lessons");
  const { store } = useApp();
  const [value, setValue] = useState(lesson.note);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(lesson.note), [lesson.note]);

  const save = (note: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (note.trim() !== lesson.note) void setLessonNote(store, lesson.id, note);
  };

  return (
    <Textarea
      dir="auto"
      rows={1}
      maxLength={NOTE_MAX}
      className="min-h-11 resize-none"
      placeholder={t("notePlaceholder")}
      aria-label={t("note")}
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
