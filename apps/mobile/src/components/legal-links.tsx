import { StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useTranslations } from "use-intl";
import { PRIVACY_PATH, SUPPORT_PATH } from "@qct/core/shared/legal";
import { API_URL } from "@/config";
import { TextLink } from "./text-link";

/**
 * The privacy policy and support pages on the web (PLAN.md 2.16), under
 * sign-in, registration and Settings, like the web's LegalLinks.
 */
export function LegalLinks() {
  const t = useTranslations("legal");
  const open = (path: string) => void WebBrowser.openBrowserAsync(`${API_URL}${path}`);
  return (
    <View style={styles.links}>
      <TextLink tone="muted" label={t("privacy")} onPress={() => open(PRIVACY_PATH)} />
      <TextLink tone="muted" label={t("support")} onPress={() => open(SUPPORT_PATH)} />
    </View>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 24 },
});
