import type ar from "@qct/core/messages/ar.json";
import type { formats } from "@qct/core/i18n/formats";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof ar;
    Formats: typeof formats;
  }
}
