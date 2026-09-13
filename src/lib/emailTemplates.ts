// src/lib/emailTemplates.ts

import { HE_LANGUAGE_NOTE, isLocale, type Locale } from "@/lib/locale";

/** Identical rules to antispam.ts's escapeHtml, inlined so this module stays
 *  a dependency-free copy/template file (antispam.ts pulls in next/server).
 *  Every interpolated user value in a SENT e-mail goes through it — the
 *  auto-reply's name was the last raw one (Pass B Must fix #10 / S-D). */
function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Lang = Locale;

type AutoReplyOptions = {
  name?: string;
  lang?: string;
};

const SAFE_NAME_EN = "Dear Client";

/** The complete first line of the mail, name already interpolated.
 *
 *  Was a `SAFE_NAME` fallback rendered as `${safeName},`, which produced two
 *  incompatible Hebrew registers in one slot: `שלום,` without a name but a
 *  bare `יוסי,` with one — and a bare first name plus a comma is not a
 *  Hebrew salutation at all (Pass B Must fix #9). Every LTR locale keeps the
 *  exact `${name-or-fallback},` wording it had.
 *
 *  The name is HTML-escaped in EVERY locale (Must fix #10 / Systemic S-D):
 *  it is a raw form field going into an e-mail that gets sent. In `he` it is
 *  additionally wrapped in <bdi> so a Latin name can't reorder the Hebrew
 *  line around it (§11.4). */
const GREETING_LINE: Record<Locale, (name: string) => string> = {
  en: (n) => `${escapeHtml(n || SAFE_NAME_EN)},`,
  ru: (n) => `${escapeHtml(n || "Уважаемый клиент")},`,
  pl: (n) => `${escapeHtml(n || "Szanowny Kliencie")},`,
  de: (n) => `${escapeHtml(n || "Sehr geehrte Kundin, sehr geehrter Kunde")},`,
  // "Dear Client" has no gender-free Hebrew equivalent (`לקוח יקר`/`לקוחה יקרה`
  // would force a choice, styleguide §2), so the nameless form is the bare
  // greeting — and the named form is the same greeting plus the name, the way
  // every other Hebrew message in the CRM writes it (§11.6).
  he: (n) => (n ? `שלום <bdi>${escapeHtml(n)}</bdi>,` : "שלום,"), // REVIEW(he)
};

const AUTO_REPLY_EN = {
  subject: "Thank you for your enquiry — Cyprus VIP Estates",
  title: "Thank you for your enquiry",
  intro1:
    "Thank you for contacting <strong>Cyprus VIP Estates</strong>.",
  intro2:
    "We’ve received your enquiry and will get back to you shortly with personalised property options in Cyprus and answers to your questions.",
  whatNextTitle: "What happens next?",
  li1: "We will review your enquiry and your property preferences.",
  li2: "One of our consultants will contact you via your preferred channel.",
  li3: "We will prepare tailored property offers directly from trusted developers in Cyprus.",
  speedUp:
    "If you’d like to speed up the process, you can already explore our latest projects below.",
  /** Entscheidung E — `he` only. This auto-reply is the FIRST mail a Hebrew
   *  lead gets, it goes out before any human sees the enquiry, and li2 above
   *  promises a consultant "via your preferred channel" — which the ROI/lead
   *  forms let them set to a phone call. Empty for every locale whose
   *  consultation actually happens in that language (Pass B Must fix #3). */
  languageNote: "",
  ctaText: "Browse properties in Cyprus",
  followUs: "Follow us:",
  reason:
    "You received this email because you submitted an enquiry on the Cyprus VIP Estates website.",
  link: "https://cyprusvipestates.com/projects",
};

const AUTO_REPLY: Record<Locale, typeof AUTO_REPLY_EN> = {
  en: AUTO_REPLY_EN,
  ru: {
    subject: "Спасибо за вашу заявку — Cyprus VIP Estates",
    title: "Спасибо за вашу заявку",
    intro1:
      "Спасибо, что обратились в <strong>Cyprus VIP Estates</strong>.",
    intro2:
      "Мы получили вашу заявку и в ближайшее время свяжемся с вами с персональными вариантами недвижимости на Кипре и ответами на ваши вопросы.",
    whatNextTitle: "Что будет дальше?",
    li1: "Мы внимательно изучим вашу заявку и предпочтения по недвижимости.",
    li2: "Наш консультант свяжется с вами удобным для вас способом.",
    li3: "Мы подготовим подборку объектов напрямую от проверенных застройщиков на Кипре.",
    speedUp:
      "Если хотите ускорить процесс, вы уже сейчас можете посмотреть актуальные проекты на нашем сайте.",
    languageNote: "",
    ctaText: "Смотреть проекты недвижимости",
    followUs: "Мы в соцсетях:",
    reason:
      "Вы получили это письмо, потому что оставили заявку на сайте Cyprus VIP Estates.",
    link: "https://cyprusvipestates.com/ru/projects",
  },
  pl: {
    subject: "Dziękujemy za zgłoszenie — Cyprus VIP Estates",
    title: "Dziękujemy za Twoje zgłoszenie",
    intro1:
      "Dziękujemy za kontakt z <strong>Cyprus VIP Estates</strong>.",
    intro2:
      "Otrzymaliśmy Twoje zapytanie i wkrótce skontaktujemy się z Tobą z dopasowanymi ofertami nieruchomości na Cyprze oraz odpowiedziami na Twoje pytania.",
    whatNextTitle: "Co będzie dalej?",
    li1: "Przeanalizujemy Twoje potrzeby i preferencje dotyczące nieruchomości.",
    li2: "Nasz konsultant skontaktuje się z Tobą wybraną formą kontaktu.",
    li3: "Przygotujemy propozycje nieruchomości bezpośrednio od sprawdzonych deweloperów na Cyprze.",
    speedUp:
      "Jeśli chcesz przyspieszyć proces, już teraz możesz zobaczyć aktualne projekty na naszej stronie.",
    languageNote: "",
    ctaText: "Zobacz oferty nieruchomości",
    followUs: "Znajdź nas w mediach społecznościowych:",
    reason:
      "Otrzymujesz tę wiadomość, ponieważ wysłałeś formularz na stronie Cyprus VIP Estates.",
    link: "https://cyprusvipestates.com/pl/projects",
  },
  de: {
    subject: "Vielen Dank für Ihre Anfrage — Cyprus VIP Estates",
    title: "Vielen Dank für Ihre Anfrage",
    intro1:
      "Vielen Dank für Ihre Kontaktanfrage bei <strong>Cyprus VIP Estates</strong>.",
    intro2:
      "Wir haben Ihre Anfrage erhalten und melden uns in Kürze mit individuellen Immobilienvorschlägen auf Zypern und Antworten auf Ihre Fragen.",
    whatNextTitle: "Wie geht es weiter?",
    li1: "Wir analysieren Ihre Anfrage und Ihre Immobilienpräferenzen.",
    li2: "Eine unserer Beraterinnen / einer unserer Berater kontaktiert Sie über Ihren bevorzugten Kanal.",
    li3: "Wir bereiten ein maßgeschneidertes Immobilienangebot direkt von geprüften Entwicklern auf Zypern vor.",
    speedUp:
      "Wenn Sie den Prozess beschleunigen möchten, können Sie sich bereits jetzt unsere aktuellen Projekte ansehen.",
    languageNote: "",
    ctaText: "Immobilien auf Zypern ansehen",
    followUs: "Folgen Sie uns:",
    reason:
      "Sie erhalten diese E-Mail, weil Sie eine Anfrage auf der Website von Cyprus VIP Estates gesendet haben.",
    link: "https://cyprusvipestates.com/de/projects",
  },
  // `|` instead of the em dash the LTR subjects use (styleguide §3: no `—`).
  he: {
    subject: "תודה על הפנייה | Cyprus VIP Estates",
    title: "תודה על הפנייה",
    intro1:
      "ההודעה שלכם הגיעה אל <strong>Cyprus VIP Estates</strong>.",
    intro2:
      "נחזור אליכם בקרוב עם הצעות נכסים מתאימות בקפריסין ועם תשובות לשאלות שלכם.",
    whatNextTitle: "מה קורה עכשיו?",
    li1: "נעבור על מה שכתבתם ועל העדפות הנכס שלכם.",
    li2: "אחד היועצים שלנו ייצור אתכם קשר בדרך שנוחה לכם.",
    li3: "נכין הצעות מותאמות אישית ישירות מיזמים אמינים בקפריסין.",
    speedUp:
      "כדי לזרז את התהליך, אפשר כבר עכשיו לעיין בפרויקטים העדכניים שלנו.",
    languageNote: HE_LANGUAGE_NOTE,
    ctaText: "לצפייה בנכסים בקפריסין",
    followUs: "עקבו אחרינו:",
    reason:
      "קיבלתם את האימייל הזה כי השארתם פנייה באתר Cyprus VIP Estates.",
    link: "https://cyprusvipestates.com/he/projects",
  }, // REVIEW(he)
};

export function getAutoReplyEmail({ name, lang: langInput = "en" }: AutoReplyOptions) {
  const lang: Lang = isLocale(langInput) ? langInput : "en";
  const t = AUTO_REPLY[lang];
  const greetingLine = GREETING_LINE[lang]((name ?? "").trim());

  // RTL support for `he` (Phase 4 / WP7, corrected in fix round 1).
  //
  // `dir` on <html>/<body> alone is worthless here: Gmail (web + app), Yahoo
  // and Outlook.com strip <html>, <head> and <body> and re-host the remaining
  // markup inside their own LTR container — leaving a direction-less table
  // with a mirrored list indent and NON-mirrored bullets, i.e. more broken
  // than before the RTL work (Pass B Must fix #2). So `dir` now also sits on
  // both wrapper tables, on every text cell, on the <ul>, and on every <p>,
  // each paired with an inline `text-align` because the `align` attribute
  // survives Outlook's Word engine but not every sanitizer.
  //
  // Every one of these is the empty string for an LTR locale, so en/de/pl/ru
  // render byte-identical HTML to before (locked by emailTemplatesRtl.test.ts).
  const rtl = lang === "he";
  const dirAttr = rtl ? ` dir="rtl"` : "";
  const textAlign = rtl ? "right" : "left";
  const cellAlign = rtl ? " text-align:right;" : "";
  const pAttrs = rtl ? ` dir="rtl" style="margin:0 0 12px 0; text-align:right;"` : "";
  const listIndent = rtl ? "0 20px 12px 0" : "0 0 12px 20px";

  const html = `
<!DOCTYPE html>
<html lang="${lang}"${dirAttr}>
<head>
  <meta charset="UTF-8" />
  <title>${t.subject}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial,Helvetica,sans-serif;"${dirAttr}>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"${dirAttr} style="background-color:#f4f4f4; padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"${dirAttr} style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 6px 20px rgba(0,0,0,0.08);">
          
          <!-- HEADER / LOGO -->
          <tr>
            <td align="center" style="padding:24px 24px 8px 24px;">
              <img src="https://cyprusvipestates.com/uploads/images/c4911e6ba6654becbeda47f9485754fbcfeb407e-500x634.png" 
                  alt="Cyprus VIP Estates" 
                  width="80"
                  style="display:block; height:auto;" />
            </td>
          </tr>

          <!-- TITLE -->
          <tr>
            <td align="center" style="padding:8px 24px 0 24px;">
              <h1 style="margin:0; font-size:22px; line-height:1.4; font-weight:400; color:#111111;">
                ${t.title}
              </h1>
            </td>
          </tr>

          <!-- HELLO + INTRO -->
          <tr>
            <td align="${textAlign}"${dirAttr} style="padding:16px 32px 0 32px; color:#333333; font-size:14px; line-height:1.7;${cellAlign}">
              <p${pAttrs || ' style="margin:0 0 12px 0;"'}>${greetingLine}</p>
              <p${rtl ? ` dir="rtl" style="margin:0 0 8px 0; text-align:right;"` : ' style="margin:0 0 8px 0;"'}>${t.intro1}</p>
              <p${pAttrs || ' style="margin:0 0 12px 0;"'}>${t.intro2}</p>
            </td>
          </tr>

          <!-- WHAT HAPPENS NEXT -->
          <tr>
            <td align="${textAlign}"${dirAttr} style="padding:8px 32px 0 32px; color:#333333; font-size:14px; line-height:1.7;${cellAlign}">
              <p${rtl ? ` dir="rtl" style="margin:0 0 8px 0; text-align:right;"` : ' style="margin:0 0 8px 0;"'}><strong>${t.whatNextTitle}</strong></p>
              <ul${dirAttr} style="margin:${listIndent}; padding:0; color:#333333; font-size:14px; line-height:1.7;">
                <li>${t.li1}</li>
                <li>${t.li2}</li>
                <li>${t.li3}</li>
              </ul>
              <p${pAttrs || ' style="margin:0 0 12px 0;"'}>
                ${t.speedUp}
              </p>${t.languageNote ? `
              <p dir="rtl" style="margin:0 0 12px 0; text-align:right;">${t.languageNote}</p>` : ""}
            </td>
          </tr>

          <!-- CTA BUTTON -->
          <tr>
            <td align="center" style="padding:8px 32px 24px 32px;">
              <a href="${t.link}"
                target="_blank"
                style="
                  display:inline-block;
                  padding:12px 28px;
                  background-color:#bd8948;
                  color:#ffffff;
                  text-decoration:none;
                  font-size:14px;
                  border-radius:4px;
                  font-weight:400;
                ">
                ${t.ctaText}
              </a>
            </td>
          </tr>

          <!-- CONTACT BLOCK -->
          <!-- <tr>
            <td align="left" style="padding:0 32px 16px 32px; color:#333333; font-size:13px; line-height:1.6; border-top:1px solid #eeeeee;">
              <p style="margin:16px 0 4px 0;"><strong>Cyprus VIP Estates</strong></p>
              <p style="margin:0;">
                Phone / WhatsApp: <a href="tel:+35799278285" style="color:#bd8948; text-decoration:none;">+357 99 278 285</a><br />
                WhatsApp: <a href="https://wa.me/35799278285" style="color:#bd8948; text-decoration:none;">Chat on WhatsApp</a><br />
                Email: <a href="mailto:office@cyprusvipestates.com" style="color:#bd8948; text-decoration:none;">office@cyprusvipestates.com</a><br />
                Website: <a href="https://cyprusvipestates.com" style="color:#bd8948; text-decoration:none;">cyprusvipestates.com</a>
              </p>
            </td>
          </tr> -->

          <!-- SOCIAL LINKS -->
          <!-- SOCIAL ICONS -->
          <tr>
            <td align="center"${dirAttr} style="padding:0 32px 24px 32px;">
              <p${rtl ? ` dir="rtl" style="margin:0 0 10px 0; color:#777777; font-size:12px; text-align:center;"` : ' style="margin:0 0 10px 0; color:#777777; font-size:12px;"'}>
                ${t.followUs}
              </p>

              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 6px;">
                    <a href="https://www.instagram.com/cyprusvipestates/" target="_blank">
                      <img
                        src="https://cyprusvipestates.com/uploads/images/30e5d8455eba417a6f316c1ca4185ac0518b0cbe-114x114.png"
                        alt="Instagram"
                        width="28"
                        style="display:block; border:0;"
                      />
                    </a>
                  </td>

                  <td style="padding:0 6px;">
                    <a href="https://www.youtube.com/@cyprusvipestates" target="_blank">
                      <img
                        src="https://cyprusvipestates.com/uploads/images/cbbb7f73e8035e57234878fe3e829b7fd000ea12-115x115.png"
                        alt="YouTube"
                        width="28"
                        style="display:block; border:0;"
                      />
                    </a>
                  </td>

                  <td style="padding:0 6px;">
                    <a href="https://www.facebook.com/cyprusvipestates" target="_blank">
                      <img
                        src="https://cyprusvipestates.com/uploads/images/9977be1059061f3cf9f51680049d8e69217d88c6-116x115.png"
                        alt="Facebook"
                        width="28"
                        style="display:block; border:0;"
                      />
                    </a>
                  </td>

                  <td style="padding:0 6px;">
                    <a href="https://www.tiktok.com/@cyprusvipestates" target="_blank">
                      <img
                        src="https://cyprusvipestates.com/uploads/images/9c5586f5ca7f08011d0c929dff77a396adcae8fe-64x64.png"
                        alt="TikTok"
                        width="28"
                        style="display:block; border:0;"
                      />
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- END SOCIAL ICONS -->

          <!-- FOOTER SMALL -->
          <tr>
            <td align="center"${dirAttr} style="padding:0 24px 16px 24px; color:#aaaaaa; font-size:11px; line-height:1.5;">
              <p${rtl ? ` dir="rtl" style="margin:0; text-align:center;"` : ' style="margin:0;"'}>
                ${t.reason}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  return {
    subject: t.subject,
    html,
  };
}
