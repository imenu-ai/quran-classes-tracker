"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { bootstrapSession } from "@/client/session/session";
import { PasswordForm } from "./password-form";

/** The password form of /change-password; enters the app once it's changed. */
export function ForcedPasswordChange() {
  const t = useTranslations("auth.changePassword");
  const router = useRouter();
  return (
    <PasswordForm
      wide
      submitLabel={t("submit")}
      onChanged={async () => {
        // The server cleared mustChangePassword; save that on the device.
        await bootstrapSession();
        router.replace("/");
      }}
    />
  );
}
