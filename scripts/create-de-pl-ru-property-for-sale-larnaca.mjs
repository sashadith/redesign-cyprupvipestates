/* Content Offensive Plan Track A — property-for-sale-larnaca into
   DE/PL/RU: the general-buyer counterpart to investment-property-larnaca
   (investor-focused). Same real-localization approach. */
import fs from "node:fs";
import crypto from "node:crypto";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
let k = 0;
const key = () => `pfl${(k++).toString(36)}`;
const SCHEDULED_AT = new Date("2026-10-05T06:00:00.000Z");

function para(text) { return { _key: key(), _type: "block", style: "normal", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] }; }
function h2(text) { return { _key: key(), _type: "block", style: "h2", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] }; }
function faqItem(question, answerText) { return { _key: key(), question, answer: [para(answerText)] }; }
const IMG = { _type: "image", asset: { _ref: "image-7bbba15a54c361c20ae7dad88594db4099ab031e-1000x1000-jpg", _type: "reference" } };

const PAGES = {
  de: {
    slug: "immobilien-zum-verkauf-larnaka",
    title: "Immobilien zum Verkauf in Larnaka",
    altText: "Immobilien zum Verkauf in Larnaka | Villen und Wohnungen direkt vom Bauträger",
    seo: { metaTitle: "Immobilien Larnaka kaufen: Villen & Wohnungen, ohne Provision", metaDescription: "Immobilien zum Verkauf in Larnaka — Villen, Wohnungen, Neubau direkt vom Bauträger. Ohne Maklerprovision, mit geprüften Entwicklern." },
    intro: { title: "Immobilien zum Verkauf in Larnaka", subtitle: "Exklusive Neubauten", buttonLabel: "Anfrage senden", description: "Entdecken Sie erstklassige Immobilien zum Verkauf in Larnaka, Zypern — exklusive Villen und moderne Wohnungen in erstklassigen Küstenlagen. Direkt kaufen, ohne Provision, ideal für Investoren und Eigennutzer." },
    projectsTitle: "Immobilien zum Verkauf in Larnaka: aktuelle Auswahl",
    h2_1: "Immobilien zum Verkauf in Larnaka — warum Larnaka",
    p1_1: "Wir verkaufen erstklassige Immobilien in Larnaka — exklusive Villen und moderne Wohnungen — als Neubauten direkt vom geprüften Bauträger. Beim Kauf über uns zahlen Sie keine Provision an die Agentur.",
    p1_2: "Larnaka gehört dank seiner schönen Küste, gut ausgebauten Infrastruktur und wachsenden Nachfrage zu den attraktivsten Standorten Zyperns für Immobilienkäufer. Wenn Sie speziell eine Investitionsvilla mit Fokus auf Rendite suchen, finden Sie eine eigene Übersicht dazu — diese Seite richtet sich an alle, die grundsätzlich eine Immobilie in Larnaka suchen.",
    h2_2: "Top-Lagen in Larnaka für Immobilienkäufer",
    p2_1: "Finikoudes und Stadtzentrum: zentrale Küstenlage mit Promenaden, Stränden und lebendigem Stadtleben — moderne Wohnungen für Mieteinnahmen oder Meeresnähe.",
    p2_2: "Oroklini und Vergina: familienfreundliche Viertel mit Villen und geräumigen Wohnungen — für Dauerwohnsitz oder Ferienhaus.",
    p2_3: "Pervolia Strandlage: exklusive Grundstücke für hochwertige Meerblick-Villen.",
    p2_4: "Kiti und Pyla: beliebt für Gated Communities und ruhige Wohngebiete nahe internationaler Schulen.",
    h2_3: "Immobilientypen in Larnaka",
    p3_1: "Luxusvillen mit privatem Pool, Garten und Meerblick — von Küstenanwesen bis modernen Individualentwürfen.",
    p3_2: "Moderne Wohnungen und Penthouses — von kompakten Einzimmerwohnungen bis geräumigen Penthouses mit Meerblick.",
    p3_3: "Off-Plan- und Neubauprojekte — mit Eigentumsurkunde und Wertsteigerungspotenzial, oft zu früheren Preisstufen.",
    faq: [
      ["Ist der Kauf einer Immobilie in Larnaka als Ausländer sicher?", "Ja, vollständig sicher. Zypern erlaubt vollständiges Eigentum für EU- und Nicht-EU-Bürger. Alle unsere Angebote sind geprüfte Neubauten mit klaren Eigentumsurkunden."],
      ["Zahle ich eine Provision?", "Nein. Sie kaufen direkt vom Bauträger — keine zusätzlichen Maklergebühren."],
      ["Welche Immobilientypen gibt es in Larnaka?", "Strandvillen mit Pool, moderne Stadtwohnungen nahe Finikoudes, Off-Plan-Projekte und Investitionsmöglichkeiten in wachsenden Vierteln wie Pyla oder Kiti."],
      ["Kann ich durch den Kauf eine Aufenthaltsgenehmigung erhalten?", "Ja. Zypern bietet ein Programm für Nicht-EU-Bürger, die eine Immobilie ab 300.000 € (zzgl. MwSt.) erwerben. Neubauten in Larnaka qualifizieren sich dafür."],
      ["Wie hoch sind Grundsteuer und Nebenkosten in Larnaka?", "Zypern hat vergleichsweise niedrige Immobiliensteuern, keine jährliche Grundsteuer, und Übertragungsgebühren sind je nach Kauftyp reduziert oder entfallen. Nebenkosten liegen bei 40-150 €/Monat für Wohnungen, je nach Größe und Ausstattung."],
    ],
  },
  pl: {
    slug: "nieruchomosci-na-sprzedaz-larnaka",
    title: "Nieruchomości na sprzedaż w Larnace",
    altText: "Nieruchomości na sprzedaż w Larnace | Wille i mieszkania bezpośrednio od dewelopera",
    seo: { metaTitle: "Nieruchomości Larnaka na sprzedaż: wille i mieszkania", metaDescription: "Nieruchomości na sprzedaż w Larnace — wille, mieszkania, nowe budownictwo bezpośrednio od dewelopera. Bez prowizji, ze zweryfikowanymi deweloperami." },
    intro: { title: "Nieruchomości na sprzedaż w Larnace", subtitle: "Ekskluzywne nowe budownictwo", buttonLabel: "Wyślij zapytanie", description: "Poznaj ekskluzywne nieruchomości na sprzedaż w Larnace na Cyprze — luksusowe wille i nowoczesne mieszkania w najlepszych lokalizacjach nadmorskich. Kupuj bezpośrednio, bez prowizji, idealne dla inwestorów i nabywców na własne potrzeby." },
    projectsTitle: "Nieruchomości na sprzedaż w Larnace: aktualna oferta",
    h2_1: "Nieruchomości na sprzedaż w Larnace — dlaczego Larnaka",
    p1_1: "Sprzedajemy nieruchomości premium w Larnace — ekskluzywne wille i nowoczesne mieszkania — nowe inwestycje bezpośrednio od zweryfikowanego dewelopera. Przy zakupie przez naszą firmę nie płacą Państwo prowizji.",
    p1_2: "Larnaka należy do najbardziej atrakcyjnych lokalizacji na Cyprze dla nabywców nieruchomości dzięki pięknemu wybrzeżu, dobrze rozwiniętej infrastrukturze i rosnącemu popytowi. Jeśli szukają Państwo willi inwestycyjnej pod kątem rentowności, znajdą Państwo osobną ofertę dedykowaną inwestorom — ta strona jest dla każdego, kto szuka nieruchomości w Larnace ogólnie.",
    h2_2: "Najlepsze lokalizacje w Larnace dla kupujących nieruchomości",
    p2_1: "Finikoudes i centrum miasta: centralna lokalizacja nadmorska z promenadami, plażami i tętniącym życiem miejskim — nowoczesne mieszkania pod wynajem lub życie nad morzem.",
    p2_2: "Oroklini i Vergina: dzielnice przyjazne rodzinom z willami i przestronnymi mieszkaniami — na stały pobyt lub dom wakacyjny.",
    p2_3: "Pervolia nadmorska: ekskluzywne działki pod wille z widokiem na morze.",
    p2_4: "Kiti i Pyla: popularne dla zamkniętych osiedli i spokojnych inwestycji mieszkaniowych blisko szkół międzynarodowych.",
    h2_3: "Rodzaje nieruchomości dostępnych w Larnace",
    p3_1: "Luksusowe wille z prywatnym basenem, ogrodem i widokiem na Morze Śródziemne — od rezydencji nadmorskich po nowoczesne projekty na zamówienie.",
    p3_2: "Nowoczesne mieszkania i penthouse'y — od stylowych kawalerek po przestronne penthouse'y z widokiem na morze.",
    p3_3: "Inwestycje na etapie budowy i nowe budownictwo — z aktem własności i potencjałem wzrostu wartości, często po niższych cenach na wcześniejszym etapie.",
    faq: [
      ["Czy zakup nieruchomości w Larnace jest bezpieczny dla cudzoziemca?", "Tak, w pełni bezpieczny. Cypr, jako członek UE, zapewnia pełne prawo własności obywatelom UE i spoza UE. Wszystkie nasze oferty to zweryfikowane nowe inwestycje z jasnymi aktami własności."],
      ["Czy płacę prowizję agencyjną?", "Nie. Kupują Państwo bezpośrednio od dewelopera — bez dodatkowych opłat agencyjnych."],
      ["Jakie rodzaje nieruchomości są dostępne w Larnace?", "Luksusowe wille nadmorskie z basenem, nowoczesne mieszkania miejskie blisko promenady Finikoudes, inwestycje na etapie budowy oraz możliwości inwestycyjne w rozwijających się dzielnicach jak Pyla czy Kiti."],
      ["Czy zakup nieruchomości daje prawo do pobytu stałego?", "Tak. Cypr oferuje program dla obywateli spoza UE, którzy kupują nieruchomość o wartości co najmniej 300 000 € (plus VAT). Nowe inwestycje w Larnace kwalifikują się do tego programu."],
      ["Jakie są podatki od nieruchomości i koszty utrzymania w Larnace?", "Cypr ma stosunkowo niskie podatki od nieruchomości. Nie ma rocznego podatku od nieruchomości, a opłaty przeniesienia własności są obniżone lub zniesione w zależności od typu zakupu. Opłaty za utrzymanie wynoszą 40-150 €/miesiąc dla mieszkań, w zależności od wielkości i udogodnień."],
    ],
  },
  ru: {
    slug: "nedvizhimost-na-prodazhu-v-larnake",
    title: "Недвижимость на продажу в Ларнаке",
    altText: "Недвижимость на продажу в Ларнаке | Виллы и квартиры напрямую от застройщика",
    seo: { metaTitle: "Недвижимость в Ларнаке на продажу: виллы и квартиры", metaDescription: "Недвижимость на продажу в Ларнаке — виллы, квартиры, новостройки напрямую от застройщика. Без комиссии, с проверенными девелоперами." },
    intro: { title: "Недвижимость на продажу в Ларнаке", subtitle: "Эксклюзивные новостройки", buttonLabel: "Оставить заявку", description: "Подборка эксклюзивной недвижимости на продажу в Ларнаке, Кипр — виллы премиум-класса и современные квартиры в лучших прибрежных локациях. Покупайте напрямую, без комиссии, идеально для инвесторов и для собственного проживания." },
    projectsTitle: "Недвижимость на продажу в Ларнаке: актуальный выбор",
    h2_1: "Недвижимость на продажу в Ларнаке — почему Ларнака",
    p1_1: "Мы продаём премиальную недвижимость в Ларнаке — эксклюзивные виллы и современные квартиры — новостройки напрямую от проверенного застройщика. При покупке через нас вы не платите комиссию.",
    p1_2: "Ларнака — одно из самых привлекательных мест Кипра для покупателей недвижимости благодаря красивому побережью, развитой инфраструктуре и растущему спросу. Если вас интересует именно инвестиционная вилла с прицелом на доходность, у нас есть отдельная страница для инвесторов; эта страница — для тех, кто ищет недвижимость в Ларнаке в целом.",
    h2_2: "Лучшие локации в Ларнаке для покупателей недвижимости",
    p2_1: "Finikoudes и центр города: центральная прибрежная локация с набережными, пляжами и активной городской жизнью — современные квартиры для сдачи в аренду или жизни у моря.",
    p2_2: "Oroklini и Vergina: районы, удобные для семей, с виллами и просторными квартирами — для постоянного проживания или отдыха.",
    p2_3: "Pervolia у моря: эксклюзивные участки под виллы с видом на море.",
    p2_4: "Kiti и Pyla: популярны для закрытых жилых комплексов и спокойных районов рядом с международными школами.",
    h2_3: "Типы недвижимости, доступные в Ларнаке",
    p3_1: "Виллы премиум-класса с частным бассейном, садом и видом на Средиземное море — от прибрежных резиденций до современных проектов на заказ.",
    p3_2: "Современные квартиры и пентхаусы — от компактных студий до просторных пентхаусов с видом на море.",
    p3_3: "Новостройки на этапе строительства — с правом собственности и потенциалом роста стоимости, часто по более низким ценам на раннем этапе.",
    faq: [
      ["Безопасно ли покупать недвижимость в Ларнаке иностранцу?", "Да, полностью безопасно. Кипр как член ЕС обеспечивает полное право собственности для граждан ЕС и стран вне ЕС. Все наши объекты — проверенные новостройки с чистыми правами собственности."],
      ["Плачу ли я комиссию агентству?", "Нет. Вы покупаете напрямую от застройщика — без дополнительных агентских сборов."],
      ["Какие типы недвижимости доступны в Ларнаке?", "Виллы премиум-класса у моря с бассейном, современные городские квартиры рядом с набережной Finikoudes, новостройки на этапе строительства и инвестиционные возможности в развивающихся районах, таких как Pyla или Kiti."],
      ["Даёт ли покупка недвижимости право на резидентство?", "Да. Кипр предлагает программу для граждан стран вне ЕС, покупающих недвижимость от €300,000 (плюс НДС). Новостройки в Ларнаке подходят под эту программу."],
      ["Какие налоги на недвижимость и расходы на содержание в Ларнаке?", "На Кипре сравнительно низкие налоги на недвижимость. Ежегодного налога на недвижимость нет, а сборы за передачу собственности снижены или отсутствуют в зависимости от типа сделки. Расходы на содержание составляют €40–150/месяц для квартир, в зависимости от размера и удобств."],
    ],
  },
};

function buildBlocks(p, lang) {
  return [
    { _key: key(), _type: "landingIntroBlock", image: { ...IMG, alt: p.altText }, title: p.intro.title, subtitle: p.intro.subtitle, buttonLabel: p.intro.buttonLabel, description: p.intro.description },
    { _key: key(), _type: "landingProjectsBlock", title: p.projectsTitle, filterCity: "Larnaca" },
    { _key: key(), _type: "landingTextFirst", content: [h2(p.h2_1), para(p.p1_1), para(p.p1_2), h2(p.h2_2), para(p.p2_1), para(p.p2_2), para(p.p2_3), para(p.p2_4)] },
    { _key: key(), _type: "landingFaqBlock", title: { de: "Häufig gestellte Fragen", pl: "Najczęściej zadawane pytania", ru: "Часто задаваемые вопросы" }[lang], faq: { _type: "accordionBlock", items: p.faq.map(([q, a]) => faqItem(q, a)) } },
    { _key: key(), _type: "landingTextSecond", content: [h2(p.h2_3), para(p.p3_1), para(p.p3_2), para(p.p3_3)] },
  ];
}

async function main() {
  const en = await prisma.singlepage.findFirst({ where: { slug: "property-for-sale-larnaca", language: "en" }, select: { id: true, translationGroupId: true } });
  if (!en) throw new Error("ABORT: EN source page not found");
  const groupId = en.translationGroupId || crypto.randomUUID();

  const investorSiblings = {
    de: "investitionsimmobilien-larnaka-kaufen",
    pl: "nieruchomosci-inwestycyjne-larnaka",
    ru: "investicionnaya-nedvizhimost-larnaka",
  };
  const newKey = () => Math.random().toString(36).slice(2, 12);

  for (const lang of ["de", "pl", "ru"]) {
    const p = PAGES[lang];
    const existing = await prisma.singlepage.findUnique({ where: { language_slug: { language: lang, slug: p.slug } } });
    if (existing) { console.log(`SKIPPED ${lang}: ${p.slug} already exists`); continue; }

    const investor = await prisma.singlepage.findFirst({ where: { slug: investorSiblings[lang], language: lang }, select: { sanityId: true, id: true, relatedLandingPages: true } });
    const relatedLandingPages = investor ? [{ _key: newKey(), _ref: investor.sanityId, _type: "singlepageRef" }] : undefined;

    const created = await prisma.singlepage.create({
      data: {
        sanityId: `local-${crypto.randomUUID()}`, translationGroupId: groupId, language: lang, slug: p.slug,
        title: p.title, excerpt: p.intro.description.slice(0, 200), status: "SCHEDULED", scheduledAt: SCHEDULED_AT,
        previewImage: { ...IMG, alt: p.altText }, seo: p.seo, contentBlocks: buildBlocks(p, lang), relatedLandingPages,
      },
    });
    console.log(`Created ${lang}: ${p.slug} (SCHEDULED for ${SCHEDULED_AT.toISOString()})`);

    if (investor) {
      const refs = investor.relatedLandingPages || [];
      if (!refs.some((r) => r._ref === created.sanityId)) {
        await prisma.singlepage.update({ where: { id: investor.id }, data: { relatedLandingPages: [...refs, { _key: newKey(), _ref: created.sanityId, _type: "singlepageRef" }] } });
        console.log(`  ${investorSiblings[lang]} now links back to ${p.slug}`);
      }
    }
  }
  if (!en.translationGroupId) {
    await prisma.singlepage.update({ where: { id: en.id }, data: { translationGroupId: groupId } });
    console.log("Linked EN page under the shared translationGroupId", groupId);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
