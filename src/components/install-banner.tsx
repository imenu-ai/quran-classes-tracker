"use client";

import { Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { currentInstallMode, type InstallMode } from "@/client/pwa/install";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "qct:install-banner-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Private mode: the banner simply shows again next time.
  }
}

/**
 * Encourages installing the app: on iPhone/iPad it shows the "Share → Add
 * to Home Screen" steps (Safari has no install prompt); elsewhere it offers
 * the browser's install prompt when available. Dismissible.
 */
export function InstallBanner() {
  const t = useTranslations("install");
  const [mode, setMode] = useState<InstallMode>("installed");
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setMode(currentInstallMode());
    setDismissed(readDismissed());
    const onPrompt = (event: Event) => {
      event.preventDefault(); // show our own button instead of the mini-infobar
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setMode("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const canPrompt = mode === "other" && promptEvent !== null;
  if (dismissed || mode === "installed" || (mode === "other" && !canPrompt)) return null;

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  }

  return (
    <aside className="flex items-start gap-3 rounded-xl border border-primary/30 bg-accent p-3 text-accent-foreground">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="font-semibold">{t("title")}</p>
        <p className="text-sm">{t("description")}</p>
        {mode === "ios" ? (
          <p className="text-sm font-medium">
            {t.rich("iosSteps", {
              share: () => (
                <Share aria-label={t("shareButton")} className="inline size-4 align-text-bottom" />
              ),
            })}
          </p>
        ) : (
          <Button size="sm" className="mt-1 h-10 self-start" onClick={() => void install()}>
            <Download aria-hidden />
            {t("button")}
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="-me-1 -mt-1 size-10 shrink-0"
        aria-label={t("dismiss")}
        onClick={dismiss}
      >
        <X aria-hidden />
      </Button>
    </aside>
  );
}
