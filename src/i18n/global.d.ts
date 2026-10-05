import type ar from "../../messages/ar.json";
import type { formats } from "./formats";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof ar;
    Formats: typeof formats;
  }
}
