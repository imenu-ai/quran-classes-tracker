import { Children, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

/**
 * Columns from the window's width, at the web's breakpoints (`md` 768,
 * `xl` 1280): one on a phone, more on a tablet. The window, not the screen,
 * so an iPad app in split view gets the columns its own width allows.
 */
export function columnsFor(width: number, maxColumns: number): number {
  const columns = width >= 1280 ? 3 : width >= 768 ? 2 : 1;
  return Math.min(columns, maxColumns);
}

/**
 * Cards in rows of equal columns (the web's `md:grid-cols-2 xl:grid-cols-3`).
 * Rows follow the writing direction, so the first card is on the right in
 * Arabic. A short last row keeps its cards at the column width.
 */
export function Grid({
  maxColumns,
  children,
}: Readonly<{ maxColumns: number; children: ReactNode }>) {
  const { width } = useWindowDimensions();
  const columns = columnsFor(width, maxColumns);
  const items = Children.toArray(children);
  if (columns === 1) return <>{items}</>;
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((item, c) => (
            <View key={c} style={styles.cell}>
              {item}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, c) => (
            <View key={`empty-${c}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 12 },
  row: { flexDirection: "row", gap: 12, alignItems: "stretch" },
  cell: { flex: 1 },
});
