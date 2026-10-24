"use client";

import { Copy, Info, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QrCode } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { parentLink } from "@qct/core/shared/parent";
import type { StudentRecord } from "@qct/core/shared/schemas/student";

/**
 * The student's parent link to hand out: the link (copy / share) and its QR
 * code. Without a parent ID the link says it isn't valid, so that's said here.
 */
export function ParentLinkDrawer({
  open,
  onOpenChange,
  student,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentRecord;
}) {
  const t = useTranslations("parentLink");
  const [canShare, setCanShare] = useState(false);
  const url = parentLink(typeof window === "undefined" ? "" : window.location.origin, student.id);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  async function share() {
    try {
      await navigator.share({ title: t("shareTitle", { name: student.fullName }), url });
    } catch {
      // Cancelled by the user: nothing to do.
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
          <DrawerHeader>
            <DrawerTitle>{t("title")}</DrawerTitle>
            <DrawerDescription dir="auto">{student.fullName}</DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 pb-2">
            {student.parentId === "" ? (
              <p className="flex items-start gap-2 self-stretch rounded-lg bg-warning/15 px-3 py-2 text-sm">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                {t("notSet")}
              </p>
            ) : (
              <p className="self-stretch text-sm text-muted-foreground">{t("hint")}</p>
            )}
            <QrCode value={url} label={t("qr")} className="size-52 rounded-lg border" />
            <p
              dir="auto"
              className="self-stretch rounded-lg bg-muted px-3 py-2 text-sm break-all select-all"
            >
              {url}
            </p>
          </div>
          <DrawerFooter className="flex-row border-t">
            <Button size="lg" className="h-12 flex-1" onClick={() => void copy()}>
              <Copy aria-hidden />
              {t("copy")}
            </Button>
            {canShare && (
              <Button
                size="lg"
                variant="outline"
                className="h-12 flex-1"
                onClick={() => void share()}
              >
                <Share2 aria-hidden />
                {t("share")}
              </Button>
            )}
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
