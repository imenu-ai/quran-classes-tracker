import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { searchSurahs } from "@qct/core/domain/quran/search";
import { useAppLocale } from "@/i18n/locale";
import { useSurahLabel } from "@/i18n/portion";
import { useTheme } from "@/theme/theme";
import { SmallButton } from "./homework-item";
import { Text } from "./text";

/**
 * The sura field: a button showing the chosen sura that opens a searchable
 * sheet (a page sheet on iOS). Search by name, forgiving of hamza and
 * tashkeel, or by number, with the shared `searchSurahs`.
 */
export function SurahPicker({
  label,
  value,
  onChange,
  error,
}: Readonly<{
  label: string;
  value: number | null;
  onChange: (surah: number) => void;
  error?: string | null;
}>) {
  const t = useTranslations("homework");
  const tCommon = useTranslations("common");
  const locale = useAppLocale();
  const surahLabel = useSurahLabel();
  const { colors, fonts } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchSurahs(query, locale), [query, locale]);

  return (
    <View style={styles.field}>
      <Text weight="medium">{label}</Text>
      <Pressable
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? surahLabel(value) : t("pickSurah")}`}
        style={[
          styles.button,
          { borderColor: error ? colors.destructive : colors.input, backgroundColor: colors.card },
        ]}
      >
        <Text tone={value ? "default" : "muted"} numberOfLines={1}>
          {value ? surahLabel(value) : t("pickSurah")}
        </Text>
      </Pressable>
      {error ? (
        <Text size={14} style={{ color: colors.destructive }}>
          {error}
        </Text>
      ) : null}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, paddingBottom: bottom },
            // Android shows the modal full screen, under the status bar.
            { paddingTop: Math.max(top, 16) },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text weight="bold" size={20} style={styles.sheetTitle} accessibilityRole="header">
              {t("pickSurah")}
            </Text>
            <SmallButton label={tCommon("close")} onPress={() => setOpen(false)} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("searchSurah")}
            accessibilityLabel={t("searchSurah")}
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            autoCorrect={false}
            style={[
              styles.search,
              {
                fontFamily: fonts.regular,
                color: colors.foreground,
                backgroundColor: colors.card,
                borderColor: colors.input,
              },
            ]}
          />
          <FlatList
            data={results}
            keyExtractor={(surah) => String(surah.number)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text tone="muted" style={styles.empty}>
                {t("noSurah")}
              </Text>
            }
            renderItem={({ item: surah }) => {
              const selected = surah.number === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(surah.number);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: colors.border },
                    (pressed || selected) && { backgroundColor: colors.accent },
                  ]}
                >
                  <Text weight={selected ? "semibold" : "regular"}>{surahLabel(surah.number)}</Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  sheet: { flex: 1, paddingHorizontal: 16, gap: 12 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetTitle: { flex: 1 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  row: { minHeight: 48, justifyContent: "center", paddingHorizontal: 8, borderBottomWidth: 1 },
  empty: { paddingVertical: 24, alignSelf: "stretch", textAlign: "center" },
});
