import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { isLocalDate } from "@qct/core/domain/dates/local-date";
import { Loading } from "@/components/loading";
import { Screen } from "@/components/screen";
import { TodayCard } from "@/components/today-card";
import { useStudent } from "@/data/queries";
import { useLessonDate } from "@/i18n/portion";

/**
 * A student's session on a past day (`?studentId=&date=`), opened from
 * "إضافة جلسة": the today card for that day, recording against that day's
 * lesson (created on the first thing recorded).
 */
export default function StudentDayScreen() {
  const t = useTranslations("day");
  const { studentId, date } = useLocalSearchParams<{ studentId: string; date: string }>();
  const student = useStudent(studentId);
  const lessonDate = useLessonDate();
  const day = isLocalDate(date) ? date : undefined;

  return (
    <Screen>
      <Stack.Screen options={{ title: day ? lessonDate(day) : t("title") }} />
      {student && day ? <TodayCard student={student} date={day} /> : <Loading />}
    </Screen>
  );
}
