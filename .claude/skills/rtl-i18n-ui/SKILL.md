---
name: rtl-i18n-ui
description: How to build UI in quran-classes-tracker so it stays Arabic-first, RTL and LTR at once, translated, mobile-first (iPhone) and offline-safe — next-intl messages (ar/en parity, glossary, error codes), logical Tailwind classes, DirectionalIcon, Intl date/number formats, shadcn/ui direction fixes, 360 px layouts. Use it whenever you create or change a component, page, dialog, sheet, form, toast, chart, label or any user-facing text, or fix a layout/overflow/direction bug, even for a "small" button or wording change.
---

# UI in this app: Arabic-first, RTL and LTR, phone-first

Users see Arabic, written right to left. English (`messages/en.json`) is built, hidden and tested, so every screen must work in both directions without code changes. The main user is a teacher on an iPhone in the middle of a lesson: large tap targets, nothing that scrolls sideways, and it must keep working offline. The binding rules are in `BRIEF.md` §2 (i18n and direction) and §3 (the Arabic glossary).

## Text

- **Every user-facing string comes from `messages/ar.json`** and its English twin `messages/en.json`, with the same keys. That covers labels, buttons, empty states, toasts, aria-labels, `title`s and chart labels.
  - The test `src/i18n/messages.test.ts` fails if the key sets differ or a message is empty.
  - Add the key to both files in the same change.
- **Use the glossary for domain terms.** `glossary.*` holds the brief's fixed vocabulary, for example `glossary.class` = الحلقة, `glossary.lesson` = الدرس, `glossary.memorizationRate` = تقييم الحفظ. Reuse those keys rather than writing a synonym, so wording stays consistent across screens.
- **Messages are ICU.** Use `{name}` placeholders and `plural`/`select`. Arabic plurals have six forms (`zero one two few many other`); write all the ones the sentence needs.
- **Rich text** (bold parts, inline icons) uses `t.rich("key", { b: (chunks) => <strong>{chunks}</strong> })` with tags in the message. Don't split a sentence across several keys, because word order differs between Arabic and English.
- **Errors are codes until the last moment.** Domain and schema code return codes (`src/shared/schemas/errors.ts`, `src/domain/quran/validation.ts`). Components turn them into text with `useErrorMessage()` (`src/i18n/use-error-message.ts`). Never put translated text in domain, server or schema code.
- **Wording:** neutral where possible, masculine when Arabic forces a choice (PLAN.md §0 #11). The tone is short and plain, as for a busy teacher.
- **shadcn/ui components** were generated with hardcoded English, such as "Close", "Loading" and the CommandDialog defaults. When you add or regenerate one, replace every English string with a translation or a required prop.

## Direction

- **Use logical Tailwind classes only:** `ms-/me-`, `ps-/pe-`, `start-/end-`, `text-start/text-end`, `border-s/border-e`, `rounded-s/rounded-e`, `inset-x-*`. `pnpm lint` fails on physical ones (`ml-`, `pr-`, `left-`, `text-right`, …). Vertical classes (`mt-`, `pb-`, `top-`) are fine.
- **Never write `dir="rtl"` or `dir="ltr"`.** Lint blocks it. `<html dir>` comes from `getDirection(locale)` (`src/i18n/direction.ts`). Put `dir="auto"` on user-entered text (student names, notes, search input) so mixed Arabic and English displays correctly.
- **Icons that point somewhere** (back, next, chevrons, arrows) go through `<DirectionalIcon icon={ChevronLeft} />` (`src/components/directional-icon.tsx`). It mirrors them in RTL. Pick the icon as if for LTR: back = `ChevronLeft`/`ArrowLeft`, next = `ChevronRight`.
- **Sheets, drawers and popovers** use logical sides (`side="start"`/`"end"`). The shadcn `Sheet` here was changed from left/right to start/end; keep it that way.
- **Charts** (Recharts via `src/components/ui/chart.tsx`): in RTL the X axis is reversed and the Y axis sits on the right (see `monthly-chart`). Give the SVG `aria-hidden` and add an equivalent table for screen readers.
  - Put `sr-only` on a wrapping `div`, never on the `<table>` itself: a table ignores the 1 px width and widened the page.

## Numbers and dates

- **Format through next-intl** (`useFormatter()`, `format.dateTime`, `format.number`, `format.relativeTime`) with the named formats in `src/i18n/formats.ts` (`lessonDate`, `weekday`, `month`, `average`, …). Add a named format rather than inline options. Never hardcode day or month names.
- **The Arabic locale tag is `ar-u-ca-gregory-nu-latn`** (`getIntlLocale` in `src/i18n/config.ts`): Western digits and the Gregorian calendar, per the brief.
- **Lesson dates are calendar dates** (`LocalDate`, `YYYY-MM-DD`), not instants. Format them via `localDateToUtcDate` with formats that set `timeZone: "UTC"` (see `use-lesson-date.ts`), or the day shifts with the device time zone. "Today" comes from the tenant's time zone: `todayInTimeZone(session.timezone)`.
- **Numeric inputs accept Arabic-Indic digits.** Parse with `parseIntegerInput` / `toWesternDigits` (`src/domain/text/digits.ts`). Use `inputMode="numeric"` for the phone keypad.
- **Sort names** with `Intl.Collator(locale)`.

## Layout for an iPhone mid-lesson

- **Design for 360 px first,** then let it grow. Nothing may scroll sideways: `<main>` has `overflow-x-clip` as a guard, but don't rely on it.
- **Tap targets are at least 44 px** (`h-11`/`size-11`). Frequent actions such as score buttons and attendance toggles are larger.
- **When a component sits in variable-width containers,** use container queries (`@container` on the card, `@lg:grid-cols-2` inside) rather than viewport breakpoints. Score grids once shrank to 32 px at 1024 px with viewport breakpoints.
- **The shell pads for the notch and home indicator** with `env(safe-area-inset-*)` (`app-shell.tsx`). New fixed or sticky bars must do the same.
- **Long Arabic names truncate.** Give the important text its own line rather than letting badges squeeze it to a few letters.
- **Feedback after a tap must be instant.** Writes go to IndexedDB and are usually fast, but WebKit took about 250 ms. For high-frequency controls, show the new state optimistically, as `ScorePicker` does. See the `offline-sync-data` skill for the write path.
- **Pages must not depend on the server for content.** Routes are `?id=` query pages served from the service-worker cache, and data comes from Dexie. Never fetch data in a server component.

## Checking your change

1. `pnpm lint && pnpm typecheck && pnpm test`. These catch physical classes, literal `dir`, and missing or empty message keys.
2. Component tests: `// @vitest-environment jsdom`, then `renderArabic(<X />)` from `src/test/dom.tsx` (real Arabic messages, RTL). Query by role and accessible name in Arabic, taken from the message files.
3. Look at it in a browser at 360 px in Arabic, and quickly in English as well:
   - A user whose `locale` is `en` gets English once `ENABLED_LOCALES=ar,en` is set.
   - `pnpm test:e2e` runs an LTR smoke test that checks `dir`, `lang` and no horizontal overflow on every main screen.
   - See the `plan-step-workflow` skill for ports and accounts.
