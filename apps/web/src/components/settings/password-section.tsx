"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PasswordForm } from "@/components/auth/password-form";

/** Change password: the current password is required (and rate limited on the server). */
export function PasswordSection() {
  const t = useTranslations("settings");
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="font-semibold">{t("passwordTitle")}</h2>
      <PasswordForm
        submitLabel={t("changePassword")}
        onChanged={() => {
          toast.success(t("passwordChanged"));
        }}
      />
    </section>
  );
}
