import { cleanup, render } from "@testing-library/react";
import { afterEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import ar from "@qct/core/messages/ar.json";
import { DEFAULT_TIME_ZONE, getIntlLocale } from "@qct/core/i18n/config";
import { getDirection } from "@qct/core/i18n/direction";
import { formats } from "@qct/core/i18n/formats";

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

function ArabicProviders({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider
      locale={getIntlLocale("ar")}
      messages={ar}
      formats={formats}
      timeZone={DEFAULT_TIME_ZONE}
    >
      <div dir={getDirection("ar")}>{children}</div>
    </NextIntlClientProvider>
  );
}

/**
 * Renders inside the Arabic i18n provider (RTL), as the app does. A wrapper,
 * so `rerender` keeps the provider too.
 */
export function renderArabic(ui: React.ReactElement) {
  return render(ui, { wrapper: ArabicProviders });
}
