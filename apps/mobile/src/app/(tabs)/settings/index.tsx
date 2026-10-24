import { Screen } from "@/components/screen";
import { IntlCheck } from "@/components/intl-check";

/** Profile, sync and center settings (2.11). */
export default function SettingsScreen() {
  return <Screen>{__DEV__ ? <IntlCheck /> : null}</Screen>;
}
