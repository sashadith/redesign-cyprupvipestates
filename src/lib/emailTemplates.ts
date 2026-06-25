// src/lib/emailTemplates.ts

type Lang = "en" | "ru" | "pl" | "de" | string;

type AutoReplyOptions = {
  name?: string;
  lang?: Lang;
};

export function getAutoReplyEmail({ name, lang = "en" }: AutoReplyOptions) {
  const safeName =
    (name && name.trim()) ||
    (lang === "ru"
      ? "Уважаемый клиент"
      : lang === "pl"
        ? "Szanowny Kliencie"
        : lang === "de"
          ? "Sehr geehrte Kundin, sehr geehrter Kunde"
          : "Dear Client");

  // Тексты по языкам
  const t = (() => {
    switch (lang) {
      case "ru":
        return {
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
          ctaText: "Смотреть проекты недвижимости",
          followUs: "Мы в соцсетях:",
          reason:
            "Вы получили это письмо, потому что оставили заявку на сайте Cyprus VIP Estates.",
          link: "https://cyprusvipestates.com/ru/projects",
        };
      case "pl":
        return {
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
          ctaText: "Zobacz oferty nieruchomości",
          followUs: "Znajdź nas w mediach społecznościowych:",
          reason:
            "Otrzymujesz tę wiadomość, ponieważ wysłałeś formularz na stronie Cyprus VIP Estates.",
          link: "https://cyprusvipestates.com/pl/projects",
        };
      case "de":
        return {
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
          ctaText: "Immobilien auf Zypern ansehen",
          followUs: "Folgen Sie uns:",
          reason:
            "Sie erhalten diese E-Mail, weil Sie eine Anfrage auf der Website von Cyprus VIP Estates gesendet haben.",
          link: "https://cyprusvipestates.com/de/projects",
        };
      default:
        return {
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
          ctaText: "Browse properties in Cyprus",
          followUs: "Follow us:",
          reason:
            "You received this email because you submitted an enquiry on the Cyprus VIP Estates website.",
          link: "https://cyprusvipestates.com/projects",
        };
    }
  })();

  const html = `
<!DOCTYPE html>
<html lang="${lang || "en"}">
<head>
  <meta charset="UTF-8" />
  <title>${t.subject}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4; padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 6px 20px rgba(0,0,0,0.08);">
          
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
            <td align="left" style="padding:16px 32px 0 32px; color:#333333; font-size:14px; line-height:1.7;">
              <p style="margin:0 0 12px 0;">${safeName},</p>
              <p style="margin:0 0 8px 0;">${t.intro1}</p>
              <p style="margin:0 0 12px 0;">${t.intro2}</p>
            </td>
          </tr>

          <!-- WHAT HAPPENS NEXT -->
          <tr>
            <td align="left" style="padding:8px 32px 0 32px; color:#333333; font-size:14px; line-height:1.7;">
              <p style="margin:0 0 8px 0;"><strong>${t.whatNextTitle}</strong></p>
              <ul style="margin:0 0 12px 20px; padding:0; color:#333333; font-size:14px; line-height:1.7;">
                <li>${t.li1}</li>
                <li>${t.li2}</li>
                <li>${t.li3}</li>
              </ul>
              <p style="margin:0 0 12px 0;">
                ${t.speedUp}
              </p>
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
            <td align="center" style="padding:0 32px 24px 32px;">
              <p style="margin:0 0 10px 0; color:#777777; font-size:12px;">
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
            <td align="center" style="padding:0 24px 16px 24px; color:#aaaaaa; font-size:11px; line-height:1.5;">
              <p style="margin:0;">
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
