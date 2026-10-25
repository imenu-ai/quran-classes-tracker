import { useEffect, useState } from "react";
import { I18nManager, Platform, type ImageSourcePropType } from "react-native";
import {
  SymbolView,
  unstable_getMaterialSymbolSourceAsync,
  type AndroidSymbol,
} from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";
import { useTheme } from "@/theme/theme";

/**
 * The "opens a page" chevron at the end of a row. Picked by direction here,
 * not left to the platform: direction is fixed at start (PLAN.md §0 #53),
 * and mirrored native views have flipped twice before (the iOS large title).
 */
export function Chevron({ color }: Readonly<{ color?: string }>) {
  const { colors } = useTheme();
  const rtl = I18nManager.isRTL;
  return (
    <SymbolView
      name={{
        ios: rtl ? "chevron.left" : "chevron.right",
        android: rtl ? "chevron_left" : "chevron_right",
      }}
      size={18}
      tintColor={color ?? colors.mutedForeground}
    />
  );
}

/**
 * An icon for a native header button or menu (`Stack.Toolbar`): an SF
 * Symbol on iOS; on Android, which takes only images there, the Material
 * symbol drawn to an image. Until that's ready (or if it fails) the item
 * shows its label instead.
 */
export function useToolbarIcon(
  sf: SFSymbol,
  md: AndroidSymbol,
): SFSymbol | ImageSourcePropType | undefined {
  const { colors } = useTheme();
  const [image, setImage] = useState<ImageSourcePropType | null>(null);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    let cancelled = false;
    unstable_getMaterialSymbolSourceAsync(md, 24, colors.primary)
      .then((source) => {
        if (!cancelled) setImage(source);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [md, colors.primary]);
  if (Platform.OS === "ios") return sf;
  return image ?? undefined;
}
