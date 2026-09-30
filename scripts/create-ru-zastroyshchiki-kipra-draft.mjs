/* October Content Calendar, sprint day 4 (05.10): RU developer directory —
   the highest-confidence item from the competitor structural audit
   (competitor-structural-audit-2026-09-29 memory): tranio.ru and
   cyprus-real.estate both maintain one independently, AND it matches our
   own real GSC demand (locale='ru', "застройщик"/"девелопер" queries,
   ~1,800 impressions/90d as of this pull — concentrated heavily on
   "застройщики лимассола/лимассол/в лимассоле" variants, ~900 impressions
   combined, then general "застройщики на кипре/кипра").

   All developer names, project counts and city breakdowns pulled directly
   from the live Developer/Project tables (22 developers with >=1 active RU
   project, not the "40+" competitors claim — this site works directly with
   22, and that's the honest number to publish, per no-padding-lists
   memory). Excerpt-derived specialty framing is drawn from each developer's
   own real Developer.excerpt row (RU), not invented — except mito-
   developers, whose excerpt was a Polish-text bug fixed earlier this
   session (fix-mito-developers-ru-excerpt-language-bug.mjs).

   Differentiated from the existing kak-proverit-zastroyshchika-na-kipre
   post (due-diligence / red-flags angle) by intent: this page is "who are
   the developers", that one is "how to vet one you're already considering"
   — cross-linked, not merged.

   DRAFT status per the standing hard rule (blog-content-workflow-
   requirements memory): new blog posts are never auto-published. */
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient();

const SLUG = "zastroyshchiki-kipra";
const AUTHOR_ID = "1253fa77-5bd7-4243-9d64-da11cb2d8ae6"; // Sascha Dith, RU
const CATEGORY_ID = "65b05398-5f52-4714-823a-766cd9eedecc"; // "Проекты застройщиков и новостройки"

let k = 0;
const key = () => `zk${(k++).toString(36)}`;

function para(text, marks = []) {
  return { _key: key(), _type: "block", style: "normal", markDefs: [], children: [{ _key: key(), _type: "span", marks, text }] };
}
function empty() {
  return { _key: key(), _type: "block", style: "normal", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text: "" }] };
}
function h2(text) {
  return { _key: key(), _type: "block", style: "h2", markDefs: [], children: [{ _key: key(), _type: "span", marks: [], text }] };
}
function linkBullet(before, linkText, href, after = "") {
  const markKey = key();
  return {
    _key: key(), _type: "block", style: "normal", level: 1, listItem: "bullet",
    markDefs: [{ _key: markKey, href, _type: "link" }],
    children: [
      { _key: key(), _type: "span", marks: [], text: before },
      { _key: key(), _type: "span", marks: [markKey], text: linkText },
      { _key: key(), _type: "span", marks: [], text: after },
    ],
  };
}
function paraWithLink(before, linkText, href, after = "") {
  const markKey = key();
  return {
    _key: key(), _type: "block", style: "normal",
    markDefs: [{ _key: markKey, href, _type: "link" }],
    children: [
      { _key: key(), _type: "span", marks: [], text: before },
      { _key: key(), _type: "span", marks: [markKey], text: linkText },
      { _key: key(), _type: "span", marks: [], text: after },
    ],
  };
}

async function main() {
  const existing = await prisma.blog.findUnique({ where: { language_slug: { language: "ru", slug: SLUG } } });
  if (existing) {
    console.log(`ABORT: ${SLUG} already exists (status: ${existing.status}) — not overwriting.`);
    return;
  }

  const devs = await prisma.developer.findMany({
    where: { language: "ru" },
    select: { slug: true, title: true, excerpt: true, _count: { select: { projects: true } } },
    orderBy: { title: "asc" },
  });
  const active = devs.filter((d) => d._count.projects > 0);
  const totalProjects = active.reduce((s, d) => s + d._count.projects, 0);

  const cityRows = await prisma.$queryRaw`
    SELECT d.slug as dev_slug, p.city, COUNT(*) as cnt
    FROM projects p JOIN developers d ON p."developerId" = d.id
    WHERE d.language = 'ru'
    GROUP BY d.slug, p.city
    ORDER BY d.slug, cnt DESC
  `;
  const cityBySlug = {};
  for (const row of cityRows) (cityBySlug[row.dev_slug] ||= []).push({ city: row.city, cnt: Number(row.cnt) });
  const byId = Object.fromEntries(active.map((d) => [d.slug, d]));

  const limassolHeavy = ["bbf", "square-one", "cybarco", "imperio-properties", "sol-properties"];
  const paphosHeavy = ["aristo-developers", "domenica-group", "olias-homes", "island-blue", "korantina-homes", "kuutio-homes"];
  const islandWide = ["leptos-estates", "pafilia", "agg-luxury-homes"];

  function devLine(slug) {
    const d = byId[slug];
    if (!d) return null;
    const cities = cityBySlug[slug] || [];
    const cityStr = cities.map((c) => `${c.city}: ${c.cnt}`).join(", ");
    return linkBullet(
      "",
      d.title,
      `/ru/developers/${slug}`,
      ` — ${d._count.projects} проект${plural(d._count.projects)} в базе (${cityStr}).`,
    );
  }
  function plural(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return "";
    if ([2, 3, 4].includes(m10) && ![12, 13, 14].includes(m100)) return "а";
    return "ов";
  }

  const intro = {
    _key: key(), _type: "textContent", textAlign: "left",
    content: [
      para(
        "На Кипре нет единого реестра застройщиков, к которому можно было бы просто обратиться — рынок состоит из десятков компаний разного масштаба, от семейных фирм с одним проектом до девелоперов с полувековой историей и портфелем в десятки комплексов. Мы работаем напрямую с 22 застройщиками, чьи актуальные проекты представлены в нашей базе, — от Лимассола, где сосредоточена значительная часть предложения, до Пафоса и Ларнаки.",
      ),
      empty(),
      para(
        `На момент публикации в нашей базе — ${totalProjects} активных проектов от этих застройщиков. Ниже — по districts и специализации, чтобы было проще сориентироваться, если вы уже выбираете конкретный город или тип недвижимости.`,
      ),
    ],
  };

  const limassolSection = {
    _key: key(), _type: "textContent", textAlign: "left",
    content: [
      h2("Застройщики в Лимассоле"),
      empty(),
      para(
        "Лимассол — деловой и инвестиционный центр острова, и именно здесь сосредоточена наиболее плотная застройка премиального сегмента: высотные комплексы у моря, апартаменты с видом на город и виллы в престижных пригородах вроде Агиос-Тихонас и Гермасойя.",
      ),
      empty(),
      ...limassolHeavy.map((slug) => devLine(slug)).filter(Boolean),
    ],
  };

  const paphosSection = {
    _key: key(), _type: "textContent", textAlign: "left",
    content: [
      h2("Застройщики в Пафосе"),
      empty(),
      para(
        "Пафос — самый насыщенный по числу активных застройщиков район в нашей базе: здесь работает больше девелоперов, чем в любом другом городе острова, преимущественно в сегменте вилл и малоэтажных резиденций.",
      ),
      empty(),
      ...paphosHeavy.map((slug) => devLine(slug)).filter(Boolean),
    ],
  };

  const islandWideSection = {
    _key: key(), _type: "textContent", textAlign: "left",
    content: [
      h2("Крупные застройщики по всему острову"),
      empty(),
      para(
        "Несколько девелоперов работают сразу в нескольких городах и выделяются масштабом или историей на рынке:",
      ),
      empty(),
      ...islandWide.map((slug) => devLine(slug)).filter(Boolean),
      empty(),
      para(
        "Aristo Developers — с более чем 40-летней историей и сотнями реализованных проектов в Пафосе, Лимассоле и Никосии — один из самых узнаваемых брендов на кипрском рынке недвижимости; Domenica Group работает на острове больше 60 лет.",
      ),
    ],
  };

  const howToChoose = {
    _key: key(), _type: "textContent", textAlign: "left",
    content: [
      h2("Как выбрать застройщика на Кипре"),
      empty(),
      para(
        "Список выше — это ориентир по масштабу и географии, а не гарантия качества конкретного проекта: у каждого застройщика внутри портфеля есть более и менее удачные комплексы. Прежде чем вносить задаток, стоит проверить конкретного застройщика по формальным признакам — сданные ранее проекты, статус титулов собственности и лицензии.",
      ),
      empty(),
      paraWithLink(
        "Подробный чек-лист именно для такой проверки — в статье ",
        "«Как проверить застройщика на Кипре: сданные проекты, титулы и тревожные признаки»",
        "/ru/blog/kak-proverit-zastroyshchika-na-kipre",
        ".",
      ),
      empty(),
      para(
        "Все объекты в нашей базе продаются напрямую от застройщика — без агентской комиссии для покупателя и с официальной ценой девелопера.",
      ),
    ],
  };

  const bridge = {
    _key: key(), _type: "textContent", textAlign: "left",
    content: [
      h2("Что дальше"),
      empty(),
      linkBullet("Смотреть текущие предложения в Лимассоле — ", "инвестиционная недвижимость в Лимассоле", "/ru/investment-properties-limassol"),
      linkBullet("Полный процесс покупки, шаг за шагом — ", "как купить недвижимость на Кипре", "/ru/blog/kak-kupit-nedvizhimost-na-kipre"),
      linkBullet("Расходы на сделку — ", "сколько реально стоит покупка недвижимости на Кипре", "/ru/blog/stoimost-pokupki-nedvizhimosti-na-kipre"),
    ],
  };

  const faq = {
    _key: key(), _type: "faqBlock", marginBottom: "medium",
    faq: {
      _type: "accordionBlock",
      items: [
        { _key: key(), question: "Сколько застройщиков работает на Кипре?", answer: [para(`Рынок Кипра насчитывает несколько десятков застройщиков разного масштаба. Мы работаем напрямую с 22 из них — от крупных девелоперов с полувековой историей до нишевых компаний, специализирующихся на конкретном районе.`)] },
        { _key: key(), question: "Какие застройщики строят в Лимассоле?", answer: [para("В Лимассоле активно работают BBF, Square One, Cybarco, Imperio Properties и Sol Properties, а также ряд девелоперов с точечными проектами в городе, включая AGG Luxury Homes и Leptos Estates.")] },
        { _key: key(), question: "Какой застройщик на Кипре самый крупный?", answer: [para("По числу активных проектов в нашей базе — BBF (23 проекта, преимущественно в Лимассоле) и Aristo Developers (18 проектов в Пафосе, более 40 лет на рынке).")] },
        { _key: key(), question: "Можно ли купить недвижимость напрямую у застройщика на Кипре?", answer: [para("Да, и это стандартная практика — все объекты в нашей базе продаются напрямую от застройщика, без дополнительной агентской комиссии для покупателя.")] },
        { _key: key(), question: "Как проверить застройщика перед покупкой?", answer: [para("Нужно проверить сданные ранее проекты, статус выдачи титулов собственности по ним и действующую лицензию. Подробный чек-лист — в отдельной статье о проверке застройщика.")] },
      ],
    },
  };

  const closing = {
    _key: key(), _type: "textContent", textAlign: "left",
    content: [
      para(
        "Если не уверены, какой застройщик и район подойдут именно вам — напишите нам бюджет и цель покупки, и мы подберём несколько актуальных вариантов из работающих напрямую девелоперов.",
      ),
    ],
  };

  const form = {
    _key: key(), _type: "formMinimalBlock", title: "Подобрать застройщика под ваш бюджет", buttonText: "Оставить заявку", marginBottom: "large",
    form: { _ref: "e55035e3-bfdb-4b2d-b74f-bfac3c851ce8", _type: "reference" },
  };

  const contentBlocks = [intro, limassolSection, paphosSection, islandWideSection, howToChoose, bridge, faq, closing, form];

  const created = await prisma.blog.create({
    data: {
      sanityId: `local-${crypto.randomUUID()}`,
      language: "ru",
      slug: SLUG,
      title: "Застройщики Кипра: полный список по городам — Лимассол, Пафос и другие",
      excerpt: "22 застройщика, с которыми мы работаем напрямую, по городам и специализации — от Лимассола и Пафоса до крупных девелоперов с проектами по всему острову.",
      status: "DRAFT",
      authorId: AUTHOR_ID,
      categoryId: CATEGORY_ID,
      seo: {
        metaTitle: "Застройщики Кипра: список по городам — Лимассол, Пафос",
        metaDescription: "Полный список застройщиков недвижимости на Кипре по городам: Лимассол, Пафос и другие районы. Продажа напрямую от девелопера, без агентской комиссии.",
      },
      contentBlocks,
    },
  });

  const relatedSlugs = ["kak-proverit-zastroyshchika-na-kipre", "kak-kupit-nedvizhimost-na-kipre", "stoimost-pokupki-nedvizhimosti-na-kipre"];
  const relatedRefs = [];
  for (const slug of relatedSlugs) {
    const b = await prisma.blog.findUnique({ where: { language_slug: { language: "ru", slug } }, select: { sanityId: true } });
    if (!b) { console.log(`WARNING: related post ${slug} not found, skipping.`); continue; }
    relatedRefs.push({ _key: key(), _ref: b.sanityId, _type: "reference" });
  }
  await prisma.blog.update({ where: { id: created.id }, data: { relatedArticles: relatedRefs } });

  console.log("Created DRAFT blog post:");
  console.log("  id:", created.id);
  console.log("  slug:", created.slug);
  console.log("  status:", created.status);
  console.log("  admin edit URL: /admin/content/blog/" + created.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
