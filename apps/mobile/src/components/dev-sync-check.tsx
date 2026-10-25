import { StyleSheet, View } from "react-native";
import { createClass, loadActiveClasses } from "@qct/core/data/entities/classes";
import { DEFAULT_LOCALE } from "@qct/core/i18n/config";
import { useApp } from "@/data/app-data";
import { useLocalQuery } from "@/data/use-local-query";
import { useTheme } from "@/theme/theme";
import { Button } from "./button";
import { Text } from "./text";

/**
 * Development builds only, until the class screens arrive (2.8): the local
 * classes and a button that adds one, to check that writes made offline
 * reach the server and show up on the web, and that pulled classes land
 * here. Not translated: users never see it.
 */
export function DevSyncCheck() {
  const { store } = useApp();
  const { colors } = useTheme();
  const classes = useLocalQuery((db) => loadActiveClasses(db, DEFAULT_LOCALE), [], ["classes"]);
  return (
    <View style={[styles.box, { borderColor: colors.border }]} testID="dev-sync-check">
      <Text weight="semibold">Local classes: {classes?.length ?? "…"}</Text>
      {classes?.map((record) => (
        <Text key={record.id} tone="muted">
          {record.name}
        </Text>
      ))}
      <Button
        variant="plain"
        label="Add a test class"
        onPress={() => {
          const stamp = new Date().toISOString().slice(11, 19);
          void createClass(store, `حلقة تجريبية ${stamp}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, padding: 12, gap: 4 },
});
