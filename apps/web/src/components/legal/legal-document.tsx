import { createTranslator } from "next-intl";
import ar from "@qct/core/messages/ar.json";
import en from "@qct/core/messages/en.json";
import { getIntlLocale, LOCALES, type Locale } from "@qct/core/i18n/config";
import { getDirection } from "@qct/core/i18n/direction";
import { PUBLISHER, SUPPORT_EMAIL } from "@qct/core/shared/legal";

const MESSAGES = { ar, en } satisfies Record<Locale, unknown>;

export const PRIVACY_SECTIONS = [
  "publisher",
  "centers",
  "data",
  "use",
  "storage",
  "device",
  "parents",
  "children",
  "retention",
  "rights",
  "security",
  "changes",
] as const;

export const SUPPORT_SECTIONS = ["password", "code", "offline", "deletion"] as const;

type Document =
  | { namespace: "privacy"; sections: typeof PRIVACY_SECTIONS }
  | { namespace: "support"; sections: typeof SUPPORT_SECTIONS };

/** A translator for one locale, whatever the visitor's locale is. */
const translatorFor = (locale: Locale) =>
  createTranslator({ locale: getIntlLocale(locale), messages: MESSAGES[locale] });

/** The page's title in one locale, for its metadata. */
export const legalTitle = (namespace: Document["namespace"], locale: Locale) =>
  translatorFor(locale)(`${namespace}.title`);

/**
 * The privacy policy or the support page, in both languages one after the
 * other (PLAN.md 2.16): Arabic users read the first, App Review and English
 * speakers the second. The visitor's locale comes first. Each part takes
 * its own direction. Paragraphs are separated by blank lines in the messages.
 */
export function LegalDocument({
  document,
  locale,
}: Readonly<{ document: Document; locale: Locale }>) {
  const order = [locale, ...LOCALES.filter((other) => other !== locale)];
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-10">
      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {order.slice(1).map((other) => (
          <a key={other} href={`#${other}`} lang={other} className="text-primary underline">
            {translatorFor(other)(`${document.namespace}.title`)}
          </a>
        ))}
      </nav>
      {order.map((part) => (
        <Part key={part} document={document} locale={part} />
      ))}
    </main>
  );
}

function Part({ document, locale }: Readonly<{ document: Document; locale: Locale }>) {
  const t = translatorFor(locale);
  const values = { publisher: PUBLISHER, email: SUPPORT_EMAIL, forget: t("parent.forget") };
  const { namespace } = document;
  const paragraphs = (text: string) => text.split("\n\n");

  return (
    <article
      id={locale}
      lang={locale}
      dir={getDirection(locale)}
      className="flex scroll-mt-6 flex-col gap-6 border-t pt-10 first:border-t-0 first:pt-0"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{t(`${namespace}.title`)}</h1>
        {namespace === "privacy" && (
          <p className="text-sm text-muted-foreground">{t("privacy.updated")}</p>
        )}
        <p>{t(`${namespace}.intro`, values)}</p>
      </header>
      {document.sections.map((id) => (
        <section key={id} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">
            {t(`${namespace}.sections.${id}.title` as `privacy.sections.publisher.title`)}
          </h2>
          {paragraphs(
            t(`${namespace}.sections.${id}.body` as `privacy.sections.publisher.body`, values),
          ).map((paragraph) => (
            <p key={paragraph} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <p className="flex flex-wrap gap-x-2">
        <span className="font-semibold">{t("legal.contact")}:</span>
        <bdi>{PUBLISHER}</bdi>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">
          <bdi>{SUPPORT_EMAIL}</bdi>
        </a>
      </p>
    </article>
  );
}
