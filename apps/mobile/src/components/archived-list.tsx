import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useTheme } from "@/theme/theme";
import { Text } from "./text";

export interface ArchivedItem {
  id: string;
  name: string;
}

/**
 * Archived classes or students, collapsed under "(count)" like the web's.
 * Each opens its page; `onRestore` (only for users who may) adds a restore
 * button.
 */
export function ArchivedList({
  title,
  items,
  restoreLabel,
  onOpen,
  onRestore,
}: Readonly<{
  title: string;
  items: readonly ArchivedItem[];
  restoreLabel: string;
  onOpen: (id: string) => void;
  onRestore?: (id: string) => void;
}>) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.header}
      >
        <Text tone="muted" weight="medium" style={styles.headerText}>
          {title} ({items.length})
        </Text>
        <SymbolView
          name={{
            ios: open ? "chevron.up" : "chevron.down",
            android: open ? "expand_less" : "expand_more",
          }}
          size={18}
          tintColor={colors.mutedForeground}
        />
      </Pressable>
      {open ? (
        <View style={[styles.list, { borderColor: colors.border }]}>
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[styles.item, index > 0 && { borderTopWidth: 1, borderColor: colors.border }]}
            >
              <Pressable
                onPress={() => onOpen(item.id)}
                accessibilityRole="button"
                style={styles.name}
              >
                <Text tone="muted" numberOfLines={2}>
                  {item.name}
                </Text>
              </Pressable>
              {onRestore ? (
                <Pressable
                  onPress={() => onRestore(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${restoreLabel}: ${item.name}`}
                  style={({ pressed }) => [
                    styles.restore,
                    { borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text weight="medium" size={14}>
                    {restoreLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  header: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  headerText: { flex: 1 },
  list: { borderWidth: 1, borderRadius: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  name: { flex: 1, minHeight: 48, justifyContent: "center" },
  restore: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
});
