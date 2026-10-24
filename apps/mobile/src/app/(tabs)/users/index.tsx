import { Screen } from "@/components/screen";
import { SyncIndicator } from "@/components/sync-indicator";

/** The center's users, for admins (2.11). */
export default function UsersScreen() {
  return (
    <Screen>
      <SyncIndicator />
    </Screen>
  );
}
