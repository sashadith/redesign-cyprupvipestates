/* Content Offensive Plan Track A — investment-property-larnaca into
   DE/PL/RU. Real localization: DE leans into transparent-process/
   verified-developer trust framing (per DE competitor research's open
   buying-safety gap), PL leans into EU-legal-safety framing, RU leans
   into the Golden Visa/PR Category 6.2 investment angle already proven
   in that market — same pattern established for off-plan-limassol and
   investment-property-in-cyprus earlier this session. Larnaca has zero
   existing DE/PL/RU landing pages, confirmed before writing. */
import fs from "node:fs";
import crypto from "node:crypto";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
let k = 0;
const key = () => `ipl${(k++).toString(36)}`;
const SCHEDULED_AT = new Date("2026-10-05T06:00:00.000Z"); // Mon 05.10, 09:00 Cyprus

function para(text) { return { _key: key(), _type: "block", style: "normal", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] }; }
function h2(text) { return { _key: key(), _type: "block", style: "h2", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] }; }
function faqItem(question, answerText) { return { _key: key(), question, answer: [para(answerText)] }; }
const IMG = { _type: "image", asset: { _ref: "image-7bbba15a54c361c20ae7dad88594db4099ab031e-1000x1000-jpg", _type: "reference" } };

const PAGES = {
  de: {
    slug: "investitionsimmobilien-larnaka-kaufen",
    title: "Investitionsimmobilien in Larnaka",
    altText: "Investitionsimmobilien in Larnaka kaufen | Direkt vom geprüften Bauträger",
    seo: { metaTitle: "Investitionsimmobilien Larnaka: kaufen ohne Provision", metaDescription: "Investitionsimmobilien in Larnaka direkt von geprüften Bauträgern — 5-8% Mietrendite, ohne Maklerprovision, mit transparentem Kaufprozess." },
    intro: { title: "Investitionsimmobilien in Larnaka", subtitle: "Direktverkauf vom Bauträger", buttonLabel: "Anfrage senden", description: "Entdecken Sie erstklassige Investitionsimmobilien in Larnaka, Zypern. Kaufen Sie direkt von geprüften Bauträgern, ohne Maklerprovision — mit starkem Mietrenditepotenzial und transparentem Kaufprozess." },
    projectsTitle: "Investitionsimmobilien in Larnaka: aktuelle Auswahl",
    h2_1: "Investitionsimmobilie in Larnaka kaufen — ohne Provision, mit geprüften Bauträgern",
    p1_1: "Wir verkaufen hochwertige Investitionsimmobilien in Larnaka ausschließlich in Zusammenarbeit mit geprüften Bauträgern — Entwicklern, deren frühere Projekte nachweislich fertiggestellt und mit klaren Eigentumsurkunden übergeben wurden. Beim Kauf über uns zahlen Sie keine Provision.",
    p1_2: "Larnaka hat sich zu einem der attraktivsten Investitionsstandorte Zyperns entwickelt: neue Marina, modernisierte Infrastruktur und wachsender Tourismus schaffen ein stabiles Umfeld für Wertsteigerung und Mietnachfrage. Die Preise liegen hier spürbar unter Limassol oder Paphos — ein guter Einstiegspunkt für Investoren, die noch keine Erfahrung mit dem zyprischen Markt haben.",
    h2_2: "Arten von Investitionsimmobilien in Larnaka",
    p2_1: "Off-Plan-Wohnungen: früher Einstieg zu Preisen unter dem späteren Marktwert, mit flexiblen Zahlungsplänen.",
    p2_2: "Immobilien an Meer und Marina: Wohnungen und Villen nahe der Larnaka Marina oder am Mackenzie Beach erzielen hohe Mietrenditen durch starke touristische Nachfrage.",
    p2_3: "Luxusvillen und Penthouses: in Vierteln wie Livadia und Oroklini, mit Privatsphäre und hochwertiger Ausstattung.",
    h2_3: "Mietrendite und Wertsteigerungspotenzial in Larnaka",
    p3_1: "Larnaka bietet einige der besten Mietrenditen Zyperns, typischerweise 5-8% jährlich für gut gelegene Wohnungen. Ganzjähriger Tourismus und eine wachsende Zahl digitaler Nomaden sorgen für stabile Nachfrage nach kurz- und langfristiger Vermietung.",
    faq: [
      ["Warum in Larnaka statt Limassol oder Paphos investieren?", "Larnaka bietet niedrigere Einstiegspreise, höheres Wertsteigerungspotenzial und wachsende Infrastruktur — ein idealer Einstieg für Investoren in den zyprischen Markt."],
      ["Wie sicher ist eine Investition bei einem unbekannten Bauträger?", "Wir arbeiten ausschließlich mit Bauträgern, deren frühere Projekte nachweislich fertiggestellt wurden — das lässt sich vor dem Kauf prüfen. Der Kaufvertrag wird zusätzlich beim Landregisteramt hinterlegt."],
      ["Zahle ich eine Provision?", "Nein. Wir arbeiten direkt mit Bauträgern zusammen — keine Provision, keine versteckten Gebühren."],
      ["Können Ausländer in Larnaka Immobilien kaufen?", "Ja. Nicht-EU-Bürger können frei kaufen und erhalten vollständige Eigentumsrechte."],
      ["Wie hoch ist die erwartete Mietrendite?", "Typischerweise zwischen 5% und 8% pro Jahr, je nach Immobilientyp und Lage."],
    ],
    h2_4: "Beste Lagen für Investitionsimmobilien in Larnaka",
    p4_1: "Livadia: schnell wachsendes Gebiet nahe dem Strand, neue Wohnprojekte, gute Rendite bei niedrigem Einstiegspreis.",
    p4_2: "Mackenzie Beach: Nachtleben, Restaurants, Meeresnähe — starke Kurzzeitvermietungsrendite.",
    p4_3: "Oroklini: ruhige Vorstadtlage, beliebt für Villen und Familienhäuser, stabiles langfristiges Wachstum.",
    p4_4: "Larnaka Stadtzentrum: urbanes Zentrum, ideal für Airbnb oder langfristige Vermietung.",
    h2_5: "Rechtliche und steuerliche Vorteile für Investoren",
    p5_1: "Zypern bietet eines der attraktivsten Eigentumssysteme der EU: transparenter Rechtsrahmen, niedrige Grundsteuer, keine Erbschaftssteuer und die Möglichkeit einer EU-Aufenthaltsgenehmigung durch Immobilienkauf.",
  },
  pl: {
    slug: "nieruchomosci-inwestycyjne-larnaka",
    title: "Nieruchomości inwestycyjne w Larnace",
    altText: "Nieruchomości inwestycyjne w Larnace | Zakup bezpośrednio od zweryfikowanego dewelopera",
    seo: { metaTitle: "Nieruchomości inwestycyjne Larnaka: bez prowizji", metaDescription: "Nieruchomości inwestycyjne w Larnace bezpośrednio od zweryfikowanych deweloperów — rentowność 5-8%, bez prowizji, z przejrzystym procesem zakupu." },
    intro: { title: "Nieruchomości inwestycyjne w Larnace", subtitle: "Sprzedaż bezpośrednia od dewelopera", buttonLabel: "Wyślij zapytanie", description: "Poznaj najlepsze nieruchomości inwestycyjne w Larnace na Cyprze. Kupuj bezpośrednio od zweryfikowanych deweloperów, bez prowizji agencyjnej — z wysokim potencjałem rentowności najmu i przejrzystym procesem zakupu." },
    projectsTitle: "Nieruchomości inwestycyjne w Larnace: aktualna oferta",
    h2_1: "Zakup nieruchomości inwestycyjnej w Larnace — bez prowizji, ze zweryfikowanymi deweloperami",
    p1_1: "Sprzedajemy nieruchomości inwestycyjne w Larnace wyłącznie we współpracy ze zweryfikowanymi deweloperami — firmami, których wcześniejsze projekty zostały faktycznie ukończone i przekazane z jasnymi tytułami własności. Przy zakupie przez naszą firmę nie płacą Państwo prowizji.",
    p1_2: "Larnaka stała się jednym z najbardziej atrakcyjnych kierunków inwestycyjnych na Cyprze: nowa marina, zmodernizowana infrastruktura i rosnąca turystyka tworzą stabilne środowisko dla wzrostu wartości i popytu na najem. Ceny są tu wyraźnie niższe niż w Limassol czy Pafos — dobry punkt wejścia dla inwestorów bez wcześniejszego doświadczenia na rynku cypryjskim, z pełną ochroną prawną wynikającą z członkostwa Cypru w UE.",
    h2_2: "Rodzaje nieruchomości inwestycyjnych w Larnace",
    p2_1: "Mieszkania na etapie budowy: wczesne wejście po cenie poniżej przyszłej wartości rynkowej, z elastycznym planem płatności.",
    p2_2: "Nieruchomości przy morzu i marinie: mieszkania i wille blisko Larnaca Marina lub Mackenzie Beach zapewniają wysoką rentowność dzięki silnemu popytowi turystycznemu.",
    p2_3: "Luksusowe wille i penthouse'y: w dzielnicach takich jak Livadia i Oroklini, z prywatnością i wysokiej klasy wykończeniem.",
    h2_3: "Rentowność najmu i potencjał wzrostu wartości w Larnace",
    p3_1: "Larnaka oferuje jedną z najlepszych rentowności najmu na Cyprze, zwykle 5-8% rocznie dla dobrze zlokalizowanych mieszkań. Całoroczna turystyka i rosnąca liczba cyfrowych nomadów zapewniają stabilny popyt na najem krótko- i długoterminowy.",
    faq: [
      ["Dlaczego inwestować w Larnace, a nie w Limassol czy Pafos?", "Larnaka oferuje niższe ceny wejścia, wyższy potencjał wzrostu wartości i rozwijającą się infrastrukturę — dobry start dla inwestorów wchodzących na rynek cypryjski."],
      ["Jak bezpieczna jest inwestycja u nieznanego dewelopera?", "Współpracujemy wyłącznie z deweloperami o potwierdzonej historii ukończonych projektów — można to zweryfikować przed zakupem. Umowa jest dodatkowo deponowana w Wydziale Ksiąg Wieczystych."],
      ["Czy płacę prowizję?", "Nie. Współpracujemy bezpośrednio z deweloperami — bez prowizji, bez ukrytych opłat."],
      ["Czy cudzoziemcy mogą kupować nieruchomości w Larnace?", "Tak. Obywatele spoza UE mogą kupować swobodnie i otrzymują pełne prawo własności."],
      ["Jaka jest oczekiwana rentowność najmu?", "Zwykle od 5% do 8% rocznie, w zależności od typu nieruchomości i lokalizacji."],
    ],
    h2_4: "Najlepsze lokalizacje dla nieruchomości inwestycyjnych w Larnace",
    p4_1: "Livadia: szybko rozwijający się obszar blisko plaży, nowe inwestycje mieszkaniowe, dobra rentowność przy niskiej cenie wejścia.",
    p4_2: "Mackenzie Beach: życie nocne, restauracje, bliskość morza — silna rentowność najmu krótkoterminowego.",
    p4_3: "Oroklini: spokojna lokalizacja podmiejska, popularna wśród willi i domów rodzinnych, stabilny długoterminowy wzrost.",
    p4_4: "Centrum Larnaki: miejskie centrum, idealne pod Airbnb lub najem długoterminowy.",
    h2_5: "Korzyści prawne i podatkowe dla inwestorów",
    p5_1: "Cypr oferuje jeden z najbardziej atrakcyjnych systemów własności w UE: przejrzyste ramy prawne, niski podatek od nieruchomości, brak podatku od spadków oraz możliwość uzyskania pobytu w UE poprzez zakup nieruchomości.",
  },
  ru: {
    slug: "investicionnaya-nedvizhimost-larnaka",
    title: "Инвестиционная недвижимость в Ларнаке",
    altText: "Инвестиционная недвижимость в Ларнаке | Покупка напрямую от проверенного застройщика",
    seo: { metaTitle: "Инвестиционная недвижимость в Ларнаке: без комиссии", metaDescription: "Инвестиционная недвижимость в Ларнаке напрямую от проверенных застройщиков — доходность 5-8%, без комиссии, с прозрачным процессом сделки." },
    intro: { title: "Инвестиционная недвижимость в Ларнаке", subtitle: "Прямые продажи от застройщика", buttonLabel: "Оставить заявку", description: "Подборка лучшей инвестиционной недвижимости в Ларнаке, Кипр. Покупайте напрямую от проверенных застройщиков, без комиссии агентству — с сильным потенциалом доходности аренды и правом на Cyprus Permanent Residency при инвестиции от €300,000." },
    projectsTitle: "Инвестиционная недвижимость в Ларнаке: актуальный выбор",
    h2_1: "Покупка инвестиционной недвижимости в Ларнаке — без комиссии, с проверенными застройщиками",
    p1_1: "Мы продаём качественную инвестиционную недвижимость в Ларнаке исключительно в сотрудничестве с проверенными застройщиками — девелоперами, чьи предыдущие проекты были реально сданы с чистыми правами собственности. При покупке через нас вы не платите комиссию.",
    p1_2: "Ларнака превратилась в один из самых привлекательных инвестиционных центров Кипра: новая марина, обновлённая инфраструктура и растущий туризм создают стабильную среду для роста стоимости и спроса на аренду. Цены здесь заметно ниже, чем в Лимассоле или Пафосе — хорошая точка входа для инвесторов без опыта на кипрском рынке. При инвестиции от €300,000 также открывается право на ускоренное оформление ПМЖ по программе Regulation 6.2.",
    h2_2: "Типы инвестиционной недвижимости в Ларнаке",
    p2_1: "Квартиры на этапе строительства: ранний вход по цене ниже будущей рыночной стоимости, с гибким графиком платежей.",
    p2_2: "Недвижимость у моря и марины: квартиры и виллы рядом с Larnaca Marina или Mackenzie Beach обеспечивают высокую доходность благодаря сильному туристическому спросу.",
    p2_3: "Виллы и пентхаусы премиум-класса: в районах Livadia и Oroklini, с приватностью и качественной отделкой.",
    h2_3: "Доходность аренды и потенциал роста стоимости в Ларнаке",
    p3_1: "Ларнака предлагает одну из лучших доходностей аренды на Кипре, обычно 5-8% годовых для удачно расположенных квартир. Круглогодичный туризм и растущее число цифровых кочевников обеспечивают стабильный спрос на краткосрочную и долгосрочную аренду.",
    faq: [
      ["Почему инвестировать в Ларнаку, а не в Лимассол или Пафос?", "Ларнака предлагает более низкие цены входа, более высокий потенциал роста стоимости и развивающуюся инфраструктуру — хорошая точка входа для инвесторов на кипрский рынок."],
      ["Насколько безопасна инвестиция у незнакомого застройщика?", "Мы работаем только с застройщиками, чьи предыдущие проекты были реально сданы — это можно проверить до покупки. Договор дополнительно депонируется в Земельном кадастре."],
      ["Плачу ли я комиссию?", "Нет. Мы работаем напрямую с застройщиками — без комиссии, без скрытых сборов."],
      ["Могут ли иностранцы покупать недвижимость в Ларнаке?", "Да. Граждане стран вне ЕС могут покупать свободно и получают полное право собственности."],
      ["Какая ожидаемая доходность аренды?", "Обычно от 5% до 8% годовых, в зависимости от типа недвижимости и расположения."],
    ],
    h2_4: "Лучшие районы для инвестиционной недвижимости в Ларнаке",
    p4_1: "Livadia: быстрорастущий район рядом с пляжем, новые жилые проекты, хорошая доходность при низкой цене входа.",
    p4_2: "Mackenzie Beach: ночная жизнь, рестораны, близость к морю — высокая доходность краткосрочной аренды.",
    p4_3: "Oroklini: спокойный пригородный район, популярен для вилл и семейных домов, стабильный долгосрочный рост.",
    p4_4: "Центр Ларнаки: городской центр, идеален для Airbnb или долгосрочной аренды.",
    h2_5: "Юридические и налоговые преимущества для инвесторов",
    p5_1: "Кипр предлагает одну из самых привлекательных систем собственности в ЕС: прозрачную правовую базу, низкий налог на недвижимость, отсутствие налога на наследство и возможность получения резидентства ЕС через покупку недвижимости.",
  },
};

function buildBlocks(p, lang) {
  return [
    { _key: key(), _type: "landingIntroBlock", image: { ...IMG, alt: p.altText }, title: p.intro.title, subtitle: p.intro.subtitle, buttonLabel: p.intro.buttonLabel, description: p.intro.description },
    { _key: key(), _type: "landingProjectsBlock", title: p.projectsTitle, filterCity: "Larnaca" },
    { _key: key(), _type: "landingTextFirst", content: [h2(p.h2_1), para(p.p1_1), para(p.p1_2), h2(p.h2_2), para(p.p2_1), para(p.p2_2), para(p.p2_3), h2(p.h2_3), para(p.p3_1)] },
    { _key: key(), _type: "landingFaqBlock", title: { de: "Häufig gestellte Fragen", pl: "Najczęściej zadawane pytania", ru: "Часто задаваемые вопросы" }[lang], faq: { _type: "accordionBlock", items: p.faq.map(([q, a]) => faqItem(q, a)) } },
    { _key: key(), _type: "landingTextSecond", content: [h2(p.h2_4), para(p.p4_1), para(p.p4_2), para(p.p4_3), para(p.p4_4), h2(p.h2_5), para(p.p5_1)] },
  ];
}

async function main() {
  const en = await prisma.singlepage.findFirst({ where: { slug: "investment-property-larnaca", language: "en" }, select: { id: true, translationGroupId: true } });
  if (!en) throw new Error("ABORT: EN source page not found");
  const groupId = en.translationGroupId || crypto.randomUUID();

  for (const lang of ["de", "pl", "ru"]) {
    const p = PAGES[lang];
    const existing = await prisma.singlepage.findUnique({ where: { language_slug: { language: lang, slug: p.slug } } });
    if (existing) { console.log(`SKIPPED ${lang}: ${p.slug} already exists`); continue; }
    await prisma.singlepage.create({
      data: {
        sanityId: `local-${crypto.randomUUID()}`, translationGroupId: groupId, language: lang, slug: p.slug,
        title: p.title, excerpt: p.intro.description.slice(0, 200), status: "SCHEDULED", scheduledAt: SCHEDULED_AT,
        previewImage: { ...IMG, alt: p.altText }, seo: p.seo, contentBlocks: buildBlocks(p, lang),
      },
    });
    console.log(`Created ${lang}: ${p.slug} (SCHEDULED for ${SCHEDULED_AT.toISOString()})`);
  }
  if (!en.translationGroupId) {
    await prisma.singlepage.update({ where: { id: en.id }, data: { translationGroupId: groupId } });
    console.log("Linked EN page under the shared translationGroupId", groupId);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
