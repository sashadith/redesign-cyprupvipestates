import type { GuideLang } from "./types";

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

type Copy = {
  subject: (title: string) => string;
  hello: (name: string) => string;
  intro: string;
  button: string;
  valid: string;
  next: string;
  reason: string;
};

const COPY: Record<GuideLang, Copy> = {
  en: {
    subject: (t) => `Your guide: ${t}`,
    hello: (n) => (n ? `Hello ${n},` : "Hello,"),
    intro: "Thank you for your interest. Your guide is ready to download:",
    button: "Download the PDF",
    valid: "The link is valid for 30 days.",
    next: "One of our consultants will also get in touch via your preferred channel to answer any questions about buying in Cyprus.",
    reason: "You received this e-mail because you requested a guide on the Cyprus VIP Estates website.",
  },
  de: {
    subject: (t) => `Ihr Ratgeber: ${t}`,
    hello: (n) => (n ? `Guten Tag ${n},` : "Guten Tag,"),
    intro: "vielen Dank für Ihr Interesse. Ihr Ratgeber steht zum Download bereit:",
    button: "PDF herunterladen",
    valid: "Der Link ist 30 Tage gültig.",
    next: "Außerdem meldet sich einer unserer Berater über Ihren bevorzugten Kanal bei Ihnen, um Fragen zum Immobilienkauf auf Zypern zu beantworten.",
    reason: "Sie erhalten diese E-Mail, weil Sie auf der Website von Cyprus VIP Estates einen Ratgeber angefordert haben.",
  },
  pl: {
    subject: (t) => `Twój przewodnik: ${t}`,
    hello: (n) => (n ? `Dzień dobry ${n},` : "Dzień dobry,"),
    intro: "dziękujemy za zainteresowanie. Twój przewodnik jest gotowy do pobrania:",
    button: "Pobierz PDF",
    valid: "Link jest ważny przez 30 dni.",
    next: "Wkrótce skontaktuje się z Tobą nasz doradca w wybranej przez Ciebie formie, aby odpowiedzieć na pytania o zakup nieruchomości na Cyprze.",
    reason: "Otrzymujesz tę wiadomość, ponieważ poprosiłeś o przewodnik na stronie Cyprus VIP Estates.",
  },
  ru: {
    subject: (t) => `Ваш гайд: ${t}`,
    hello: (n) => (n ? `Здравствуйте, ${n}!` : "Здравствуйте!"),
    intro: "Спасибо за интерес. Ваш гайд готов к скачиванию:",
    button: "Скачать PDF",
    valid: "Ссылка действует 30 дней.",
    next: "Наш консультант также свяжется с вами удобным способом, чтобы ответить на вопросы о покупке недвижимости на Кипре.",
    reason: "Вы получили это письмо, потому что запросили гайд на сайте Cyprus VIP Estates.",
  },
};

/** The e-mail a visitor gets after requesting a lead-magnet guide. `url` must be absolute. */
export function getGuideEmail({ name, lang, title, url }: { name?: string; lang: GuideLang; title: string; url: string }) {
  const t = COPY[lang];
  const safeUrl = esc(url);
  const html = `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="UTF-8" /><title>${esc(t.subject(title))}</title><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4; padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:8px;">
        <tr><td align="center" style="padding:24px 24px 8px 24px;">
          <img src="https://cyprusvipestates.com/uploads/images/c4911e6ba6654becbeda47f9485754fbcfeb407e-500x634.png" alt="Cyprus VIP Estates" width="80" style="display:block; height:auto;" />
        </td></tr>
        <tr><td align="center" style="padding:8px 32px 0 32px;"><h1 style="margin:0; font-size:20px; line-height:1.4; font-weight:400; color:#111111;">${esc(title)}</h1></td></tr>
        <tr><td style="padding:16px 32px 0 32px; color:#333333; font-size:14px; line-height:1.7;">
          <p style="margin:0 0 12px 0;">${esc(t.hello((name ?? "").trim()))}</p>
          <p style="margin:0 0 16px 0;">${esc(t.intro)}</p>
        </td></tr>
        <tr><td align="center" style="padding:0 32px 8px 32px;">
          <a href="${safeUrl}" style="display:inline-block; background-color:#b07d3a; color:#ffffff; text-decoration:none; font-size:15px; padding:13px 28px; border-radius:4px;">${esc(t.button)}</a>
        </td></tr>
        <tr><td style="padding:8px 32px 0 32px; color:#666666; font-size:12px; line-height:1.6;" align="center">${esc(t.valid)}</td></tr>
        <tr><td style="padding:16px 32px 24px 32px; color:#333333; font-size:14px; line-height:1.7;"><p style="margin:0;">${esc(t.next)}</p></td></tr>
        <tr><td style="padding:0 32px 24px 32px; color:#888888; font-size:11px; line-height:1.6;" align="center">${esc(t.reason)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject: t.subject(title), html };
}
