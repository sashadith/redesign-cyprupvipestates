/* UI copy for the Partners page, per language. Rewritten 2026-10-29 around the
   actual partner program (src/lib/partner/i18n FAQ + agreement): 30–50 % of our
   commission (Handover 30 / Fix 50), 6-month client protection from the last real
   contact, payout within 7 days of the developer's payment with a credit note,
   sign-up in the partner portal. The form at the end is a call-back request.
   Keep these facts in step with the portal when the program changes. */

import type { Locale } from "@/lib/locale";

/* `source` makes a stat live: the page replaces `number` with the real count
   from the database (2026-09-29). "projects" uses the same count the /projects
   listing shows, so the two can never disagree; "units" counts units whose
   status is available inside published developments. Stats without a source
   keep their literal number. */
export type PartnersStat = { number: string; sign?: string; title: string; description: string; source?: "projects" | "units" };
export type PartnersBenefit = { title: string; description: string };
export type PartnersType = { title: string; description: string };
export type PartnersStep = { title: string; description: string };
export type PartnersFaqItem = { question: string; answer: string };

export type PartnersCopy = {
  metaTitle: string;
  metaDescription: string;

  heroEyebrow: string;
  heroTitleStart: string;
  heroTitleAccent: string;
  heroTitleEnd: string;
  heroLead: string;
  heroCta: string;
  heroNote: string;
  portalLoginPrompt: string;
  portalLoginLink: string;
  portalSelfPrompt: string;
  portalSelfLink: string;

  statsEyebrow: string;
  statsTitleStart: string;
  statsTitleAccent: string;
  stats: PartnersStat[];

  benefitsEyebrow: string;
  benefitsTitleStart: string;
  benefitsTitleAccent: string;
  benefitsTitleEnd: string;
  benefits: PartnersBenefit[];

  typesEyebrow: string;
  typesTitleStart: string;
  typesTitleAccent1: string;
  typesTitleMiddle: string;
  typesTitleAccent2: string;
  types: PartnersType[];

  howEyebrow: string;
  howTitleStart: string;
  howTitleAccent: string;
  steps: PartnersStep[];

  faqEyebrow: string;
  faqTitleStart: string;
  faqTitleAccent: string;
  faq: PartnersFaqItem[];

  ctaTitleStart: string;
  ctaTitleAccent: string;
  ctaDescription: string;
  ctaButton: string;

  formTitleStart: string;
  formTitleAccent: string;
  formTitleEnd: string;
  formLabelName: string;
  formLabelSurname: string;
  formLabelPhone: string;
  formLabelEmail: string;
  formLabelCountry: string;
  formSubmit: string;
  formConsentPre: string;
  formConsentLink: string;
  formConsentPost: string;
  formPolicyHref: string;
  formSuccess: string;
  formError: string;
  vName: string;
  vSurname: string;
  vPhone: string;
  vEmail: string;
  vEmailInvalid: string;
  vCountry: string;
  vConsent: string;
};

const EN: PartnersCopy = {
    metaTitle: "Real Estate Referral Partner Program – Cyprus VIP Estates",
    metaDescription: "Earn 30–50% of our commission on every Cyprus property sale you refer. 6-month client protection, payout within 7 days of the developer's payment, full tracking in the partner portal.",
    heroEyebrow: "Become a partner of Cyprus VIP Estates",
    heroTitleStart: "Join our ",
    heroTitleAccent: "partner program",
    heroTitleEnd: " and earn with us",
    heroLead: "Receive 30 to 50% of our commission on every property purchase you bring to us.",
    heroCta: "Become a partner",
    heroNote: "30% if we take over your client completely (Handover), 50% if you stay involved in the purchase (Fix).",
    portalLoginPrompt: "Already a partner? ",
    portalLoginLink: "Log in to the partner portal",
    portalSelfPrompt: "Prefer to sign up yourself? ",
    portalSelfLink: "Register in the partner portal.",
    statsEyebrow: "Track record",
    statsTitleStart: "A team built on ",
    statsTitleAccent: "results",
    stats: [
      { number: "0", source: "projects", title: "Real estate projects", description: "In Southern Cyprus. From studio apartments to high-class villas" },
      { number: "0", source: "units", title: "Available units", description: "Residential, investment and commercial properties" },
      { number: "10", title: "Years of experience", description: "As a full-service real estate marketing agency" },
      { number: "360", sign: "°", title: "Customer service", description: "We guide your client from the first contact to key handover" },
    ],
    benefitsEyebrow: "Why partner with us",
    benefitsTitleStart: "The ",
    benefitsTitleAccent: "benefits",
    benefitsTitleEnd: " of our partner program",
    benefits: [
      { title: "Fast payouts", description: "We pay within 7 days after the developer has paid our commission, usually within 6 weeks of the reservation agreement. Every payout comes with a credit note." },
      { title: "We handle the purchase", description: "Our team in Cyprus organises viewings, negotiates with the developer and works with independent lawyers until the keys are handed over." },
      { title: "Your client stays your client", description: "Every client you submit is protected for 6 months from the last real contact with our team, by call, email or WhatsApp." },
      { title: "Everything in the partner portal", description: "Submit clients, follow every step, see your rate for each project, calculate your commission and download your credit notes. Notifications by email or Telegram." },
    ],
    typesEyebrow: "Who it is for",
    typesTitleStart: "Who our ",
    typesTitleAccent1: "partner program",
    typesTitleMiddle: " is ",
    typesTitleAccent2: "for",
    types: [
      { title: "Estate agents and agencies", description: "Agents and brokers whose clients want to buy in Cyprus. You keep your client relationship, we handle the purchase locally." },
      { title: "Advisers and relocation specialists", description: "Relocation, tax and financial advisers, lawyers and consultants who are asked about property in Cyprus." },
      { title: "Recommenders with a network", description: "You know people who are looking for property in Cyprus. You introduce them with their consent, we take care of the rest." },
    ],
    howEyebrow: "The process",
    howTitleStart: "How ",
    howTitleAccent: "it works",
    steps: [
      { title: "Register", description: "Sign up in the partner portal and accept the partner agreement. We review every application personally and then activate your access." },
      { title: "Submit clients", description: "Submit a client with their consent and choose Handover or Fix. You can follow every step in the portal." },
      { title: "Get paid", description: "Once the developer has paid our commission, we transfer your share within 7 days and issue a credit note." },
    ],
    faqEyebrow: "Questions",
    faqTitleStart: "Frequently asked ",
    faqTitleAccent: "questions",
    faq: [
      {
        question: "How do I become a partner of Cyprus VIP Estates?",
        answer: "Register in the partner portal and accept the partner agreement. We review every application personally and then activate your access. If you would rather talk first, leave your details in the form at the end of this page and we will call you back.",
      },
      {
        question: "How much commission do I earn?",
        answer: "You receive 30 to 50% of our commission: 30% if we take over the client completely (Handover), 50% if you stay involved in the purchase (Fix). The portal shows your rate for each project, and the calculator shows your payout for any price.",
      },
      {
        question: "I'm an agent or adviser outside Cyprus. Can I still take part?",
        answer: "Yes. The program is built for international collaboration. You do not need to be based in Cyprus or handle the transaction yourself: we manage viewings, the developer and the purchase on site.",
      },
      {
        question: "How long is my client protected?",
        answer: "For 6 months from the last real contact with our team (call, email or WhatsApp). If we already know the client, the submission is not accepted and you receive a short notice.",
      },
      {
        question: "When and how am I paid?",
        answer: "Within 7 days after the developer has paid our commission, usually within 6 weeks of the reservation agreement. We pay by bank transfer and issue a credit note on your behalf. If a sale is cancelled or our commission is refunded, no partner commission is due.",
      },
      {
        question: "Do I need my client's consent?",
        answer: "Yes. You may only share a client's contact details with their consent, as data protection law (GDPR) requires.",
      },
      {
        question: "Who can join the partner program?",
        answer: "Estate agents and agencies, relocation specialists, lawyers, tax and financial advisers, and independent consultants. Companies registered in the EU need a VAT number. Every application is reviewed personally.",
      },
    ],
    ctaTitleStart: "Become our ",
    ctaTitleAccent: "partner",
    ctaDescription: "Leave your details and we will call you back, usually the same day.",
    ctaButton: "Become a partner",
    formTitleStart: "Prefer to ",
    formTitleAccent: "talk",
    formTitleEnd: " first?",
    formLabelName: "Your name",
    formLabelSurname: "Surname",
    formLabelPhone: "Phone",
    formLabelEmail: "Email",
    formLabelCountry: "Country",
    formSubmit: "Request a call back",
    formConsentPre: "I have read and accept the ",
    formConsentLink: "privacy policy",
    formConsentPost: ".",
    formPolicyHref: "/privacy-policy",
    formSuccess: "Thank you — your enquiry has reached us. An adviser will be in touch, usually the same day.",
    formError: "Your enquiry could not be sent. Please try again, or reach us at office@cyprusvipestates.com or +357 99 278 285.",
    vName: "Name is required",
    vSurname: "Surname is required",
    vPhone: "Phone is required",
    vEmail: "Email is required",
    vEmailInvalid: "Invalid email address",
    vCountry: "Country is required",
    vConsent: "Consent is required",
};

// he (Phase 4): decision J: Partners stays English for he — no translation task,
// no ltrIsolate() needed since the whole page renders in English/LTR for he.
export const PARTNERS_COPY: Record<Locale, PartnersCopy> = {
  en: EN,
  de: {
    metaTitle: "Immobilien-Partnerprogramm mit Provision – Cyprus VIP Estates",
    metaDescription: "Erhalte 30–50 % unserer Provision für jede vermittelte Immobilie auf Zypern. 6 Monate Kundenschutz, Auszahlung innerhalb von 7 Tagen nach Zahlung des Bauträgers, alles im Partnerportal.",
    heroEyebrow: "Werde Partner von Cyprus VIP Estates",
    heroTitleStart: "Werde jetzt Teil unseres ",
    heroTitleAccent: "Partnerprogramms",
    heroTitleEnd: " und verdiene mit uns",
    heroLead: "Erhalte 30 bis 50 % unserer Provision für jeden Immobilienkauf, den Du uns vermittelst.",
    heroCta: "Jetzt Partner werden",
    heroNote: "30 %, wenn wir Deinen Kunden komplett übernehmen (Handover), 50 %, wenn Du beim Kauf weiter dabei bist (Fix).",
    portalLoginPrompt: "Schon Partner? ",
    portalLoginLink: "Zum Partnerportal anmelden",
    portalSelfPrompt: "Lieber direkt selbst registrieren? ",
    portalSelfLink: "Registriere Dich im Partnerportal.",
    statsEyebrow: "Erfolgsbilanz",
    statsTitleStart: "Ein Team mit ",
    statsTitleAccent: "Ergebnissen",
    stats: [
      { number: "0", source: "projects", title: "Immobilienprojekte", description: "Auf Süd-Zypern. Von Studio-Apartments bis High-Class-Villen" },
      { number: "0", source: "units", title: "Verfügbare Einheiten", description: "Wohn-, Anlage- und Gewerbeimmobilien" },
      { number: "10", title: "Jahre Erfahrung", description: "Als Full-Service Immobilien-Marketing-Agentur" },
      { number: "360", sign: "°", title: "Service für unsere Kunden", description: "Wir begleiten Deinen Kunden vom ersten Kontakt bis zur Schlüsselübergabe" },
    ],
    benefitsEyebrow: "Warum mit uns zusammenarbeiten",
    benefitsTitleStart: "Die ",
    benefitsTitleAccent: "Vorteile",
    benefitsTitleEnd: " unseres Partnerprogramms",
    benefits: [
      { title: "Schnelle Auszahlung", description: "Wir zahlen innerhalb von 7 Tagen, nachdem der Bauträger unsere Provision gezahlt hat, meist innerhalb von 6 Wochen nach dem Reservierungsvertrag. Zu jeder Auszahlung erhältst Du eine Gutschrift." },
      { title: "Wir übernehmen den Kauf", description: "Unser Team auf Zypern organisiert Besichtigungen, verhandelt mit dem Bauträger und arbeitet mit unabhängigen Anwälten bis zur Schlüsselübergabe." },
      { title: "Dein Kunde bleibt Dein Kunde", description: "Jeder Kunde, den Du einreichst, ist 6 Monate ab dem letzten echten Kontakt mit unserem Team geschützt, per Anruf, E-Mail oder WhatsApp." },
      { title: "Alles im Partnerportal", description: "Kunden einreichen, jeden Schritt verfolgen, Deinen Satz je Projekt sehen, Deine Provision berechnen und Gutschriften herunterladen. Benachrichtigungen per E-Mail oder Telegram." },
    ],
    typesEyebrow: "Für wen",
    typesTitleStart: "Für wen unser ",
    typesTitleAccent1: "Partnerprogramm",
    typesTitleMiddle: " ",
    typesTitleAccent2: "gemacht ist",
    types: [
      { title: "Makler und Agenturen", description: "Makler und Vermittler, deren Kunden auf Zypern kaufen möchten. Du behältst Deine Kundenbeziehung, wir wickeln den Kauf vor Ort ab." },
      { title: "Berater und Relocation-Spezialisten", description: "Relocation-, Steuer- und Finanzberater, Anwälte und Consultants, die nach Immobilien auf Zypern gefragt werden." },
      { title: "Empfehlungsgeber mit Netzwerk", description: "Du kennst Menschen, die eine Immobilie auf Zypern suchen. Du stellst sie mit ihrem Einverständnis vor, um den Rest kümmern wir uns." },
    ],
    howEyebrow: "Der Ablauf",
    howTitleStart: "So ",
    howTitleAccent: "funktioniert es",
    steps: [
      { title: "Registrieren", description: "Melde Dich im Partnerportal an und akzeptiere die Partnervereinbarung. Wir prüfen jede Bewerbung persönlich und schalten Deinen Zugang dann frei." },
      { title: "Kunden einreichen", description: "Reiche einen Kunden mit seinem Einverständnis ein und wähle Handover oder Fix. Jeden Schritt verfolgst Du im Portal." },
      { title: "Ausgezahlt werden", description: "Sobald der Bauträger unsere Provision gezahlt hat, überweisen wir Deinen Anteil innerhalb von 7 Tagen und stellen eine Gutschrift aus." },
    ],
    faqEyebrow: "Fragen",
    faqTitleStart: "Häufig gestellte ",
    faqTitleAccent: "Fragen",
    faq: [
      {
        question: "Wie werde ich Partner von Cyprus VIP Estates?",
        answer: "Registriere Dich im Partnerportal und akzeptiere die Partnervereinbarung. Wir prüfen jede Bewerbung persönlich und schalten Deinen Zugang dann frei. Wenn Du lieber zuerst sprechen möchtest, hinterlasse Deine Daten im Formular am Ende dieser Seite, wir rufen Dich zurück.",
      },
      {
        question: "Wie viel Provision erhalte ich?",
        answer: "Du erhältst 30 bis 50 % unserer Provision: 30 %, wenn wir den Kunden komplett übernehmen (Handover), 50 %, wenn Du beim Kauf weiter dabei bist (Fix). Im Portal siehst Du Deinen Satz je Projekt, der Rechner zeigt Deine Auszahlung für jeden Preis.",
      },
      {
        question: "Ich bin Makler oder Berater außerhalb Zyperns. Kann ich trotzdem mitmachen?",
        answer: "Ja. Das Programm ist für internationale Zusammenarbeit gemacht. Du musst weder auf Zypern ansässig sein noch die Transaktion selbst abwickeln: Besichtigungen, Bauträger und Kauf übernehmen wir vor Ort.",
      },
      {
        question: "Wie lange ist mein Kunde geschützt?",
        answer: "6 Monate ab dem letzten echten Kontakt mit unserem Team (Anruf, E-Mail oder WhatsApp). Kennen wir den Kunden bereits, wird die Einreichung nicht angenommen und Du erhältst einen kurzen Hinweis.",
      },
      {
        question: "Wann und wie werde ich bezahlt?",
        answer: "Innerhalb von 7 Tagen, nachdem der Bauträger unsere Provision gezahlt hat, meist innerhalb von 6 Wochen nach dem Reservierungsvertrag. Wir überweisen auf Dein Konto und stellen in Deinem Namen eine Gutschrift aus. Wird ein Kauf storniert oder unsere Provision erstattet, entfällt die Partnerprovision.",
      },
      {
        question: "Brauche ich das Einverständnis meines Kunden?",
        answer: "Ja. Du darfst die Kontaktdaten eines Kunden nur mit seinem Einverständnis weitergeben, so verlangt es die DSGVO.",
      },
      {
        question: "Wer kann am Partnerprogramm teilnehmen?",
        answer: "Makler und Agenturen, Relocation-Spezialisten, Anwälte, Steuer- und Finanzberater sowie unabhängige Consultants. Unternehmen mit Sitz in der EU brauchen eine USt-IdNr. Jede Bewerbung wird persönlich geprüft.",
      },
    ],
    ctaTitleStart: "Werde unser ",
    ctaTitleAccent: "Partner",
    ctaDescription: "Hinterlasse Deine Daten, wir rufen Dich zurück, meist noch am selben Tag.",
    ctaButton: "Jetzt Partner werden",
    formTitleStart: "Lieber zuerst ",
    formTitleAccent: "sprechen",
    formTitleEnd: "?",
    formLabelName: "Vorname",
    formLabelSurname: "Nachname",
    formLabelPhone: "Telefon",
    formLabelEmail: "E-Mail-Adresse",
    formLabelCountry: "Land",
    formSubmit: "Rückruf anfordern",
    formConsentPre: "Ich habe die ",
    formConsentLink: "Datenschutzerklärung",
    formConsentPost: " gelesen und akzeptiere sie.",
    formPolicyHref: "/de/datenschutzrichtlinie",
    formSuccess: "Vielen Dank, Deine Anfrage ist bei uns angekommen. Wir melden uns, meist noch am selben Tag.",
    formError: "Deine Anfrage konnte nicht gesendet werden. Bitte versuche es erneut oder schreib uns an office@cyprusvipestates.com bzw. ruf an: +357 99 278 285.",
    vName: "Name ist erforderlich",
    vSurname: "Nachname ist erforderlich",
    vPhone: "Telefon ist erforderlich",
    vEmail: "E-Mail ist erforderlich",
    vEmailInvalid: "Ungültige E-Mail-Adresse",
    vCountry: "Land ist erforderlich",
    vConsent: "Zustimmung erforderlich",
  },
  pl: {
    metaTitle: "Program Partnerski z Prowizją za Nieruchomości – Cyprus VIP Estates",
    metaDescription: "Otrzymuj 30–50% naszej prowizji za każdą poleconą nieruchomość na Cyprze. 6 miesięcy ochrony klienta, wypłata w ciągu 7 dni od płatności dewelopera, wszystko w portalu partnera.",
    heroEyebrow: "Zostań partnerem Cyprus VIP Estates",
    heroTitleStart: "Dołącz do naszego ",
    heroTitleAccent: "programu partnerskiego",
    heroTitleEnd: " i zarabiaj z nami",
    heroLead: "Otrzymuj od 30 do 50% naszej prowizji za każdy zakup nieruchomości, który nam polecisz.",
    heroCta: "Zostań partnerem",
    heroNote: "30%, jeśli w pełni przejmujemy Twojego klienta (Handover), 50%, jeśli nadal uczestniczysz w zakupie (Fix).",
    portalLoginPrompt: "Jesteś już partnerem? ",
    portalLoginLink: "Zaloguj się do portalu partnera",
    portalSelfPrompt: "Wolisz zarejestrować się sam? ",
    portalSelfLink: "Zarejestruj się w portalu partnera.",
    statsEyebrow: "Nasze doświadczenie",
    statsTitleStart: "Zespół, który daje ",
    statsTitleAccent: "rezultaty",
    stats: [
      { number: "0", source: "projects", title: "Projektów nieruchomości", description: "Na południu Cypru – od kawalerek po luksusowe wille" },
      { number: "0", source: "units", title: "Dostępne nieruchomości", description: "Mieszkaniowe, inwestycyjne i komercyjne" },
      { number: "10", title: "Lat doświadczenia", description: "Jako agencja marketingu nieruchomości typu full-service" },
      { number: "360", sign: "°", title: "Obsługa klienta", description: "Prowadzimy Twojego klienta od pierwszego kontaktu do przekazania kluczy" },
    ],
    benefitsEyebrow: "Dlaczego warto z nami współpracować",
    benefitsTitleStart: "Korzyści ",
    benefitsTitleAccent: "ze współpracy",
    benefitsTitleEnd: " w naszym programie partnerskim",
    benefits: [
      { title: "Szybkie wypłaty", description: "Płacimy w ciągu 7 dni od zapłaty naszej prowizji przez dewelopera, zwykle w ciągu 6 tygodni od umowy rezerwacyjnej. Do każdej wypłaty wystawiamy fakturę w ramach samofakturowania." },
      { title: "Zakup bierzemy na siebie", description: "Nasz zespół na Cyprze organizuje oglądanie, negocjuje z deweloperem i współpracuje z niezależnymi prawnikami aż do przekazania kluczy." },
      { title: "Twój klient pozostaje Twoim klientem", description: "Każdy zgłoszony przez Ciebie klient jest chroniony przez 6 miesięcy od ostatniego realnego kontaktu z naszym zespołem: telefonu, e-maila lub WhatsApp." },
      { title: "Wszystko w portalu partnera", description: "Zgłaszaj klientów, śledź każdy etap, sprawdzaj stawkę dla każdego projektu, licz prowizję i pobieraj faktury. Powiadomienia e-mailem lub przez Telegram." },
    ],
    typesEyebrow: "Dla kogo",
    typesTitleStart: "Dla kogo jest nasz ",
    typesTitleAccent1: "program partnerski",
    typesTitleMiddle: "",
    typesTitleAccent2: "",
    types: [
      { title: "Agenci i agencje nieruchomości", description: "Agenci i pośrednicy, których klienci chcą kupić na Cyprze. Zachowujesz relację z klientem, a zakup na miejscu prowadzimy my." },
      { title: "Doradcy i specjaliści ds. relokacji", description: "Doradcy ds. relokacji, podatków i finansów, prawnicy i konsultanci, których klienci pytają o nieruchomości na Cyprze." },
      { title: "Polecający z siecią kontaktów", description: "Znasz osoby, które szukają nieruchomości na Cyprze. Przedstawiasz je za ich zgodą, a resztą zajmujemy się my." },
    ],
    howEyebrow: "Jak to działa",
    howTitleStart: "Jak ",
    howTitleAccent: "to działa",
    steps: [
      { title: "Rejestracja", description: "Zarejestruj się w portalu partnera i zaakceptuj umowę partnerską. Każde zgłoszenie sprawdzamy osobiście, a potem aktywujemy Twój dostęp." },
      { title: "Zgłaszanie klientów", description: "Zgłoś klienta za jego zgodą i wybierz Handover lub Fix. Każdy etap śledzisz w portalu." },
      { title: "Wypłata", description: "Gdy deweloper zapłaci naszą prowizję, w ciągu 7 dni przelewamy Twój udział i wystawiamy fakturę." },
    ],
    faqEyebrow: "Pytania",
    faqTitleStart: "Najczęściej zadawane ",
    faqTitleAccent: "pytania",
    faq: [
      {
        question: "Jak zostać partnerem Cyprus VIP Estates?",
        answer: "Zarejestruj się w portalu partnera i zaakceptuj umowę partnerską. Każde zgłoszenie sprawdzamy osobiście, a potem aktywujemy Twój dostęp. Jeśli wolisz najpierw porozmawiać, zostaw dane w formularzu na końcu tej strony, a oddzwonimy.",
      },
      {
        question: "Ile wynosi moja prowizja?",
        answer: "Otrzymujesz od 30 do 50% naszej prowizji: 30%, jeśli w pełni przejmujemy klienta (Handover), 50%, jeśli nadal uczestniczysz w zakupie (Fix). W portalu widzisz swoją stawkę dla każdego projektu, a kalkulator pokazuje wypłatę dla dowolnej ceny.",
      },
      {
        question: "Jestem agentem lub doradcą spoza Cypru. Czy mogę dołączyć?",
        answer: "Tak. Program jest stworzony do współpracy międzynarodowej. Nie musisz mieszkać na Cyprze ani samodzielnie prowadzić transakcji: oglądanie, kontakt z deweloperem i zakup prowadzimy na miejscu.",
      },
      {
        question: "Jak długo mój klient jest chroniony?",
        answer: "Przez 6 miesięcy od ostatniego realnego kontaktu z naszym zespołem (telefon, e-mail lub WhatsApp). Jeśli już znamy klienta, zgłoszenie nie zostanie przyjęte, a Ty otrzymasz krótką informację.",
      },
      {
        question: "Kiedy i jak otrzymam wypłatę?",
        answer: "W ciągu 7 dni od zapłaty naszej prowizji przez dewelopera, zwykle w ciągu 6 tygodni od umowy rezerwacyjnej. Płacimy przelewem i wystawiamy w Twoim imieniu fakturę (samofakturowanie). Jeśli zakup zostanie anulowany lub nasza prowizja zwrócona, prowizja partnera nie przysługuje.",
      },
      {
        question: "Czy potrzebuję zgody klienta?",
        answer: "Tak. Dane kontaktowe klienta możesz przekazać tylko za jego zgodą, zgodnie z RODO.",
      },
      {
        question: "Kto może dołączyć do programu partnerskiego?",
        answer: "Agenci i agencje nieruchomości, specjaliści ds. relokacji, prawnicy, doradcy podatkowi i finansowi oraz niezależni konsultanci. Firmy zarejestrowane w UE muszą podać numer VAT. Każde zgłoszenie sprawdzamy osobiście.",
      },
    ],
    ctaTitleStart: "Zostań naszym ",
    ctaTitleAccent: "partnerem",
    ctaDescription: "Zostaw swoje dane, a oddzwonimy, zwykle jeszcze tego samego dnia.",
    ctaButton: "Zostań partnerem",
    formTitleStart: "Wolisz najpierw ",
    formTitleAccent: "porozmawiać",
    formTitleEnd: "?",
    formLabelName: "Imię",
    formLabelSurname: "Nazwisko",
    formLabelPhone: "Telefon",
    formLabelEmail: "E-mail",
    formLabelCountry: "Kraj",
    formSubmit: "Poproś o kontakt",
    formConsentPre: "Przeczytałem(-am) i akceptuję ",
    formConsentLink: "politykę prywatności",
    formConsentPost: ".",
    formPolicyHref: "/pl/polityka-prywatnosci",
    formSuccess: "Dziękujemy — Twoje zapytanie do nas dotarło. Doradca odezwie się, zwykle jeszcze tego samego dnia.",
    formError: "Nie udało się wysłać zapytania. Spróbuj ponownie lub skontaktuj się z nami: office@cyprusvipestates.com albo +357 99 278 285.",
    vName: "Imię jest wymagane",
    vSurname: "Nazwisko jest wymagane",
    vPhone: "Telefon jest wymagany",
    vEmail: "Email jest wymagany",
    vEmailInvalid: "Nieprawidłowy format email",
    vCountry: "Kraj jest wymagany",
    vConsent: "Zgoda jest wymagana",
  },
  ru: {
    metaTitle: "Партнёрская программа с комиссией за недвижимость – Cyprus VIP Estates",
    metaDescription: "Получайте 30–50% нашей комиссии за каждую рекомендованную недвижимость на Кипре. Защита клиента 6 месяцев, выплата в течение 7 дней после оплаты застройщика, всё в партнёрском портале.",
    heroEyebrow: "Стань партнёром Cyprus VIP Estates",
    heroTitleStart: "Стань частью нашей ",
    heroTitleAccent: "партнёрской программы",
    heroTitleEnd: " и зарабатывай с нами",
    heroLead: "Получайте от 30 до 50% нашей комиссии за каждую покупку недвижимости, которую вы нам приводите.",
    heroCta: "Стать партнёром",
    heroNote: "30%, если мы полностью берём клиента на себя (Handover), 50%, если вы продолжаете участвовать в покупке (Fix).",
    portalLoginPrompt: "Уже партнёр? ",
    portalLoginLink: "Войти в партнёрский портал",
    portalSelfPrompt: "Хотите зарегистрироваться сами? ",
    portalSelfLink: "Зарегистрируйтесь в партнёрском портале.",
    statsEyebrow: "Наши результаты",
    statsTitleStart: "Команда, которая даёт ",
    statsTitleAccent: "результат",
    stats: [
      { number: "0", source: "projects", title: "Проектов недвижимости", description: "На юге Кипра: от студий до элитных вилл" },
      { number: "0", source: "units", title: "Доступных объектов", description: "Жилая, инвестиционная и коммерческая недвижимость" },
      { number: "10", title: "Лет опыта", description: "Как агентство полного цикла по маркетингу недвижимости" },
      { number: "360", sign: "°", title: "Сервис для клиентов", description: "Сопровождаем вашего клиента от первого контакта до передачи ключей" },
    ],
    benefitsEyebrow: "Почему стоит с нами сотрудничать",
    benefitsTitleStart: "Преимущества ",
    benefitsTitleAccent: "нашей программы",
    benefitsTitleEnd: " для партнёров",
    benefits: [
      { title: "Быстрые выплаты", description: "Мы платим в течение 7 дней после того, как застройщик оплатил нашу комиссию, обычно в течение 6 недель после договора резервирования. К каждой выплате вы получаете кредит-ноту." },
      { title: "Покупку ведём мы", description: "Наша команда на Кипре организует просмотры, ведёт переговоры с застройщиком и работает с независимыми юристами до передачи ключей." },
      { title: "Ваш клиент остаётся вашим", description: "Каждый клиент, которого вы передали, защищён 6 месяцев с момента последнего реального контакта с нашей командой: звонка, письма или WhatsApp." },
      { title: "Всё в партнёрском портале", description: "Передавайте клиентов, следите за каждым этапом, смотрите свою ставку по каждому проекту, считайте комиссию и скачивайте кредит-ноты. Уведомления по email или в Telegram." },
    ],
    typesEyebrow: "Для кого",
    typesTitleStart: "Для кого наша ",
    typesTitleAccent1: "партнёрская программа",
    typesTitleMiddle: "",
    typesTitleAccent2: "",
    types: [
      { title: "Риелторы и агентства", description: "Агенты и брокеры, чьи клиенты хотят купить на Кипре. Вы сохраняете отношения с клиентом, а покупку на месте ведём мы." },
      { title: "Консультанты и специалисты по релокации", description: "Консультанты по релокации, налогам и финансам, юристы, которых клиенты спрашивают о недвижимости на Кипре." },
      { title: "Рекомендатели с кругом знакомств", description: "Вы знаете людей, которые ищут недвижимость на Кипре. Вы знакомите нас с ними с их согласия, остальное берём на себя мы." },
    ],
    howEyebrow: "Как это работает",
    howTitleStart: "Как это ",
    howTitleAccent: "работает",
    steps: [
      { title: "Регистрация", description: "Зарегистрируйтесь в партнёрском портале и примите партнёрское соглашение. Мы лично проверяем каждую заявку и затем открываем доступ." },
      { title: "Передача клиентов", description: "Передайте клиента с его согласия и выберите Handover или Fix. Каждый этап виден в портале." },
      { title: "Выплата", description: "Как только застройщик оплатит нашу комиссию, мы в течение 7 дней переводим вашу долю и выставляем кредит-ноту." },
    ],
    faqEyebrow: "Вопросы",
    faqTitleStart: "Часто задаваемые ",
    faqTitleAccent: "вопросы",
    faq: [
      {
        question: "Как стать партнёром Cyprus VIP Estates?",
        answer: "Зарегистрируйтесь в партнёрском портале и примите партнёрское соглашение. Мы лично проверяем каждую заявку и затем открываем доступ. Если сначала хотите поговорить, оставьте данные в форме в конце этой страницы, и мы перезвоним.",
      },
      {
        question: "Какую комиссию я получаю?",
        answer: "Вы получаете от 30 до 50% нашей комиссии: 30%, если мы полностью берём клиента на себя (Handover), 50%, если вы продолжаете участвовать в покупке (Fix). В портале видна ваша ставка по каждому проекту, а калькулятор показывает выплату для любой цены.",
      },
      {
        question: "Я агент или консультант не на Кипре. Могу ли я участвовать?",
        answer: "Да. Программа создана для международного сотрудничества. Вам не нужно жить на Кипре или самому вести сделку: просмотры, работу с застройщиком и покупку мы ведём на месте.",
      },
      {
        question: "Как долго мой клиент защищён?",
        answer: "6 месяцев с момента последнего реального контакта с нашей командой (звонок, письмо или WhatsApp). Если клиент нам уже известен, заявка не принимается, и вы получите короткое уведомление.",
      },
      {
        question: "Когда и как я получу выплату?",
        answer: "В течение 7 дней после того, как застройщик оплатил нашу комиссию, обычно в течение 6 недель после договора резервирования. Мы переводим деньги на ваш счёт и выставляем кредит-ноту от вашего имени. Если покупка отменена или наша комиссия возвращена, партнёрская комиссия не выплачивается.",
      },
      {
        question: "Нужно ли согласие клиента?",
        answer: "Да. Передавать контакты клиента можно только с его согласия, как требует закон о защите данных (GDPR).",
      },
      {
        question: "Кто может участвовать в партнёрской программе?",
        answer: "Риелторы и агентства, специалисты по релокации, юристы, налоговые и финансовые консультанты, независимые консультанты. Компании из ЕС указывают номер плательщика НДС. Каждая заявка проверяется лично.",
      },
    ],
    ctaTitleStart: "Стань нашим ",
    ctaTitleAccent: "партнёром",
    ctaDescription: "Оставьте свои данные, и мы перезвоним, обычно в тот же день.",
    ctaButton: "Стать партнёром",
    formTitleStart: "Хотите сначала ",
    formTitleAccent: "поговорить",
    formTitleEnd: "?",
    formLabelName: "Ваше имя",
    formLabelSurname: "Фамилия",
    formLabelPhone: "Телефон",
    formLabelEmail: "Ваш email",
    formLabelCountry: "Страна",
    formSubmit: "Заказать звонок",
    formConsentPre: "Я прочитал(а) и принимаю ",
    formConsentLink: "политику конфиденциальности",
    formConsentPost: ".",
    formPolicyHref: "/ru/politika-privatnosti",
    formSuccess: "Спасибо — ваша заявка получена. Консультант свяжется с вами, обычно в тот же день.",
    formError: "Не удалось отправить заявку. Попробуйте ещё раз или напишите на office@cyprusvipestates.com либо позвоните: +357 99 278 285.",
    vName: "Имя обязательно",
    vSurname: "Фамилия обязательна",
    vPhone: "Телефон обязателен",
    vEmail: "Email обязателен",
    vEmailInvalid: "Неверный формат email",
    vCountry: "Страна обязательна",
    vConsent: "Требуется согласие",
  },
  he: EN, // decision J: Partners page stays English for he
};

export function partnersCopy(lang: string): PartnersCopy {
  return PARTNERS_COPY[lang as Locale] ?? PARTNERS_COPY.en;
}
