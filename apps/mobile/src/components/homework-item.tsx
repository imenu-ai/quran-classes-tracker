import { Pressable, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useTranslations } from "use-intl";
import type { RateField } from "@qct/core/data/entities/homework";
import type { HomeworkRecord } from "@qct/core/shared/schemas/homework";
import { useTheme } from "@/theme/theme";
import { Button } from "./button";
import { Badge } from "./loading";
import { ScorePicker } from "./score-picker";
import { Text } from "./text";

/**
 * One due homework item today, as a collapsible section (the web's
 * HomeworkItem). Closed, one line: the portion, then its marks ("9 · 10") or
 * "مؤجل". Open: the mark wheels, postpone, and the edit and undo buttons.
 * An exam has its own colour and badge, one mark, and is never postponed.
 */
export function HomeworkItem({
  item,
  label,
  open,
  onToggle,
  exam,
  evaluated,
  postponed,
  readOnly,
  onEdit,
  onRate,
  onUndo,
  onPostpone,
  onUndoPostpone,
}: Readonly<{
  item: HomeworkRecord;
  label: string;
  open: boolean;
  onToggle: () => void;
  exam: boolean;
  evaluated: boolean;
  postponed: boolean;
  readOnly: boolean;
  onEdit: () => void;
  onRate: (field: RateField, score: number | null) => Promise<unknown>;
  onUndo: () => void;
  onPostpone: () => void;
  onUndoPostpone: () => void;
}>) {
  const t = useTranslations();
  const { colors } = useTheme();
  const mark = (value: number | null) => (value === null ? t("common.noValue") : String(value));

  return (
    <View
      style={[
        styles.item,
        exam
          ? { borderColor: colors.exam, backgroundColor: `${colors.exam}12` }
          : { borderColor: colors.border, backgroundColor: colors.background },
      ]}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.header}
      >
        <Text weight="semibold" size={17} style={styles.label} numberOfLines={2}>
          {label}
        </Text>
        {exam ? (
          <Badge label={t("exam.badge")} background={colors.exam} color={colors.examForeground} />
        ) : null}
        {exam ? (
          item.memorizationRate !== null ? (
            <Text weight="bold" size={18} style={{ color: colors.exam }}>
              {item.memorizationRate}
            </Text>
          ) : null
        ) : postponed ? (
          <Badge
            label={t("today.postponed")}
            background={colors.warning}
            color={colors.warningForeground}
          />
        ) : evaluated ? (
          <Text weight="bold" size={18} tone="primary">
            {t("today.marks", {
              memorization: mark(item.memorizationRate),
              behavior: mark(item.behaviorRate),
            })}
          </Text>
        ) : null}
        <SymbolView
          name={{
            ios: open ? "chevron.up" : "chevron.down",
            android: open ? "expand_less" : "expand_more",
          }}
          size={20}
          tintColor={colors.mutedForeground}
        />
      </Pressable>

      {open ? (
        <View style={[styles.panel, { borderColor: colors.border }]}>
          {!readOnly ? (
            // Equal widths, not sized to their labels: a label sized to its own
            // measurement lost its last word on Android ("تعديل المقطع" showed
            // as "تعديل").
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button variant="plain" label={t("evaluation.editRange")} onPress={onEdit} />
              </View>
              {evaluated ? (
                <View style={styles.action}>
                  <Button variant="plain" label={t("evaluation.undo")} onPress={onUndo} />
                </View>
              ) : null}
            </View>
          ) : null}
          {postponed ? (
            <View style={[styles.note, { backgroundColor: colors.muted }]}>
              <Text tone="muted" size={14}>
                {t("today.postponedHint")}
              </Text>
              {!readOnly ? (
                <Button variant="plain" label={t("today.undoPostpone")} onPress={onUndoPostpone} />
              ) : null}
            </View>
          ) : (
            <>
              <View style={styles.pickers}>
                <ScorePicker
                  label={exam ? t("exam.mark") : t("glossary.memorizationRate")}
                  value={item.memorizationRate}
                  onChange={(score) => onRate("memorizationRate", score)}
                  disabled={readOnly}
                />
                {exam ? (
                  <View style={styles.spacer} />
                ) : (
                  <ScorePicker
                    label={t("glossary.behaviorRate")}
                    value={item.behaviorRate}
                    onChange={(score) => onRate("behaviorRate", score)}
                    disabled={readOnly}
                  />
                )}
              </View>
              {!exam && !evaluated && !readOnly ? (
                <Button variant="plain" label={t("today.postpone")} onPress={onPostpone} />
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A compact text button (a sheet's "close", "edit portion"). At least 96 pt
 * wide with the label centred across it, so a short label has room to spare
 * (see the item's actions for why).
 */
export function SmallButton({
  label,
  onPress,
  color,
}: Readonly<{ label: string; onPress: () => void; color?: string }>) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.small, pressed && styles.pressed]}
    >
      <Text
        weight="medium"
        size={15}
        style={[styles.smallLabel, { color: color ?? colors.primary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: 12 },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  label: { flex: 1 },
  panel: { borderTopWidth: 1, padding: 14, gap: 12 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
  pickers: { flexDirection: "row", gap: 12 },
  spacer: { flex: 1 },
  note: { borderRadius: 10, padding: 12, gap: 10 },
  small: { minHeight: 40, minWidth: 96, paddingHorizontal: 10, justifyContent: "center" },
  smallLabel: { alignSelf: "stretch", textAlign: "center" },
  pressed: { opacity: 0.5 },
});
