import { z } from "zod";
import { LOCALES } from "@/i18n/config";
import { PERMISSIONS, ROLES } from "./access";

/** GET /api/me: who is signed in, what he may do, and his center's settings. */
export const meResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    /** The part people type ("ahmad"), not the stored "<code>:ahmad". */
    username: z.string(),
    phone: z.string(),
    /** Admins only (used for password reset); null for teachers. */
    email: z.string().nullable(),
    locale: z.enum(LOCALES),
    role: z.enum(ROLES),
    permissions: z.array(z.enum(PERMISSIONS)),
    classIds: z.array(z.string()),
    mustChangePassword: z.boolean(),
    accessVersion: z.number().int(),
  }),
  tenant: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    timezone: z.string(),
  }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
