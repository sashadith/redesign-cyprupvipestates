/* About — four-locale copy for the redesigned page.

   Source: the live singlepages rows (about-us / ueber-uns / o-nas / o-nas),
   CONDENSED per the 2026-08-21 content decision — the old page said the same
   thing three times ("Why Choose Us", "Our Mission", "Core Values" all
   restated the mission), carried ten testimonials that duplicate the Client
   Stories page, and split "why/how/what" across three near-identical
   image+text blocks. Here: one stance section, one values row, the
   how/what pillars kept (they carry real information), stats and team
   unchanged.

   Translations are the site's OWN existing text, not re-translated — except
   where the stored copy was visibly machine-broken and had to be repaired:
     - ru: "остров Саншайн" (Sunshine left untranslated), "свойства" used for
       real estate (means "attributes"), "Наше четвертое знание кистрических
       регионов" (nonsense), "Мы сталкиваемся с самым высоким качеством"
       ("we collide with quality"), "переход на Кипр" ("transition" for "move")
     - de: "…damit Sie sich sofort zuhause fühle" (truncated verb)
     - pl: "…w historię sukces" (truncated noun)
   Each of those is fixed below; the stored rows still contain the originals. */

export type AboutStrings = {
  metaTitle: string;
  metaDescription: string;
  heroEyebrow: string;
  /** Split so the middle word can carry the .it gold-shimmer accent. */
  heroTitle: [string, string, string];
  heroLead: string;
  heroCta: string;
  heroScroll: string;

  stanceEyebrow: string;
  stanceTitle: string;
  stanceBody: string[];

  heroImageAlt: string;

  statsEyebrow: string;
  statsTitle: string;
  /** `live: "projects"` swaps the hard-coded number for the DB count at render time. */
  stats: { number: number; sign?: string; live?: "projects"; title: string; description: string }[];

  workEyebrow: string;
  workTitle: string;
  work: { title: string; description: string }[];

  receiveEyebrow: string;
  receiveTitle: string;
  receive: { title: string; description: string }[];

  valuesEyebrow: string;
  valuesTitle: string;
  values: { title: string; description: string }[];

  teamEyebrow: string;
  teamTitle: string;
  teamLead: string;
  teamSpeaks: string;
  teamContact: string;

  storiesEyebrow: string;
  storiesTitle: string;
  storiesLead: string;
  storiesAll: string;

  ctaTitle: string;
  ctaLead: string;
  /* Labels for the shared ContactChannels block that closes the page — same
     wording as the Contacts page's own direct-lines section. */
  channelWhatsapp: string;
  channelPhone: string;
  channelEmail: string;
  channelHint: { whatsapp: string; phone: string; email: string };
};

const EN: AboutStrings = {
  metaTitle: "About Us — Cyprus VIP Estates",
  metaDescription:
    "Who we are, how we work, and the team behind Cyprus VIP Estates — a full-service real estate marketing and consulting agency in Paphos, Cyprus.",
  heroEyebrow: "About Cyprus VIP Estates",
  heroTitle: ["A bridge to a new life under the ", "Mediterranean", " sky"],
  heroLead:
    "We connect people with their dream home on the island of sunshine — not just as a property consultancy, but as the partner who stays with you from the first conversation to the day you get the keys.",
  heroCta: "Meet the team",
  heroImageAlt: "Limassol seafront at night, Cyprus",
  heroScroll: "Scroll",

  stanceEyebrow: "What drives us",
  stanceTitle: "Moving to Cyprus is more than buying property",
  stanceBody: [
    "It is a step toward a self-determined, enjoyable life — and we put our whole heart into it.",
    "Our mission is to help people find their ideal home under the Cypriot sun, with personal advice, absolute transparency, and a tireless commitment to the highest quality standards.",
    "We combine deep local market knowledge with digital tools, so the entire process stays simple, secure and genuinely pleasant.",
  ],

  statsEyebrow: "In numbers",
  statsTitle: "Ten years on the ground",
  stats: [
    { number: 195, live: "projects", title: "Real estate projects", description: "In southern Cyprus. From studio apartments to high-class villas" },
    { number: 10, title: "Years of experience", description: "As a full-service real estate marketing agency" },
    { number: 360, sign: "°", title: "Service for our clients", description: "From the first contact to the handover of the keys" },
    { number: 100, sign: "%", title: "Satisfied clients", description: "From Germany, Austria, Switzerland and beyond" },
  ],

  workEyebrow: "How we work",
  workTitle: "Three things we never delegate",
  work: [
    { title: "Personal on-site consultation", description: "We listen carefully to understand your needs, wishes and life goals — then find properties that actually fit them." },
    { title: "Market and legal expertise", description: "Decades of experience and close cooperation with Cypriot authorities let us navigate negotiations and approval procedures with confidence." },
    { title: "Digitally supported processes", description: "From AI-assisted analysis to online document review, we pair modern tools with personal service for maximum transparency." },
  ],

  receiveEyebrow: "What you receive",
  receiveTitle: "One partner, start to finish",
  receive: [
    { title: "A curated selection", description: "You only see properties that meet our quality and return standards — not everything on the market." },
    { title: "Full-service support", description: "Viewings, financing, legal advice, the notary appointment: one point of contact for all of it." },
    { title: "After-sales support", description: "Moving-in service, property management and vetted local providers, so you feel at home immediately." },
  ],

  valuesEyebrow: "Core values",
  valuesTitle: "What guides our actions",
  values: [
    { title: "Integrity & transparency", description: "Open communication, and every agreement documented in writing." },
    { title: "Client focus", description: "Individual attention — the only way to meet personal wishes and build lasting trust." },
    { title: "Local expertise", description: "Deep knowledge of Cypriot regions, laws and culture behind every decision." },
    { title: "Excellence & professionalism", description: "Highest service quality, continuous training, a flawless presence offline and online." },
    { title: "Sustainability & responsibility", description: "Environmental aspects in every project, and partners with fair labour and building practices." },
    { title: "Innovation & efficiency", description: "Modern technology — AI tools, digital document management — to optimise processes and save your time." },
  ],

  teamEyebrow: "The people",
  teamTitle: "Who you will be working with",
  teamLead:
    "A team spanning six languages and four countries. Whoever picks up the phone, you are talking to someone who lives here.",
  teamSpeaks: "Speaks",
  teamContact: "Get in touch",

  storiesEyebrow: "Client stories",
  storiesTitle: "What our clients say",
  storiesLead: "A few words from people who have already made the move.",
  storiesAll: "Read all client stories",

  ctaTitle: "Let's talk about your plans",
  ctaLead: "Tell us what you are looking for — we will come back to you personally, usually the same day.",
  channelWhatsapp: "WhatsApp",
  channelPhone: "Phone",
  channelEmail: "Email",
  channelHint: {
    whatsapp: "Fastest reply, usually within minutes",
    phone: "Call us directly during office hours",
    email: "For detailed enquiries and documents",
  },
};

const DE: AboutStrings = {
  metaTitle: "Über uns — Cyprus VIP Estates",
  metaDescription:
    "Wer wir sind, wie wir arbeiten und das Team hinter Cyprus VIP Estates — Full-Service-Immobilienmarketing- und Beratungsagentur in Paphos, Zypern.",
  heroEyebrow: "Über Cyprus VIP Estates",
  heroTitle: ["Eine Brücke zu einem neuen Leben unter ", "mediterranem", " Himmel"],
  heroLead:
    "Wir verbinden Menschen mit ihrem Traumhaus auf der Insel der Sonne — nicht nur als Immobilienberatung, sondern als Partner, der vom ersten Gespräch bis zur Schlüsselübergabe an Ihrer Seite bleibt.",
  heroCta: "Das Team kennenlernen",
  heroImageAlt: "Die Uferpromenade von Limassol bei Nacht, Zypern",
  heroScroll: "Scrollen",

  stanceEyebrow: "Was uns antreibt",
  stanceTitle: "Ein Umzug nach Zypern ist mehr als ein Immobilienkauf",
  stanceBody: [
    "Er ist ein Schritt in ein selbstbestimmtes, genussvolles Leben — dafür setzen wir unser ganzes Herzblut ein.",
    "Unsere Mission ist es, Menschen dabei zu unterstützen, ihr ideales Zuhause unter der zyprischen Sonne zu finden: mit persönlicher Beratung, absoluter Transparenz und einem unermüdlichen Einsatz für höchste Qualitätsstandards.",
    "Dabei verbinden wir tiefe lokale Marktkenntnis mit digitalen Werkzeugen, damit der gesamte Prozess einfach, sicher und wirklich angenehm bleibt.",
  ],

  statsEyebrow: "In Zahlen",
  statsTitle: "Zehn Jahre vor Ort",
  stats: [
    { number: 195, live: "projects", title: "Immobilienprojekte", description: "Auf Süd-Zypern. Von Studio-Apartments bis High-Class-Villen" },
    { number: 10, title: "Jahre Erfahrung", description: "Als Full-Service-Immobilien-Marketing-Agentur" },
    { number: 360, sign: "°", title: "Service für unsere Kunden", description: "Vom ersten Kontakt bis zur Schlüsselübergabe" },
    { number: 100, sign: "%", title: "Zufriedene Kunden", description: "Aus Deutschland, Österreich, der Schweiz und weiteren Ländern" },
  ],

  workEyebrow: "Wie wir arbeiten",
  workTitle: "Drei Dinge, die wir nie abgeben",
  work: [
    { title: "Persönliche Vor-Ort-Beratung", description: "Wir hören genau zu, um Ihre Bedürfnisse, Wünsche und Lebensziele zu verstehen — und finden Objekte, die wirklich dazu passen." },
    { title: "Markt- und Rechts-Expertise", description: "Jahrzehntelange Erfahrung und enge Kooperation mit zyprischen Behörden lassen uns sicher durch Verhandlungen und Genehmigungsverfahren navigieren." },
    { title: "Digital gestützte Prozesse", description: "Von KI-Analysen bis zur Online-Dokumentenprüfung: moderne Werkzeuge kombiniert mit persönlichem Service für maximale Transparenz." },
  ],

  receiveEyebrow: "Was Sie erhalten",
  receiveTitle: "Ein Ansprechpartner, von Anfang bis Ende",
  receive: [
    { title: "Eine kuratierte Auswahl", description: "Sie sehen nur Immobilien, die unseren Qualitäts- und Renditeansprüchen genügen — nicht alles, was der Markt hergibt." },
    { title: "Full-Service-Begleitung", description: "Besichtigung, Finanzierung, Rechtsberatung, Notartermin: für all das ein einziger Ansprechpartner." },
    { title: "After-Sales-Support", description: "Einzugsservice, Immobilienverwaltung und geprüfte lokale Dienstleister, damit Sie sich sofort zuhause fühlen." },
  ],

  valuesEyebrow: "Grundwerte",
  valuesTitle: "Was unser Handeln leitet",
  values: [
    { title: "Integrität & Transparenz", description: "Offene Kommunikation, und jede Absprache schriftlich festgehalten." },
    { title: "Kundenfokus", description: "Individuelle Betreuung — nur so erfüllen wir persönliche Wünsche und schaffen dauerhaftes Vertrauen." },
    { title: "Lokale Expertise", description: "Tiefe Kenntnis zyprischer Regionen, Gesetze und Kultur hinter jeder Entscheidung." },
    { title: "Exzellenz & Professionalität", description: "Höchste Servicequalität, kontinuierliche Weiterbildung, ein makelloser Auftritt offline wie online." },
    { title: "Nachhaltigkeit & Verantwortung", description: "Umweltaspekte in jedem Projekt, und Partner mit fairen Arbeits- und Baupraktiken." },
    { title: "Innovation & Effizienz", description: "Moderne Technologie — KI-Werkzeuge, digitale Dokumentenverwaltung — für optimierte Abläufe und Ihre Zeitersparnis." },
  ],

  teamEyebrow: "Die Menschen",
  teamTitle: "Mit wem Sie arbeiten werden",
  teamLead:
    "Ein Team mit sechs Sprachen und vier Herkunftsländern. Wer auch immer abhebt — Sie sprechen mit jemandem, der hier lebt.",
  teamSpeaks: "Spricht",
  teamContact: "Kontakt aufnehmen",

  storiesEyebrow: "Kundenstimmen",
  storiesTitle: "Was unsere Kunden sagen",
  storiesLead: "Ein paar Worte von Menschen, die den Schritt bereits gegangen sind.",
  storiesAll: "Alle Kundengeschichten lesen",

  ctaTitle: "Sprechen wir über Ihre Pläne",
  ctaLead: "Sagen Sie uns, wonach Sie suchen — wir melden uns persönlich zurück, meist noch am selben Tag.",
  channelWhatsapp: "WhatsApp",
  channelPhone: "Telefon",
  channelEmail: "E-Mail",
  channelHint: {
    whatsapp: "Schnellste Antwort, meist innerhalb von Minuten",
    phone: "Rufen Sie uns während der Bürozeiten direkt an",
    email: "Für ausführliche Anfragen und Unterlagen",
  },
};

const PL: AboutStrings = {
  metaTitle: "O nas — Cyprus VIP Estates",
  metaDescription:
    "Kim jesteśmy, jak pracujemy i zespół stojący za Cyprus VIP Estates — agencja marketingu i doradztwa nieruchomości w Pafos na Cyprze.",
  heroEyebrow: "O Cyprus VIP Estates",
  heroTitle: ["Pomost do nowego życia pod ", "śródziemnomorskim", " niebem"],
  heroLead:
    "Łączymy ludzi z ich wymarzonym domem na słonecznej wyspie — nie tylko jako doradztwo w zakresie nieruchomości, ale jako partner, który towarzyszy Ci od pierwszej rozmowy aż po dzień odbioru kluczy.",
  heroCta: "Poznaj zespół",
  heroImageAlt: "Nadmorska promenada Limassol nocą, Cypr",
  heroScroll: "Przewiń",

  stanceEyebrow: "Co nas napędza",
  stanceTitle: "Przeprowadzka na Cypr to coś więcej niż zakup nieruchomości",
  stanceBody: [
    "To krok w stronę samodzielnego, przyjemnego życia — i wkładamy w to całe serce.",
    "Naszą misją jest pomoc w znalezieniu idealnego domu pod cypryjskim słońcem: z osobistym doradztwem, absolutną przejrzystością i niestrudzonym zaangażowaniem w najwyższe standardy jakości.",
    "Łączymy dogłębną znajomość lokalnego rynku z narzędziami cyfrowymi, aby cały proces pozostał prosty, bezpieczny i naprawdę przyjemny.",
  ],

  statsEyebrow: "W liczbach",
  statsTitle: "Dziesięć lat na miejscu",
  stats: [
    { number: 195, live: "projects", title: "Projektów nieruchomości", description: "Na południu Cypru. Od apartamentów studio po luksusowe wille" },
    { number: 10, title: "Lat doświadczenia", description: "Jako agencja kompleksowego marketingu nieruchomości" },
    { number: 360, sign: "°", title: "Obsługa naszych klientów", description: "Od pierwszego kontaktu aż do przekazania kluczy" },
    { number: 100, sign: "%", title: "Zadowolonych klientów", description: "Z Niemiec, Austrii, Szwajcarii i innych krajów" },
  ],

  workEyebrow: "Jak pracujemy",
  workTitle: "Trzy rzeczy, których nigdy nie oddajemy",
  work: [
    { title: "Osobiste konsultacje na miejscu", description: "Uważnie słuchamy, aby zrozumieć Twoje potrzeby, życzenia i cele — i znaleźć nieruchomości, które naprawdę do nich pasują." },
    { title: "Wiedza rynkowa i prawna", description: "Dziesięciolecia doświadczenia i ścisła współpraca z władzami Cypru pozwalają nam pewnie prowadzić negocjacje i procedury zatwierdzania." },
    { title: "Procesy wspierane cyfrowo", description: "Od analiz AI po przegląd dokumentów online: nowoczesne narzędzia w połączeniu z osobistą obsługą dla maksymalnej przejrzystości." },
  ],

  receiveEyebrow: "Co otrzymujesz",
  receiveTitle: "Jeden partner, od początku do końca",
  receive: [
    { title: "Wyselekcjonowany wybór", description: "Widzisz tylko nieruchomości spełniające nasze standardy jakości i zwrotu — nie wszystko, co jest na rynku." },
    { title: "Pełne wsparcie", description: "Oglądanie, finansowanie, porady prawne, wizyta u notariusza: jeden punkt kontaktowy dla wszystkiego." },
    { title: "Wsparcie posprzedażowe", description: "Usługa przeprowadzki, zarządzanie nieruchomością i sprawdzeni lokalni dostawcy, abyś od razu poczuł się jak w domu." },
  ],

  valuesEyebrow: "Wartości podstawowe",
  valuesTitle: "Co kieruje naszymi działaniami",
  values: [
    { title: "Uczciwość i przejrzystość", description: "Otwarta komunikacja i każde ustalenie udokumentowane na piśmie." },
    { title: "Skupienie na kliencie", description: "Indywidualna uwaga — tylko tak spełniamy osobiste życzenia i budujemy trwałe zaufanie." },
    { title: "Lokalna wiedza", description: "Dogłębna znajomość cypryjskich regionów, przepisów i kultury za każdą decyzją." },
    { title: "Doskonałość i profesjonalizm", description: "Najwyższa jakość usług, ciągłe szkolenia, nieskazitelna obecność offline i online." },
    { title: "Zrównoważony rozwój i odpowiedzialność", description: "Aspekty środowiskowe w każdym projekcie i partnerzy stosujący uczciwe praktyki pracy i budowy." },
    { title: "Innowacyjność i skuteczność", description: "Nowoczesne technologie — narzędzia AI, cyfrowe zarządzanie dokumentacją — dla lepszych procesów i Twojej oszczędności czasu." },
  ],

  teamEyebrow: "Ludzie",
  teamTitle: "Z kim będziesz pracować",
  teamLead:
    "Zespół mówiący sześcioma językami, z czterech krajów. Ktokolwiek odbierze telefon, rozmawiasz z kimś, kto tu mieszka.",
  teamSpeaks: "Mówi",
  teamContact: "Skontaktuj się",

  storiesEyebrow: "Historie klientów",
  storiesTitle: "Co mówią nasi klienci",
  storiesLead: "Kilka słów od osób, które już zrobiły ten krok.",
  storiesAll: "Przeczytaj wszystkie historie",

  ctaTitle: "Porozmawiajmy o Twoich planach",
  ctaLead: "Powiedz nam, czego szukasz — odezwiemy się osobiście, zwykle jeszcze tego samego dnia.",
  channelWhatsapp: "WhatsApp",
  channelPhone: "Telefon",
  channelEmail: "E-mail",
  channelHint: {
    whatsapp: "Najszybsza odpowiedź, zwykle w ciągu kilku minut",
    phone: "Zadzwoń bezpośrednio w godzinach pracy biura",
    email: "Do szczegółowych zapytań i dokumentów",
  },
};

const RU: AboutStrings = {
  metaTitle: "О нас — Cyprus VIP Estates",
  metaDescription:
    "Кто мы, как мы работаем и команда Cyprus VIP Estates — агентство полного цикла по маркетингу и консалтингу недвижимости в Пафосе, Кипр.",
  heroEyebrow: "О Cyprus VIP Estates",
  heroTitle: ["Мост к новой жизни под ", "средиземноморским", " небом"],
  heroLead:
    "Мы соединяем людей с домом их мечты на солнечном острове — не просто как консультанты по недвижимости, а как партнёр, который остаётся рядом от первого разговора до дня передачи ключей.",
  heroCta: "Познакомиться с командой",
  heroImageAlt: "Набережная Лимассола ночью, Кипр",
  heroScroll: "Прокрутить",

  stanceEyebrow: "Что нас ведёт",
  stanceTitle: "Переезд на Кипр — это больше, чем покупка недвижимости",
  stanceBody: [
    "Это шаг к самостоятельной, наполненной жизни — и мы вкладываем в него всю душу.",
    "Наша миссия — помочь людям найти идеальный дом под кипрским солнцем: с персональными консультациями, абсолютной прозрачностью и неустанной приверженностью высочайшим стандартам качества.",
    "Мы объединяем глубокое знание местного рынка с цифровыми инструментами, чтобы весь процесс оставался простым, безопасным и по-настоящему приятным.",
  ],

  statsEyebrow: "В цифрах",
  statsTitle: "Десять лет на месте",
  stats: [
    { number: 195, live: "projects", title: "Проектов недвижимости", description: "На юге Кипра. От студий до вилл высокого класса" },
    { number: 10, title: "Лет опыта", description: "Как агентство полного цикла маркетинга недвижимости" },
    { number: 360, sign: "°", title: "Спектр услуг для клиентов", description: "От первого контакта до передачи ключей" },
    { number: 100, sign: "%", title: "Довольных клиентов", description: "Из Германии, Австрии, Швейцарии и других стран" },
  ],

  workEyebrow: "Как мы работаем",
  workTitle: "Три вещи, которые мы не передаём никому",
  work: [
    { title: "Личная консультация на месте", description: "Мы внимательно слушаем, чтобы понять ваши потребности, пожелания и жизненные цели — и находим объекты, которые им действительно соответствуют." },
    { title: "Рыночная и юридическая экспертиза", description: "Десятилетия опыта и тесное сотрудничество с кипрскими органами позволяют уверенно вести переговоры и согласования." },
    { title: "Цифровая поддержка процессов", description: "От ИИ-анализа до онлайн-проверки документов: современные инструменты в сочетании с личным сервисом ради максимальной прозрачности." },
  ],

  receiveEyebrow: "Что вы получаете",
  receiveTitle: "Один партнёр от начала до конца",
  receive: [
    { title: "Отобранная подборка", description: "Вы видите только объекты, отвечающие нашим стандартам качества и доходности, — а не всё, что есть на рынке." },
    { title: "Полное сопровождение", description: "Просмотры, финансирование, юридические консультации, визит к нотариусу — единая точка контакта для всего." },
    { title: "Поддержка после покупки", description: "Помощь с переездом, управление недвижимостью и проверенные local-подрядчики, чтобы вы сразу почувствовали себя дома." },
  ],

  valuesEyebrow: "Основные ценности",
  valuesTitle: "Что направляет наши действия",
  values: [
    { title: "Честность и прозрачность", description: "Открытое общение и все договорённости, зафиксированные письменно." },
    { title: "Ориентация на клиента", description: "Индивидуальное внимание — только так можно выполнить личные пожелания и создать долгосрочное доверие." },
    { title: "Местная экспертиза", description: "Глубокое знание кипрских регионов, законов и культуры за каждым решением." },
    { title: "Совершенство и профессионализм", description: "Высочайшее качество сервиса, постоянное обучение, безупречное присутствие офлайн и онлайн." },
    { title: "Устойчивость и ответственность", description: "Экологические аспекты в каждом проекте и партнёры с честными трудовыми и строительными практиками." },
    { title: "Инновации и эффективность", description: "Современные технологии — ИИ-инструменты, электронный документооборот — оптимизируют процессы и экономят ваше время." },
  ],

  teamEyebrow: "Люди",
  teamTitle: "С кем вы будете работать",
  teamLead:
    "Команда, говорящая на шести языках, из четырёх стран. Кто бы ни ответил на звонок, вы говорите с тем, кто живёт здесь.",
  teamSpeaks: "Говорит",
  teamContact: "Связаться",

  storiesEyebrow: "Истории клиентов",
  storiesTitle: "Что говорят наши клиенты",
  storiesLead: "Несколько слов от тех, кто уже сделал этот шаг.",
  storiesAll: "Читать все истории клиентов",

  ctaTitle: "Обсудим ваши планы",
  ctaLead: "Расскажите, что вы ищете, — мы ответим лично, обычно в тот же день.",
  channelWhatsapp: "WhatsApp",
  channelPhone: "Телефон",
  channelEmail: "Email",
  channelHint: {
    whatsapp: "Самый быстрый ответ, обычно за считаные минуты",
    phone: "Позвоните напрямую в рабочие часы",
    email: "Для подробных запросов и документов",
  },
};

const ALL: Record<string, AboutStrings> = { en: EN, de: DE, pl: PL, ru: RU };

export const aboutCopy = (lang: string): AboutStrings => ALL[lang] ?? EN;
