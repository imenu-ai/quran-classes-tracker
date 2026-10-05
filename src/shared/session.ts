import { z } from "zod";
import { LOCALES } from "@/i18n/config";

/** GET /api/me: who is signed in, and their tenant's settings. */
export const meResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
    locale: z.enum(LOCALES),
  }),
  tenant: z.object({
    id: z.string(),
    name: z.string(),
    timezone: z.string(),
  }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
