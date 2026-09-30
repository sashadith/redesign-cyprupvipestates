/* Content Offensive Plan, Track A — investment-property-in-cyprus into
   DE/PL/RU. Per the user's correction (2026-09-30): actual publish dates
   now follow the plan's calendar via `status: SCHEDULED` + `scheduledAt`
   (flipped to PUBLISHED by the src/app/api/cron/publish-scheduled worker,
   which runs every few minutes on the VPS) rather than publishing
   immediately — authoring happens as early as possible, but go-live is
   staggered, specifically to keep pages coming out 5-9 Oct while the user
   is unavailable to supervise.

   DE slug (immobilien-zypern-kaufen) targets "immobilien zypern"/"zypern
   immobilien" (2,400/mo each) head-on — the exact terms a single thin
   Enovia page currently wins purely because this site has no commercial
   DE landing page at all (confirmed in today's DE competitor deep-dive).
   RU slug deliberately differs from the existing Blog guide
   (investicii-v-nedvizhimost-na-kipre-polnoe-rukovodstvo) to avoid
   conflating a commercial landing page with an editorial guide. */
import fs from "node:fs";
import crypto from "node:crypto";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
let k = 0;
const key = () => `ipk${(k++).toString(36)}`;
const SCHEDULED_AT = new Date("2026-10-01T06:00:00.000Z"); // Thu 01.10, 09:00 Cyprus time

function para(text) { return { _key: key(), _type: "block", style: "normal", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] }; }
function h2(text) { return { _key: key(), _type: "block", style: "h2", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] }; }
function faqItem(question, answerText) { return { _key: key(), question, answer: [para(answerText)] }; }
const IMG = { _type: "image", asset: { _ref: "image-7bbba15a54c361c20ae7dad88594db4099ab031e-1000x1000-jpg", _type: "reference" } };

const PAGES = {
  de: {
    slug: "immobilien-zypern-kaufen",
    title: "Investitionsimmobilien auf Zypern",
    altText: "Investitionsimmobilien auf Zypern kaufen | Direkt vom Bauträger",
    seo: { metaTitle: "Immobilien Zypern kaufen: Investment ohne Provision", metaDescription: "Investitionsimmobilien auf Zypern direkt vom Bauträger kaufen — geprüfte Entwickler, transparenter Kaufprozess, ohne Maklerprovision, mit 5-8% Mietrendite." },
    intro: { title: "Investitionsimmobilien auf Zypern", subtitle: "In Immobilien investieren", buttonLabel: "Anfrage senden", description: "Entdecken Sie Investitionsimmobilien auf Zypern. Kaufen Sie neue Wohnungen und Villen direkt vom Bauträger, ohne Maklerprovision — mit geprüften Entwicklern und nachvollziehbarem Kaufprozess." },
    projectsTitle: "Liste der Investitionsimmobilien auf Zypern",
    h2_1: "Immobilien auf Zypern kaufen: Chancen für internationale Investoren",
    p1_1: "Wir verkaufen hochwertige Investitionsimmobilien auf Zypern ausschließlich in Zusammenarbeit mit geprüften Bauträgern — Entwicklern, deren frühere Projekte nachweislich fertiggestellt wurden. Beim Kauf über uns zahlen Sie keine Provision — keinen einzigen Euro zusätzlich.",
    p1_2: "Zypern zieht weiterhin internationale Investoren an, die einen stabilen Markt, solide Mietrenditen und EU-Eigentumsrechte suchen. Von Luxusvillen bis zu modernen Wohnungen bietet eine Investitionsimmobilie auf Zypern sowohl Wertsteigerungspotenzial als auch passives Einkommen.",
    h2_2: "Warum Zypern zu den besten Immobilienstandorten Europas gehört",
    p2_1: "Zypern verbindet mediterranes Flair, EU-Stabilität und ein investorenfreundliches Umfeld. Der Immobilienmarkt wird durch wachsenden Tourismus, ein günstiges Steuersystem und kontinuierliche Stadtentwicklung gestützt.",
    p2_2: "Wichtige Gründe für eine Investition in Zypern:",
    p2_3: "Transparenter, rechtssicherer Rahmen für ausländische Käufer",
    p2_4: "Hohe Nachfrage von Touristen und Auswanderern",
    p2_5: "Niedrige Grundsteuer, keine Erbschaftssteuer",
    p2_6: "Kontinuierlicher Preisanstieg",
    p2_7: "Für Investoren verbindet Zypern Lebensqualität mit solider finanzieller Performance.",
    h2_3: "Arten von Investitionsimmobilien auf Zypern",
    p3_1: "1. Off-Plan-Projekte",
    p3_2: "Der Kauf einer Off-Plan-Investitionsimmobilie auf Zypern ermöglicht einen frühen Einstieg zu Preisen unter dem späteren Marktwert, mit modernem Design und flexiblen Zahlungsplänen.",
    p3_3: "2. Stadtwohnungen",
    p3_4: "Wohnungen in Limassol, Larnaka und Paphos erzielen dank ganzjähriger Nachfrage von Berufstätigen, Auswanderern und Touristen gute Mietrenditen.",
    p3_5: "3. Luxusvillen und Küstenimmobilien",
    p3_6: "Exklusive Villen und Strandresidenzen bieten gehobenes Wohnen bei langfristigem Investitionswert und hochwertigen Mietern.",
    h2_4: "Mietrenditen und Marktentwicklung",
    p4_1: "Der Mietmarkt Zyperns profitiert von einem starken Tourismussektor und einer wachsenden Zahl digitaler Nomaden.",
    p4_2: "Gut gelegene Investitionsimmobilien auf Zypern erzielen jährliche Mietrenditen zwischen 5% und 8% — mehr als in vielen anderen europäischen Standorten.",
    faq: [
      ["Warum in Immobilien auf Zypern investieren?", "Zypern verbindet EU-Rechtssicherheit, niedrige Steuern und starke Mietnachfrage — mit verlässlichen Renditen und Wertsteigerung."],
      ["Wie sicher ist eine Investition bei einem unbekannten Bauträger?", "Wir arbeiten ausschließlich mit Bauträgern, deren frühere Projekte nachweislich fertiggestellt wurden — das lässt sich vor dem Kauf prüfen. Der Kaufvertrag wird zusätzlich beim Landregisteramt hinterlegt, was Ihre Zahlungen rechtlich schützt."],
      ["Zahle ich eine Provision an Ihre Agentur?", "Nein. Wir verkaufen direkt vom Bauträger — Sie zahlen keine Provision und keine versteckten Gebühren."],
      ["Können Ausländer Investitionsimmobilien auf Zypern kaufen?", "Ja. Nicht-EU-Bürger können mit vollem Eigentumsrecht kaufen und profitieren vom investorenfreundlichen Rechtssystem Zyperns."],
      ["Wie hoch ist die durchschnittliche Mietrendite?", "Je nach Lage und Immobilientyp liegt die durchschnittliche Rendite zwischen 5% und 8% pro Jahr."],
      ["Welche steuerlichen Vorteile bietet Immobilienbesitz auf Zypern?", "Niedrige Grundsteuer, keine Erbschaftssteuer und günstige Rahmenbedingungen machen Zypern besonders attraktiv für Investoren."],
    ],
    h2_5: "Beliebteste Regionen für Investitionsimmobilien auf Zypern",
    p5_1: "Zypern bietet mehrere attraktive Standorte:",
    p5_2: "Larnaka: wachsende Küstenstadt mit günstigem Einstiegspreis und hoher Mietnachfrage.",
    p5_3: "Limassol: Wirtschaftszentrum und Hotspot für Luxusimmobilien und hochpreisige Vermietung.",
    p5_4: "Paphos: malerische Stadt mit starker Tourismusrendite und attraktiven Off-Plan-Projekten.",
    p5_5: "Nikosia: Hauptstadt, geeignet für Investoren mit Interesse an stabilen langfristigen Mietern.",
    h2_6: "Investitionsimmobilie auf Zypern ohne Provision kaufen",
    p6_1: "Beim Kauf über uns verhandeln Sie direkt mit Bauträgern — ohne Provision, ohne versteckte Kosten, mit vollständiger Begleitung in jeder Phase: persönliche Objektauswahl, rechtliche Prüfung, Vertragsabwicklung und Beratung zu Vermietung und Verwaltung.",
    h2_7: "Rechtliche und steuerliche Vorteile",
    p7_1: "Zypern bleibt eines der investorenfreundlichsten EU-Länder: volles Eigentumsrecht für Ausländer, niedrige Übertragungs- und Grundsteuer, keine Erbschaftssteuer sowie die Möglichkeit einer EU-Aufenthaltsgenehmigung durch Immobilienkauf.",
  },
  pl: {
    slug: "nieruchomosci-inwestycyjne-na-cyprze",
    title: "Nieruchomości inwestycyjne na Cyprze",
    altText: "Nieruchomości inwestycyjne na Cyprze | Zakup bezpośrednio od dewelopera",
    seo: { metaTitle: "Nieruchomości inwestycyjne Cypr: bez prowizji", metaDescription: "Nieruchomości inwestycyjne na Cyprze bezpośrednio od zweryfikowanego dewelopera — bez prowizji, z rentownością 5-8% rocznie i pełnym bezpieczeństwem prawnym." },
    intro: { title: "Nieruchomości inwestycyjne na Cyprze", subtitle: "Inwestuj w nieruchomości", buttonLabel: "Wyślij zapytanie", description: "Poznaj najlepsze nieruchomości inwestycyjne na Cyprze. Kupuj nowe mieszkania i wille bezpośrednio od dewelopera, bez prowizji agencyjnej, z pełną dokumentacją i zabezpieczeniem prawnym zgodnym z prawem cypryjskim (Republika Cypru, państwo członkowskie UE)." },
    projectsTitle: "Lista nieruchomości inwestycyjnych na Cyprze",
    h2_1: "Nieruchomości inwestycyjne na Cyprze: możliwości dla inwestorów międzynarodowych",
    p1_1: "Sprzedajemy nieruchomości inwestycyjne na Cyprze wyłącznie we współpracy ze zweryfikowanymi deweloperami — firmami, których wcześniejsze projekty zostały faktycznie ukończone. Przy zakupie przez naszą firmę nie płacą Państwo żadnej prowizji.",
    p1_2: "Cypr, jako członek UE od 2004 roku, przyciąga inwestorów szukających stabilnego rynku i solidnej rentowności najmu, z pełną ochroną prawną tytułu własności — w odróżnieniu od okupowanej przez Turcję północnej części wyspy.",
    h2_2: "Dlaczego Cypr to jeden z najlepszych kierunków inwestycyjnych w Europie",
    p2_1: "Cypr łączy śródziemnomorski klimat, stabilność UE i przyjazne otoczenie dla inwestorów. Rynek nieruchomości wspiera rosnąca turystyka, korzystny system podatkowy i ciągły rozwój urbanistyczny.",
    p2_2: "Kluczowe powody inwestycji na Cyprze:",
    p2_3: "Przejrzyste i bezpieczne ramy prawne dla zagranicznych nabywców",
    p2_4: "Wysoki popyt ze strony turystów i emigrantów",
    p2_5: "Niski podatek od nieruchomości, brak podatku od spadków",
    p2_6: "Stały wzrost cen nieruchomości",
    p2_7: "Dla inwestorów Cypr łączy atrakcyjność stylu życia z solidnymi wynikami finansowymi.",
    h2_3: "Rodzaje nieruchomości inwestycyjnych na Cyprze",
    p3_1: "1. Inwestycje na etapie budowy",
    p3_2: "Zakup nieruchomości inwestycyjnej na etapie budowy pozwala wejść wcześnie, po cenie poniżej przyszłej wartości rynkowej, z nowoczesnym projektem i elastycznym planem płatności.",
    p3_3: "2. Mieszkania miejskie",
    p3_4: "Mieszkania w Limassol, Larnace i Pafos zapewniają dobrą rentowność najmu dzięki całorocznemu popytowi wśród profesjonalistów, emigrantów i turystów.",
    p3_5: "3. Luksusowe wille i nieruchomości nadmorskie",
    p3_6: "Ekskluzywne wille i rezydencje nad morzem łączą luksusowe warunki życia z długoterminową wartością inwestycyjną.",
    h2_4: "Rentowność najmu i wzrost rynku",
    p4_1: "Rynek najmu na Cyprze rozwija się dzięki silnemu sektorowi turystycznemu i rosnącej liczbie cyfrowych nomadów.",
    p4_2: "Dobrze zlokalizowane nieruchomości inwestycyjne na Cyprze mogą generować roczną rentowność najmu na poziomie 5-8%, przewyższając wiele innych europejskich kierunków.",
    faq: [
      ["Dlaczego warto inwestować w nieruchomości na Cyprze?", "Cypr łączy bezpieczeństwo prawne UE, niskie podatki i silny popyt na najem — oferując stabilny zwrot i wzrost wartości kapitału."],
      ["Jak bezpieczna jest inwestycja u nieznanego dewelopera?", "Współpracujemy wyłącznie z deweloperami o potwierdzonej historii ukończonych projektów — można to zweryfikować przed zakupem. Umowa jest dodatkowo deponowana w Wydziale Ksiąg Wieczystych, co chroni wpłacone środki prawnie."],
      ["Czy płacę prowizję Państwa agencji?", "Nie. Sprzedajemy bezpośrednio od dewelopera — nie płacą Państwo żadnej prowizji ani ukrytych opłat."],
      ["Czy cudzoziemcy mogą kupować nieruchomości inwestycyjne na Cyprze?", "Tak. Obywatele spoza UE mogą kupować z pełnym prawem własności i korzystać z przyjaznego inwestorom systemu prawnego Cypru."],
      ["Jaka jest średnia rentowność najmu?", "W zależności od lokalizacji i typu nieruchomości, średnia rentowność wynosi od 5% do 8% rocznie."],
      ["Jakie korzyści podatkowe daje posiadanie nieruchomości na Cyprze?", "Niski podatek od nieruchomości, brak podatku od spadków i korzystne warunki czynią Cypr szczególnie atrakcyjnym dla inwestorów."],
    ],
    h2_5: "Najpopularniejsze regiony dla nieruchomości inwestycyjnych na Cyprze",
    p5_1: "Cypr oferuje kilka atrakcyjnych lokalizacji:",
    p5_2: "Larnaka: szybko rozwijające się miasto nadmorskie z przystępną ceną wejścia i wysokim popytem na najem.",
    p5_3: "Limassol: centrum biznesowe i hotspot dla luksusowych nieruchomości oraz najmu wysokiej klasy.",
    p5_4: "Pafos: malownicze miasto o silnej rentowności turystycznej i atrakcyjnych inwestycjach na etapie budowy.",
    p5_5: "Nikozja: stolica, odpowiednia dla inwestorów zainteresowanych stabilnymi, długoterminowymi najemcami.",
    h2_6: "Zakup nieruchomości inwestycyjnej na Cyprze bez prowizji",
    p6_1: "Kupując przez naszą firmę, negocjują Państwo bezpośrednio z deweloperem — bez prowizji, bez ukrytych kosztów, z pełnym wsparciem na każdym etapie: dobór nieruchomości, weryfikacja prawna, podpisanie umowy oraz doradztwo dotyczące najmu i zarządzania.",
    h2_7: "Korzyści prawne i podatkowe",
    p7_1: "Cypr pozostaje jednym z najbardziej przyjaznych inwestorom krajów UE: pełne prawo własności dla cudzoziemców, niski podatek od przeniesienia własności i podatek roczny, brak podatku od spadków oraz możliwość uzyskania pobytu w UE poprzez zakup nieruchomości.",
  },
  ru: {
    slug: "investicionnaya-nedvizhimost-na-kipre",
    title: "Инвестиционная недвижимость на Кипре",
    altText: "Инвестиционная недвижимость на Кипре | Покупка напрямую от застройщика",
    seo: { metaTitle: "Инвестиционная недвижимость на Кипре: без комиссии", metaDescription: "Инвестиционная недвижимость на Кипре напрямую от проверенного застройщика — без комиссии, доходность 5-8% годовых, право на резидентство от €300,000." },
    intro: { title: "Инвестиционная недвижимость на Кипре", subtitle: "Инвестируйте в недвижимость", buttonLabel: "Оставить заявку", description: "Подборка лучшей инвестиционной недвижимости на Кипре. Покупайте новые квартиры и виллы напрямую от застройщика, без комиссии агентству — с проверенными девелоперами и правом на Cyprus Permanent Residency при инвестиции от €300,000." },
    projectsTitle: "Список инвестиционной недвижимости на Кипре",
    h2_1: "Инвестиционная недвижимость на Кипре: возможности для международных инвесторов",
    p1_1: "Мы продаём качественную инвестиционную недвижимость на Кипре исключительно в сотрудничестве с проверенными застройщиками — девелоперами, чьи предыдущие проекты были реально сданы. При покупке через нас вы не платите комиссию — ни одного евро сверху.",
    p1_2: "Кипр продолжает привлекать международных инвесторов, ищущих стабильный рынок, устойчивую доходность аренды и право собственности в ЕС. При инвестиции от €300,000 в новую недвижимость также открывается право на ускоренное оформление ПМЖ по программе Regulation 6.2.",
    h2_2: "Почему Кипр — одно из лучших направлений для инвестиций в недвижимость в Европе",
    p2_1: "Кипр сочетает средиземноморский образ жизни, стабильность ЕС и благоприятные условия для инвесторов. Рынок недвижимости поддерживается растущим туризмом, выгодной налоговой системой и постоянным развитием городской инфраструктуры.",
    p2_2: "Ключевые причины инвестировать на Кипре:",
    p2_3: "Прозрачная и защищённая правовая система для иностранных покупателей",
    p2_4: "Высокий спрос со стороны туристов и экспатов",
    p2_5: "Низкий налог на недвижимость, отсутствие налога на наследство",
    p2_6: "Устойчивый рост цен на недвижимость",
    p2_7: "Для инвесторов Кипр сочетает привлекательный образ жизни с надёжными финансовыми показателями.",
    h2_3: "Типы инвестиционной недвижимости на Кипре",
    p3_1: "1. Новостройки на этапе строительства",
    p3_2: "Покупка новостройки на этапе строительства позволяет войти в рынок раньше, по цене ниже будущей рыночной стоимости, с современным дизайном и гибким графиком платежей.",
    p3_3: "2. Городские квартиры",
    p3_4: "Квартиры в Лимассоле, Ларнаке и Пафосе обеспечивают хорошую доходность благодаря круглогодичному спросу со стороны специалистов, экспатов и туристов.",
    p3_5: "3. Виллы премиум-класса и прибрежная недвижимость",
    p3_6: "Эксклюзивные виллы и резиденции у моря сочетают комфортную жизнь с долгосрочной инвестиционной ценностью.",
    h2_4: "Доходность аренды и рост рынка",
    p4_1: "Рынок аренды на Кипре растёт благодаря сильному туристическому сектору и увеличивающемуся числу цифровых кочевников.",
    p4_2: "Удачно расположенная инвестиционная недвижимость на Кипре может приносить доходность аренды от 5% до 8% годовых — выше, чем во многих других европейских направлениях.",
    faq: [
      ["Почему стоит инвестировать в недвижимость на Кипре?", "Кипр сочетает юридическую защиту ЕС, низкие налоги и стабильный спрос на аренду — с надёжной доходностью и ростом капитала."],
      ["Насколько безопасна инвестиция у незнакомого застройщика?", "Мы работаем только с застройщиками, чьи предыдущие проекты были реально сданы — это можно проверить до покупки. Договор дополнительно депонируется в Земельном кадастре, что защищает внесённые средства юридически."],
      ["Плачу ли я комиссию вашему агентству?", "Нет. Мы продаём напрямую от застройщика — вы не платите комиссию и скрытые сборы."],
      ["Могут ли иностранцы покупать инвестиционную недвижимость на Кипре?", "Да. Граждане стран вне ЕС могут покупать с полным правом собственности и пользоваться благоприятной для инвесторов правовой системой Кипра."],
      ["Какая средняя доходность аренды на Кипре?", "В зависимости от района и типа недвижимости средняя доходность составляет от 5% до 8% годовых."],
      ["Какие налоговые преимущества даёт владение недвижимостью на Кипре?", "Низкий налог на недвижимость, отсутствие налога на наследство и льготные условия делают Кипр особенно привлекательным для инвесторов."],
    ],
    h2_5: "Самые популярные регионы для инвестиционной недвижимости на Кипре",
    p5_1: "Кипр предлагает несколько привлекательных локаций:",
    p5_2: "Ларнака: быстрорастущий прибрежный город с доступной ценой входа и высоким спросом на аренду.",
    p5_3: "Лимассол: деловой центр и точка притяжения для элитной недвижимости и аренды премиум-класса.",
    p5_4: "Пафос: живописный город с сильной туристической доходностью и привлекательными новостройками.",
    p5_5: "Никосия: столица, подходит инвесторам, заинтересованным в стабильных долгосрочных арендаторах.",
    h2_6: "Покупка инвестиционной недвижимости на Кипре без комиссии",
    p6_1: "При покупке через нас вы работаете напрямую с застройщиком — без комиссии, без скрытых расходов, с полным сопровождением на каждом этапе: подбор объекта, юридическая проверка, оформление сделки, консультация по аренде и управлению.",
    h2_7: "Юридические и налоговые преимущества",
    p7_1: "Кипр остаётся одной из самых благоприятных для инвесторов стран ЕС: полное право собственности для иностранцев, низкий налог на передачу собственности и ежегодный налог, отсутствие налога на наследство, а также возможность получения резидентства ЕС через покупку недвижимости.",
  },
};

function buildBlocks(p, lang) {
  return [
    { _key: key(), _type: "landingIntroBlock", image: { ...IMG, alt: p.altText }, title: p.intro.title, subtitle: p.intro.subtitle, buttonLabel: p.intro.buttonLabel, description: p.intro.description },
    { _key: key(), _type: "landingProjectsBlock", title: p.projectsTitle },
    { _key: key(), _type: "landingTextFirst", content: [
      h2(p.h2_1), para(p.p1_1), para(p.p1_2),
      h2(p.h2_2), para(p.p2_1), para(p.p2_2), para(p.p2_3), para(p.p2_4), para(p.p2_5), para(p.p2_6), para(p.p2_7),
      h2(p.h2_3), para(p.p3_1), para(p.p3_2), para(p.p3_3), para(p.p3_4), para(p.p3_5), para(p.p3_6),
      h2(p.h2_4), para(p.p4_1), para(p.p4_2),
    ] },
    { _key: key(), _type: "landingFaqBlock", title: { de: "Häufig gestellte Fragen", pl: "Najczęściej zadawane pytania", ru: "Часто задаваемые вопросы" }[lang], faq: { _type: "accordionBlock", items: p.faq.map(([q, a]) => faqItem(q, a)) } },
    { _key: key(), _type: "landingTextSecond", content: [
      h2(p.h2_5), para(p.p5_1), para(p.p5_2), para(p.p5_3), para(p.p5_4), para(p.p5_5),
      h2(p.h2_6), para(p.p6_1),
      h2(p.h2_7), para(p.p7_1),
    ] },
  ];
}

async function main() {
  const en = await prisma.singlepage.findFirst({ where: { slug: "investment-property-in-cyprus", language: "en" }, select: { id: true, translationGroupId: true } });
  if (!en) throw new Error("ABORT: EN source page not found");
  const groupId = en.translationGroupId || crypto.randomUUID();

  for (const lang of ["de", "pl", "ru"]) {
    const p = PAGES[lang];
    const existing = await prisma.singlepage.findUnique({ where: { language_slug: { language: lang, slug: p.slug } } });
    if (existing) { console.log(`SKIPPED ${lang}: ${p.slug} already exists`); continue; }
    await prisma.singlepage.create({
      data: {
        sanityId: `local-${crypto.randomUUID()}`,
        translationGroupId: groupId,
        language: lang,
        slug: p.slug,
        title: p.title,
        excerpt: p.intro.description.slice(0, 200),
        status: "SCHEDULED",
        scheduledAt: SCHEDULED_AT,
        previewImage: { ...IMG, alt: p.altText },
        seo: p.seo,
        contentBlocks: buildBlocks(p, lang),
      },
    });
    console.log(`Created ${lang}: ${p.slug} (SCHEDULED for ${SCHEDULED_AT.toISOString()})`);
  }

  if (!en.translationGroupId) {
    await prisma.singlepage.update({ where: { id: en.id }, data: { translationGroupId: groupId } });
    console.log("Linked EN page under the shared translationGroupId", groupId);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
