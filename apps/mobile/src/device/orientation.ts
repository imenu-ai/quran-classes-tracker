import { Dimensions } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";

/** A screen whose shorter side is at least this many points is a tablet (Android's sw600dp). */
const TABLET_MIN_SIDE = 600;

/** Whether this device is a tablet, from its screen (not the window, which split view shrinks). */
export function isTablet(): boolean {
  const { width, height } = Dimensions.get("screen");
  return Math.min(width, height) >= TABLET_MIN_SIDE;
}

/**
 * Phones stay in portrait; tablets turn freely (PLAN.md 2.13). The app
 * declares every orientation, which iPad split view and Slide Over need,
 * then locks phones at start.
 */
export function lockPhonesToPortrait(): void {
  if (isTablet()) return;
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(
    (error: unknown) => console.error("Couldn't lock the orientation", error),
  );
}
