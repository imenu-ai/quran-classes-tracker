import { useState } from "react";
import { router, Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { EmptyState } from "@/components/empty-state";
import { ListRow } from "@/components/list-row";
import { Screen } from "@/components/screen";
import { SyncIndicator } from "@/components/sync-indicator";
import { useStudentSearch } from "@/data/queries";

/**
 * Student search in the native header search bar. Matching ignores
 * tashkeel, hamza forms, ة/ه and ى/ي (the shared `searchStudents`).
 */
export default function SearchScreen() {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const results = useStudentSearch(query);
  const searching = query.trim() !== "";

  return (
    <>
      <Stack.SearchBar
        placeholder={t("search.placeholder")}
        onChangeText={(event) => setQuery(event.nativeEvent.text)}
        hideWhenScrolling={false}
      />
      <Screen>
        <SyncIndicator />
        {!searching ? (
          <EmptyState title={t("search.title")} description={t("search.hint")} />
        ) : results && results.length === 0 ? (
          <EmptyState title={t("search.noResults")} />
        ) : (
          results?.map(({ student, className, archived }) => (
            <ListRow
              key={student.id}
              title={student.fullName}
              subtitle={[className, archived ? t("students.archivedBadge") : null]
                .filter(Boolean)
                .join(" · ")}
              onPress={() =>
                router.push({ pathname: "/search/student/[id]", params: { id: student.id } })
              }
            />
          ))
        )}
      </Screen>
    </>
  );
}
