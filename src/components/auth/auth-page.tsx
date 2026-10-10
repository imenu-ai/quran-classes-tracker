import { BookOpenText } from "lucide-react";
import { cn } from "@/lib/utils";

/** The centered, logo-topped layout of sign-in, registration and password pages. */
export function AuthPage({
  title,
  subtitle,
  wide = false,
  children,
}: Readonly<{ title: string; subtitle?: string; wide?: boolean; children: React.ReactNode }>) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh w-full flex-col justify-center gap-8 px-4 py-10",
        wide ? "max-w-md" : "max-w-sm",
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <BookOpenText className="size-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </main>
  );
}
