import { cleanup, render } from "@testing-library/react";
import { afterEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import ar from "../../messages/ar.json";
import { DEFAULT_TIME_ZONE, getIntlLocale } from "@/i18n/config";
import { getDirection } from "@/i18n/direction";
import { formats } from "@/i18n/formats";

/**
 * Browser APIs that jsdom lacks but Radix, vaul and cmdk use. Also unmounts
 * rendered components after each test (Vitest globals are off).
 */
export function installDomPolyfills() {
  afterEach(cleanup);
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
}

/** Renders inside the Arabic i18n provider (RTL), as the app does. */
export function renderArabic(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider
      locale={getIntlLocale("ar")}
      messages={ar}
      formats={formats}
      timeZone={DEFAULT_TIME_ZONE}
    >
      <div dir={getDirection("ar")}>{ui}</div>
    </NextIntlClientProvider>,
  );
}
