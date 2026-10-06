"use client";

import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import type { Direction } from "@/i18n/direction";

/**
 * App-wide client providers. `direction` comes from getDirection(locale) in the
 * root layout so Radix primitives (menus, sheets, …) and toasts follow it.
 */
export function Providers({
  direction,
  children,
}: Readonly<{ direction: Direction; children: React.ReactNode }>) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <DirectionProvider dir={direction}>
        {children}
        <Toaster dir={direction} position="top-center" />
      </DirectionProvider>
    </ThemeProvider>
  );
}
