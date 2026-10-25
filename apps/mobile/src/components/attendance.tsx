import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTranslations } from "use-intl";
import { setExcuseNote } from "@qct/core/data/entities/attendance";
import {
  ATTENDANCE_STATUSES,
  EXCUSE_NOTE_MAX,
  type AttendanceStatus,
} from "@qct/core/shared/schemas/attendance";
import { useApp } from "@/data/app-data";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

/**
 * حاضر / غائب / غائب بعذر as three large buttons, each with its own colour
 * when selected (green, red, amber), like the web. Tapping the selected one
 * again clears it, unless `required` (a past day keeps a status).
 */
export function AttendanceToggle({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
}: Readonly<{
  label: string;
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus | null) => void;
  disabled?: boolean;
  required?: boolean;
}>) {
  const t = useTranslations("glossary");
  const { colors } = useTheme();
  const selected: Record<AttendanceStatus, { background: string; text: string }> = {
    present: { background: colors.success, text: colors.successForeground },
    absent: { background: colors.destructive, text: "#ffffff" },
    excused: { background: colors.warning, text: colors.warningForeground },
  };
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {ATTENDANCE_STATUSES.map((status) => {
        const on = value === status;
        return (
          <Pressable
            key={status}
            disabled={disabled}
            onPress={() => onChange(on ? (required ? status : null) : status)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled }}
            style={({ pressed }) => [
              styles.option,
              on
                ? {
                    backgroundColor: selected[status].background,
                    borderColor: selected[status].background,
                  }
                : { borderColor: colors.input, backgroundColor: colors.card },
              (pressed || disabled) && styles.dimmed,
            ]}
          >
            <Text
              weight="semibold"
              style={[styles.label, { color: on ? selected[status].text : colors.foreground }]}
            >
              {t(status)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The excuse note, saved about 0.6 s after typing stops and when the field loses focus. */
export function ExcuseNoteInput({
  lessonId,
  studentId,
  saved,
  disabled = false,
}: Readonly<{ lessonId: string; studentId: string; saved: string; disabled?: boolean }>) {
  const t = useTranslations("attendance");
  const { store } = useApp();
  const { colors, fonts } = useTheme();
  const [value, setValue] = useState(saved);
  const [lastSaved, setLastSaved] = useState(saved);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A note changed elsewhere (a sync) replaces what's shown.
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setValue(saved);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const save = (note: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (note !== saved) void setExcuseNote(store, lessonId, studentId, note);
  };

  return (
    <TextInput
      editable={!disabled}
      maxLength={EXCUSE_NOTE_MAX}
      placeholder={t("excuseNotePlaceholder")}
      accessibilityLabel={t("excuseNotePlaceholder")}
      placeholderTextColor={colors.mutedForeground}
      value={value}
      onChangeText={(note) => {
        setValue(note);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => save(note), 600);
      }}
      onBlur={() => save(value)}
      style={[
        styles.note,
        {
          fontFamily: fonts.regular,
          color: colors.foreground,
          backgroundColor: colors.card,
          borderColor: colors.input,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  option: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  // Full width of its button: see Button for why.
  label: { alignSelf: "stretch", textAlign: "center" },
  dimmed: { opacity: 0.6 },
  note: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
});
