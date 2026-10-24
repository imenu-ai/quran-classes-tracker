import { StyleSheet, View } from "react-native";
import { Text } from "./text";

/** A calm empty state: a title and a line of guidance. */
export function EmptyState({
  title,
  description,
}: Readonly<{ title: string; description?: string }>) {
  return (
    <View style={styles.box}>
      <Text weight="semibold" size={18} style={styles.centered}>
        {title}
      </Text>
      {description ? (
        <Text tone="muted" style={styles.centered}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingVertical: 48, gap: 8, alignItems: "center" },
  centered: { textAlign: "center" },
});
