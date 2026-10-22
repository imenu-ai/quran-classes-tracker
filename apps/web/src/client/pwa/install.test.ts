import { describe, expect, it } from "vitest";
import { detectInstallMode } from "./install";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("detectInstallMode", () => {
  it("is 'installed' when running standalone, on any device", () => {
    expect(detectInstallMode({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true })).toBe(
      "installed",
    );
  });

  it("shows the iOS steps on iPhone and on iPad (which reports itself as a Mac)", () => {
    expect(detectInstallMode({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false })).toBe(
      "ios",
    );
    expect(
      detectInstallMode({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5, standalone: false }),
    ).toBe("ios");
  });

  it("treats a real Mac and Android as 'other' (they use the install prompt)", () => {
    expect(
      detectInstallMode({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0, standalone: false }),
    ).toBe("other");
    expect(detectInstallMode({ userAgent: ANDROID, maxTouchPoints: 5, standalone: false })).toBe(
      "other",
    );
  });
});
