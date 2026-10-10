import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { createTranslator } from "next-intl";
import { v7 as uuidv7 } from "uuid";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { DEFAULT_LOCALE, getIntlLocale, isLocale, type Locale } from "@/i18n/config";
import { getDirection } from "@/i18n/direction";

/** Teachers have no email; Better Auth still needs a unique one. */
export const placeholderEmail = () => `${uuidv7()}@users.invalid`;
export const isPlaceholderEmail = (email: string) => email.endsWith("@users.invalid");

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

type Transport = (email: OutgoingEmail) => Promise<void>;

let sesClient: SESv2Client | undefined;

/**
 * Sends through AWS SES when EMAIL_FROM is set (production: the Amplify SSR
 * compute role may call ses:SendEmail). Without it (development), the email
 * is logged so the link can be opened from the terminal.
 */
const defaultTransport: Transport = async (email) => {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    console.info(`[email] to ${email.to}: ${email.subject}\n${email.text}`);
    return;
  }
  sesClient ??= new SESv2Client({
    region: process.env.SES_REGION ?? process.env.AWS_REGION ?? "eu-central-1",
  });
  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [email.to] },
      Content: {
        Simple: {
          Subject: { Data: email.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: email.html, Charset: "UTF-8" },
            Text: { Data: email.text, Charset: "UTF-8" },
          },
        },
      },
    }),
  );
};

let transport: Transport = defaultTransport;

/** Test-only: capture emails instead of sending them (null restores the default). */
export function setEmailTransportForTests(next: Transport | null) {
  transport = next ?? defaultTransport;
}

const MESSAGES = { ar, en } as const;

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** The password reset email, in the user's language and direction. */
export function passwordResetEmail(input: {
  to: string;
  name: string;
  url: string;
  locale: string | undefined;
}): OutgoingEmail {
  const locale: Locale = isLocale(input.locale) ? input.locale : DEFAULT_LOCALE;
  const t = createTranslator({
    locale: getIntlLocale(locale),
    messages: MESSAGES[locale],
    namespace: "email.resetPassword",
  });
  const dir = getDirection(locale);
  const lines = {
    greeting: t("greeting", { name: input.name }),
    body: t("body"),
    button: t("button"),
    expiry: t("expiry"),
    ignore: t("ignore"),
  };
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="font-family: Tahoma, Arial, sans-serif; line-height: 1.7; color: #10201b;">
    <p>${escapeHtml(lines.greeting)}</p>
    <p>${escapeHtml(lines.body)}</p>
    <p>
      <a href="${escapeHtml(input.url)}"
         style="display: inline-block; background: #057558; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none;">
        ${escapeHtml(lines.button)}
      </a>
    </p>
    <p style="color: #55665f;">${escapeHtml(lines.expiry)}</p>
    <p style="color: #55665f;">${escapeHtml(lines.ignore)}</p>
  </body>
</html>`;
  const text = [lines.greeting, lines.body, input.url, lines.expiry, lines.ignore].join("\n\n");
  return { to: input.to, subject: t("subject"), html, text };
}

/** Sends a password reset link. Placeholder addresses (teachers) never get mail. */
export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  url: string;
  locale: string | undefined;
}) {
  if (isPlaceholderEmail(input.to)) return;
  await transport(passwordResetEmail(input));
}
