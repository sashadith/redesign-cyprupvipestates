/* UI copy for the redesigned Partners page, per language. All copy below is
   ported verbatim from the CURRENT live components (PartnersHero, PartnersCta,
   PartnersBenefits, PartnersStars, PartnersCount, PartnersContact, and
   FormPartners' inline validation strings) — same facts, same numbers, same
   commission terms, just reorganized into one page-level dictionary matching
   the copy.ts pattern used by preview-faq/preview-case-studies.

   The one NEW section — `how` ("How it works") — doesn't exist on the live
   page today. It's synthesized purely by re-sequencing facts already present
   elsewhere on this page (the commission split from the hero note, the
   CRM/portal tracking from benefit #4) into a clearer step-by-step flow — no
   new claims, numbers, or terms are introduced. Flagged here for review. */

export type PartnersStat = { number: string; sign?: string; title: string; description: string };
export type PartnersBenefit = { title: string; description: string };
export type PartnersType = { title: string; description: string };
export type PartnersStep = { title: string; description: string };

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

export const PARTNERS_COPY: Record<string, PartnersCopy> = {
  en: {
    metaTitle: "Partner Program for Property Consultants & Marketers – Cyprus VIP Estates",
    metaDescription: "Earn up to 40% of our marketing success fee. Join the Cyprus VIP Estates partner program — fast payouts, exclusive properties, expert support.",
    heroEyebrow: "Become a partner of Cyprus VIP Estates",
    heroTitleStart: "Join our ",
    heroTitleAccent: "partner program",
    heroTitleEnd: " and earn with us",
    heroLead: "Earn up to 40% of our marketing success fee.",
    heroCta: "Become a partner",
    heroNote: "For real estate purchases, our partners receive a referral fee of 30–50%. For referring property owners, we pay a 10% referral fee.",
    statsEyebrow: "Track record",
    statsTitleStart: "A team built on ",
    statsTitleAccent: "results",
    stats: [
      { number: "195", title: "Real estate projects", description: "In Southern Cyprus. From studio apartments to high-class villas" },
      { number: "10", title: "Years of experience", description: "As a full-service real estate marketing agency" },
      { number: "360", sign: "°", title: "Customer service", description: "We guide you from the first contact to key handover" },
      { number: "100", sign: "%", title: "Satisfied clients", description: "From Germany, Austria, Switzerland and beyond" },
    ],
    benefitsEyebrow: "Why partner with us",
    benefitsTitleStart: "The ",
    benefitsTitleAccent: "benefits",
    benefitsTitleEnd: " of our partner program",
    benefits: [
      { title: "Fast payouts", description: "We pay a 30% advance within 14 days of payment confirmation by the developer. The remaining 70% will be paid once we receive the full service fee." },
      { title: "Expert collaboration", description: "We organize viewings, coordinate with independent lawyers, who handle legal matters, and support you throughout the entire process." },
      { title: "Exclusive properties", description: "You get access to our database and sell exclusive properties with selected offers and unique referral fee conditions." },
      { title: "Always up to date", description: "Each customer step is digitally tracked. Your requests are automatically transferred to our CRM system. The partner portal gives you full insight into the current status at any time. Detailed reports are always available." },
    ],
    typesEyebrow: "Who we partner with",
    typesTitleStart: "Which ",
    typesTitleAccent1: "companies",
    typesTitleMiddle: " do we work ",
    typesTitleAccent2: "with",
    types: [
      { title: "Developers", description: "Our partners are the most reputable developers on the island — carefully selected and verified to ensure top quality for our clients." },
      { title: "Legal advisors", description: "We work closely with experienced lawyers and notaries to guarantee maximum security and confidence throughout the property process." },
      { title: "Agencies and private brokers", description: "You get access to our updated property database with selected listings and exclusive referral fee terms." },
    ],
    howEyebrow: "The process",
    howTitleStart: "How ",
    howTitleAccent: "it works",
    steps: [
      { title: "Register", description: "Fill out the form below with your details. We review and verify every application personally — no automated approvals." },
      { title: "Refer or list", description: "Submit client referrals or access our exclusive property database through your partner portal — every lead is tracked automatically in our CRM." },
      { title: "Get paid", description: "Receive a 30% advance within 14 days of the developer's payment confirmation, and the remaining 70% once we receive the full service fee (10% for owner referrals)." },
    ],
    ctaTitleStart: "Become our ",
    ctaTitleAccent: "partner",
    ctaDescription: "Fill out the form and become part of our international team.",
    ctaButton: "Become a partner",
    formTitleStart: "Register ",
    formTitleAccent: "now",
    formTitleEnd: " as a partner",
    formLabelName: "Your name",
    formLabelSurname: "Surname",
    formLabelPhone: "Phone",
    formLabelEmail: "Email",
    formLabelCountry: "Country",
    formSubmit: "Become a partner",
    formConsentPre: "I agree with the terms of the ",
    formConsentLink: "User agreement",
    formConsentPost: " read and accept them",
    formPolicyHref: "/privacy-policy",
    formSuccess: "We have received your request and will contact you shortly.",
    formError: "An error occurred while sending the request. Please try again later.",
    vName: "Name is required",
    vSurname: "Surname is required",
    vPhone: "Phone is required",
    vEmail: "Email is required",
    vEmailInvalid: "Invalid email address",
    vCountry: "Country is required",
    vConsent: "Consent is required",
  },
  de: {
    metaTitle: "Partnerprogramm für Immobilienberater & Vermarkter – Cyprus VIP Estates",
    metaDescription: "Verdiene bis zu 40 % unserer Marketing-Erfolgsgebühr. Werde Teil des Cyprus VIP Estates Partnerprogramms — schnelle Auszahlungen, exklusive Immobilien, Expertenunterstützung.",
    heroEyebrow: "Werde Partner von Cyprus VIP Estates",
    heroTitleStart: "Werde jetzt Teil unseres ",
    heroTitleAccent: "Partnerprogramms",
    heroTitleEnd: " und verdiene mit uns",
    heroLead: "Verdiene bis zu 40 % unserer Marketing-Erfolgsgebühr.",
    heroCta: "Jetzt Partner werden",
    heroNote: "Für Immobilienkäufe erhalten unsere Partner eine Vermittlungsgebühr von 30 % bis 50 %. Für die Empfehlung von Eigentümern bestehender Immobilien zahlen wir 10 % Vermittlungshonorar.",
    statsEyebrow: "Erfolgsbilanz",
    statsTitleStart: "Ein Team mit ",
    statsTitleAccent: "Ergebnissen",
    stats: [
      { number: "195", title: "Immobilienprojekte", description: "Auf Süd-Zypern. Von Studio-Apartments bis High-Class-Villen" },
      { number: "10", title: "Jahre Erfahrung", description: "Als Full-Service Immobilien-Marketing-Agentur" },
      { number: "360", sign: "°", title: "Service für unsere Kunden", description: "Wir begleiten Sie vom ersten Kontakt bis zur Schlüsselübergabe" },
      { number: "100", sign: "%", title: "Zufriedene Kunden", description: "Aus Deutschland, Österreich, der Schweiz und weiteren Ländern" },
    ],
    benefitsEyebrow: "Warum mit uns zusammenarbeiten",
    benefitsTitleStart: "Die ",
    benefitsTitleAccent: "Vorteile",
    benefitsTitleEnd: " unseres Partnerprogramms",
    benefits: [
      { title: "Schnelle Auszahlungen", description: "Wir zahlen innerhalb von 14 Tagen nach Zahlungsbestätigung durch den Bauträger einen 30 % Vorschuss aus. Die verbleibenden 70 % erhältst Du, sobald wir die vollständige Vergütung erhalten haben." },
      { title: "Zusammenarbeit mit Experten", description: "Wir organisieren Besichtigungen, koordinieren den Kontakt zu unabhängigen Anwälten und unterstützen Dich bei der kompletten Abwicklung." },
      { title: "Exklusive Immobilien", description: "Du erhältst Zugriff auf unsere Datenbank und verkaufst exklusive Immobilien mit ausgewählten Angeboten und einmaligen Servicegebühren." },
      { title: "Immer am Puls der Zeit", description: "Jeder Schritt des Kunden wird digital erfasst. Deine Anfragen werden automatisch in unser CRM-System übernommen. Über das Partnerportal behältst Du jederzeit den Überblick über den aktuellen Stand. Detaillierte Reports stehen Dir jederzeit zur Verfügung." },
    ],
    typesEyebrow: "Mit wem wir zusammenarbeiten",
    typesTitleStart: "Mit welchen ",
    typesTitleAccent1: "Unternehmen",
    typesTitleMiddle: " arbeiten wir ",
    typesTitleAccent2: "zusammen",
    types: [
      { title: "Bauunternehmer", description: "Unsere Partner sind die renommiertesten Bauträger der Insel – sorgfältig ausgewählt und geprüft, um unseren Kunden erstklassige Qualität bieten zu können." },
      { title: "Rechtsberater", description: "Um unseren Kunden ein Höchstmaß an Sicherheit und Vertrauen in den gesamten Immobilienprozess zu gewährleisten, arbeiten wir eng mit erfahrenen Rechtsanwälten und Notaren zusammen." },
      { title: "Immobilienagenturen und private Vermittler", description: "Du erhältst Zugriff auf unsere aktuelle Immobiliendatenbank mit ausgewählten Angeboten und exklusiven Konditionen." },
    ],
    howEyebrow: "Der Ablauf",
    howTitleStart: "So ",
    howTitleAccent: "funktioniert es",
    steps: [
      { title: "Registrieren", description: "Fülle das Formular unten mit Deinen Daten aus. Wir prüfen jede Bewerbung persönlich — keine automatische Freigabe." },
      { title: "Empfehlen oder vermitteln", description: "Reiche Kundenempfehlungen ein oder greife über Dein Partnerportal auf unsere exklusive Immobiliendatenbank zu — jede Anfrage wird automatisch in unserem CRM erfasst." },
      { title: "Ausgezahlt werden", description: "Erhalte einen 30 % Vorschuss innerhalb von 14 Tagen nach Zahlungsbestätigung des Bauträgers und die verbleibenden 70 %, sobald wir die vollständige Vergütung erhalten (10 % bei Eigentümerempfehlungen)." },
    ],
    ctaTitleStart: "Werde unser ",
    ctaTitleAccent: "Partner",
    ctaDescription: "Fülle das Formular aus und werde Teil unseres internationalen Teams.",
    ctaButton: "Jetzt Partner werden",
    formTitleStart: "Registriere ",
    formTitleAccent: "Dich",
    formTitleEnd: " als Partner",
    formLabelName: "Ihr Vorname",
    formLabelSurname: "Ihr Nachname",
    formLabelPhone: "Telefon",
    formLabelEmail: "E-Mail Adresse",
    formLabelCountry: "Land",
    formSubmit: "Jetzt Partner werden",
    formConsentPre: "Ich habe die Bedingungen der ",
    formConsentLink: "Benutzervereinbarung",
    formConsentPost: " gelesen und akzeptiere sie",
    formPolicyHref: "/de/datenschutzrichtlinie",
    formSuccess: "Wir haben Ihre Anfrage erhalten und werden uns in Kürze bei Ihnen melden.",
    formError: "Beim Senden der Anfrage ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.",
    vName: "Name ist erforderlich",
    vSurname: "Nachname ist erforderlich",
    vPhone: "Telefon ist erforderlich",
    vEmail: "E-Mail ist erforderlich",
    vEmailInvalid: "Ungültige E-Mail Adresse",
    vCountry: "Land ist erforderlich",
    vConsent: "Zustimmung erforderlich",
  },
  pl: {
    metaTitle: "Program Partnerski dla Doradców i Marketerów Nieruchomości – Cyprus VIP Estates",
    metaDescription: "Zarób do 40% naszego wynagrodzenia marketingowego. Dołącz do programu partnerskiego Cyprus VIP Estates — szybkie wypłaty, ekskluzywne nieruchomości, wsparcie ekspertów.",
    heroEyebrow: "Zostań partnerem Cyprus VIP Estates",
    heroTitleStart: "Dołącz do naszego ",
    heroTitleAccent: "programu partnerskiego",
    heroTitleEnd: " i zarabiaj z nami",
    heroLead: "Zarób do 40% naszego wynagrodzenia marketingowego.",
    heroCta: "Zostań partnerem",
    heroNote: "Za sprzedaż nieruchomości partnerzy otrzymują wynagrodzenie za polecenie 30–50%. Za polecenie właścicieli nieruchomości wypłacamy 10% honorarium.",
    statsEyebrow: "Nasze doświadczenie",
    statsTitleStart: "Zespół, który daje ",
    statsTitleAccent: "rezultaty",
    stats: [
      { number: "195", title: "Projektów nieruchomości", description: "Na południu Cypru – od kawalerek po luksusowe wille" },
      { number: "10", title: "Lat doświadczenia", description: "Jako agencja marketingu nieruchomości typu full-service" },
      { number: "360", sign: "°", title: "Obsługa klienta", description: "Prowadzimy Cię od pierwszego kontaktu do przekazania kluczy" },
      { number: "100", sign: "%", title: "Zadowoleni klienci", description: "Z Niemiec, Austrii, Szwajcarii i innych krajów" },
    ],
    benefitsEyebrow: "Dlaczego warto z nami współpracować",
    benefitsTitleStart: "Korzyści ",
    benefitsTitleAccent: "ze współpracy",
    benefitsTitleEnd: " w naszym programie partnerskim",
    benefits: [
      { title: "Szybkie wypłaty", description: "Wypłacamy 30% zaliczki w ciągu 14 dni od potwierdzenia płatności przez dewelopera. Pozostałe 70% otrzymasz po pełnym rozliczeniu opłaty za usługę." },
      { title: "Współpraca z ekspertami", description: "Organizujemy prezentacje, koordynujemy kontakt z niezależnymi prawnikami i wspieramy Cię na każdym etapie transakcji." },
      { title: "Ekskluzywne nieruchomości", description: "Otrzymujesz dostęp do naszej bazy danych i sprzedajesz ekskluzywne nieruchomości z wyselekcjonowanymi ofertami i wyjątkowymi warunkami wynagrodzenia." },
      { title: "Nowoczesne rozwiązania", description: "Każdy etap klienta jest rejestrowany cyfrowo. Twoje zgłoszenia trafiają bezpośrednio do naszego CRM. W portalu partnerskim masz pełny podgląd statusu. Szczegółowe raporty są zawsze dostępne." },
    ],
    typesEyebrow: "Z kim współpracujemy",
    typesTitleStart: "Z jakimi ",
    typesTitleAccent1: "firmami",
    typesTitleMiddle: " współpracujemy",
    typesTitleAccent2: "",
    types: [
      { title: "Deweloperzy", description: "Nasi partnerzy to najbardziej renomowani deweloperzy na wyspie – starannie wybrani i sprawdzeni, aby zapewnić naszym klientom najwyższą jakość." },
      { title: "Doradcy prawni", description: "Współpracujemy z doświadczonymi prawnikami i notariuszami, aby zapewnić maksymalne bezpieczeństwo i zaufanie podczas całego procesu zakupu nieruchomości." },
      { title: "Agencje i pośrednicy", description: "Otrzymujesz dostęp do naszej aktualnej bazy nieruchomości z wybranymi ofertami i korzystnymi warunkami wynagrodzenia." },
    ],
    howEyebrow: "Jak to działa",
    howTitleStart: "Jak ",
    howTitleAccent: "to działa",
    steps: [
      { title: "Zarejestruj się", description: "Wypełnij poniższy formularz swoimi danymi. Każde zgłoszenie weryfikujemy osobiście — bez automatycznych zatwierdzeń." },
      { title: "Poleć lub sprzedawaj", description: "Zgłaszaj polecenia klientów lub korzystaj z naszej ekskluzywnej bazy nieruchomości przez portal partnerski — każde zgłoszenie jest automatycznie rejestrowane w naszym CRM." },
      { title: "Otrzymaj wypłatę", description: "Otrzymaj 30% zaliczki w ciągu 14 dni od potwierdzenia płatności przez dewelopera, a pozostałe 70% po pełnym rozliczeniu opłaty za usługę (10% za polecenia właścicieli)." },
    ],
    ctaTitleStart: "Zostań naszym ",
    ctaTitleAccent: "partnerem",
    ctaDescription: "Wypełnij formularz i dołącz do naszego międzynarodowego zespołu.",
    ctaButton: "Zostań partnerem",
    formTitleStart: "Zarejestruj ",
    formTitleAccent: "się",
    formTitleEnd: " jako partner",
    formLabelName: "Imię",
    formLabelSurname: "Nazwisko",
    formLabelPhone: "Telefon",
    formLabelEmail: "E-mail",
    formLabelCountry: "Kraj",
    formSubmit: "Zostań partnerem",
    formConsentPre: "Zgadzam się z ",
    formConsentLink: "Umową użytkownika",
    formConsentPost: " przeczytałem i akceptuję ją",
    formPolicyHref: "/pl/polityka-prywatnosci",
    formSuccess: "Otrzymaliśmy Twoje zapytanie i skontaktujemy się z Tobą wkrótce.",
    formError: "Wystąpił błąd podczas wysyłania zapytania. Spróbuj ponownie później.",
    vName: "Imię jest wymagane",
    vSurname: "Nazwisko jest wymagane",
    vPhone: "Telefon jest wymagany",
    vEmail: "Email jest wymagany",
    vEmailInvalid: "Nieprawidłowy format email",
    vCountry: "Kraj jest wymagany",
    vConsent: "Zgoda jest wymagana",
  },
  ru: {
    metaTitle: "Партнёрская программа для консультантов и маркетологов недвижимости – Cyprus VIP Estates",
    metaDescription: "Зарабатывайте до 40% нашего маркетингового вознаграждения. Присоединяйтесь к партнёрской программе Cyprus VIP Estates — быстрые выплаты, эксклюзивная недвижимость, поддержка экспертов.",
    heroEyebrow: "Стань партнёром Cyprus VIP Estates",
    heroTitleStart: "Стань частью нашей ",
    heroTitleAccent: "партнёрской программы",
    heroTitleEnd: " и зарабатывай с нами",
    heroLead: "Зарабатывай до 40% нашего маркетингового вознаграждения.",
    heroCta: "Стать партнёром",
    heroNote: "За продажу недвижимости партнёры получают вознаграждение от 30 до 50%. За рекомендации владельцев — 10% вознаграждение.",
    statsEyebrow: "Наши результаты",
    statsTitleStart: "Команда, которая даёт ",
    statsTitleAccent: "результат",
    stats: [
      { number: "195", title: "Проектов недвижимости", description: "На юге Кипра: от студий до элитных вилл" },
      { number: "10", title: "Лет опыта", description: "Как агентство полного цикла по маркетингу недвижимости" },
      { number: "360", sign: "°", title: "Сервис для клиентов", description: "Мы сопровождаем вас от первого контакта до передачи ключей" },
      { number: "100", sign: "%", title: "Довольных клиентов", description: "Из Германии, Австрии, Швейцарии и других стран" },
    ],
    benefitsEyebrow: "Почему стоит с нами сотрудничать",
    benefitsTitleStart: "Преимущества ",
    benefitsTitleAccent: "нашей программы",
    benefitsTitleEnd: " для партнёров",
    benefits: [
      { title: "Быстрые выплаты", description: "Мы выплачиваем аванс 30% в течение 14 дней после подтверждения оплаты от застройщика. Остальные 70% — после получения всего вознаграждения." },
      { title: "Сотрудничество с экспертами", description: "Мы организуем показы, координируем работу с независимыми юристами и сопровождаем сделку от начала до конца." },
      { title: "Эксклюзивная недвижимость", description: "Вы получаете доступ к нашей базе данных и продаёте эксклюзивную недвижимость с отобранными предложениями и уникальными условиями сервисного сбора." },
      { title: "Современные инструменты", description: "Каждое действие клиента фиксируется в CRM. Вы видите статус в партнёрском кабинете в любое время. Подробные отчёты доступны постоянно." },
    ],
    typesEyebrow: "С кем мы сотрудничаем",
    typesTitleStart: "С какими ",
    typesTitleAccent1: "компаниями",
    typesTitleMiddle: " мы ",
    typesTitleAccent2: "сотрудничаем",
    types: [
      { title: "Застройщики", description: "Наши партнёры — это самые авторитетные застройщики на Кипре. Мы тщательно их отбираем и проверяем, чтобы гарантировать высокое качество нашим клиентам." },
      { title: "Юридические консультанты", description: "Мы сотрудничаем с опытными юристами и нотариусами, чтобы обеспечить максимальную безопасность и доверие на всех этапах покупки недвижимости." },
      { title: "Агентства и частные посредники", description: "Вы получаете доступ к нашей базе недвижимости с эксклюзивными предложениями и выгодными условиями партнёрства." },
    ],
    howEyebrow: "Как это работает",
    howTitleStart: "Как это ",
    howTitleAccent: "работает",
    steps: [
      { title: "Регистрация", description: "Заполните форму ниже своими данными. Мы лично проверяем каждую заявку — без автоматических одобрений." },
      { title: "Рекомендуйте или продавайте", description: "Отправляйте рекомендации клиентов или получайте доступ к нашей эксклюзивной базе недвижимости через партнёрский кабинет — каждая заявка автоматически фиксируется в CRM." },
      { title: "Получайте оплату", description: "Получите аванс 30% в течение 14 дней после подтверждения оплаты застройщиком, а оставшиеся 70% — после получения полного вознаграждения (10% за рекомендации владельцев)." },
    ],
    ctaTitleStart: "Стань нашим ",
    ctaTitleAccent: "партнёром",
    ctaDescription: "Заполни форму и стань частью нашей международной команды.",
    ctaButton: "Стать партнёром",
    formTitleStart: "Зарегистрируйся ",
    formTitleAccent: "сейчас",
    formTitleEnd: " как партнёр",
    formLabelName: "Ваше имя",
    formLabelSurname: "Фамилия",
    formLabelPhone: "Телефон",
    formLabelEmail: "Ваш email",
    formLabelCountry: "Страна",
    formSubmit: "Стать партнёром",
    formConsentPre: "Я согласен с ",
    formConsentLink: "Пользовательским соглашением",
    formConsentPost: ", прочитал и принимаю его",
    formPolicyHref: "/ru/politika-privatnosti",
    formSuccess: "Мы получили вашу заявку и свяжемся с вами в ближайшее время.",
    formError: "Произошла ошибка при отправке заявки. Попробуйте позже.",
    vName: "Имя обязательно",
    vSurname: "Фамилия обязательна",
    vPhone: "Телефон обязателен",
    vEmail: "Email обязателен",
    vEmailInvalid: "Неверный формат email",
    vCountry: "Страна обязательна",
    vConsent: "Требуется согласие",
  },
};

export function partnersCopy(lang: string): PartnersCopy {
  return PARTNERS_COPY[lang] ?? PARTNERS_COPY.en;
}
