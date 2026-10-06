import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders an icon drawn for left-to-right reading (e.g. ChevronRight = "next",
 * ArrowLeft = "back") and mirrors it in RTL, so "next" always points forward.
 * Use it for every icon that implies direction.
 */
export function DirectionalIcon({
  icon: Icon,
  className,
  ...props
}: LucideProps & { icon: LucideIcon }) {
  return <Icon className={cn("rtl:-scale-x-100", className)} aria-hidden {...props} />;
}
