"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const OPTIONS = [
  { value: "system", icon: Monitor, label: "themeSystem" },
  { value: "light", icon: Sun, label: "themeLight" },
  { value: "dark", icon: Moon, label: "themeDark" },
] as const;

/** Light / dark / follow the device. */
export function ThemeSection() {
  const t = useTranslations("settings");
  const { theme, setTheme } = useTheme();
  const labelId = useId();
  // The theme is only known on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 id={labelId} className="font-semibold">
        {t("themeTitle")}
      </h2>
      <ToggleGroup
        type="single"
        variant="outline"
        className="w-full"
        aria-labelledby={labelId}
        value={mounted ? (theme ?? "system") : ""}
        onValueChange={(value) => value && setTheme(value)}
      >
        {OPTIONS.map(({ value, icon: Icon, label }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            className="h-11 flex-1 data-[state=on]:border-primary data-[state=on]:bg-accent"
          >
            <Icon aria-hidden />
            {t(label)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  );
}
