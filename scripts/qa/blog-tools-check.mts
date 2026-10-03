// Testbed verification for the blog MCP tools (2026-10-03). Runs the three
// tool libraries directly against whatever DATABASE_URL points at — which
// must be the disposable testbed DB (/opt/cvp-testbed, DEPLOYMENT.md):
//
//   cd /opt/cvp-testbed/repo && set -a && source /opt/cvp-testbed/.env.testbed && set +a
//   npx tsx scripts/qa/blog-tools-check.mts [en-slug]        # default: apartment-or-villa-in-cyprus
//
// Read-only on the DB; the only network calls are HEAD requests to the live
// site to prove the four locale URLs resolve. Exits 1 on the first failed
// assertion. The guard import below refuses to run against the production DB.
// @ts-expect-error — plain .mjs module without a declaration file
import { assertNotProdDb } from "../assert-not-prod-db.mjs";
assertNotProdDb(); // aborts unless DATABASE_URL is the disposable testbed DB (or CVP_ALLOW_PROD_DB=1 for a disclosed read-only run)
import { prisma } from "@/lib/prisma";
import { BLOG_LOCALES, groupArticles, listEntry, localeUrls, type ArticleRow } from "@/lib/blog/articleUrls";
import { contentBlocksToMarkdown, extractSources } from "@/lib/blog/blocksToMarkdown";
import { socialTraffic } from "@/lib/blog/socialTraffic";

const EXPECTED_EN = Number(process.env.BLOG_EXPECTED_EN ?? 49);
const SLUG = process.argv[2] ?? "apartment-or-villa-in-cyprus";

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) failures++;
};

const select = { id: true, language: true, slug: true, title: true, status: true, seo: true, publishedAt: true, updatedAt: true, translationGroupId: true, category: { select: { slug: true, title: true } } } as const;

// 1. list
const rows = (await prisma.blog.findMany({ where: { status: "PUBLISHED", language: { in: [...BLOG_LOCALES] } }, select })) as ArticleRow[];
const entries = groupArticles(rows).map(listEntry);
const enCount = entries.filter((e) => e.locales.en !== "missing").length;
check(enCount === EXPECTED_EN, `blog_list_articles: ${enCount} articles with EN (expected ${EXPECTED_EN}); ${entries.length} articles in total`);
const byLocale = Object.fromEntries(BLOG_LOCALES.map((l) => [l, entries.filter((e) => e.locales[l] !== "missing").length]));
console.log("  published by locale:", JSON.stringify(byLocale));
const badEntries = entries.filter((e) => BLOG_LOCALES.some((l) => { const v = e.locales[l]; return v !== "missing" && (!v.url || !v.title); }));
check(badEntries.length === 0, `every present locale has a non-empty title and a URL (${badEntries.length} violations${badEntries.length ? ": " + badEntries.map((e) => e.slug).join(", ") : ""})`);
const enHosts = entries.map((e) => e.locales.en).filter((v): v is Exclude<typeof v, "missing"> => v !== "missing");
check(enHosts.every((v) => v.url.startsWith("https://cyprusvipestates.com/blog/")), "EN URLs have no locale prefix");
check(entries.every((e) => (["de", "pl", "ru"] as const).every((l) => { const v = e.locales[l]; return v === "missing" || v.url.startsWith(`https://cyprusvipestates.com/${l}/blog/`); })), "DE/PL/RU URLs carry their locale prefix");

// 2. get_article
const row = await prisma.blog.findFirst({ where: { language: "en", slug: SLUG, status: "PUBLISHED" }, select: { ...select, contentBlocks: true, excerpt: true } });
check(!!row, `blog_get_article: "${SLUG}" exists in EN`);
if (row) {
  const siblings = row.translationGroupId
    ? ((await prisma.blog.findMany({ where: { translationGroupId: row.translationGroupId, status: "PUBLISHED", language: { in: [...BLOG_LOCALES] } }, select })) as ArticleRow[])
    : [row as unknown as ArticleRow];
  const [group] = groupArticles(siblings);
  const entry = listEntry(group);
  const urls = localeUrls(group);
  console.log("  urls:", JSON.stringify(urls));
  for (const l of BLOG_LOCALES) {
    const v = entry.locales[l];
    check(v === "missing" || (typeof v.title === "string" && v.title.length > 0), `${l}: ${v === "missing" ? "missing (no published translation)" : `title "${v.title}"`}`);
  }
  const body = contentBlocksToMarkdown(row.contentBlocks);
  const { sources, internalLinks } = extractSources(body.links);
  check(body.markdown.length > 500, `body is ${body.markdown.length} chars / ${body.wordCount} words of Markdown`);
  check(!/<[a-z][\s\S]*?>/i.test(body.markdown), "body contains no HTML tags");
  check(/^## /m.test(body.markdown), "body keeps headings");
  console.log(`  sources (${sources.length}):`, sources.map((s) => `${s.text} → ${s.url}`).join(" | ") || "(none)");
  console.log(`  internal links: ${internalLinks.length}`);
  const present = BLOG_LOCALES.map((l) => urls[l]).filter((u): u is string => !!u);
  check(present.length === 4, `${present.length} of 4 locale URLs present`);
  for (const u of present) {
    let status = 0;
    try { status = (await fetch(u, { method: "HEAD", redirect: "manual" })).status; } catch { status = -1; }
    check(status === 200, `HEAD ${u} → ${status}`);
  }
}

// 3. social_traffic, last 30 days
const to = new Date();
const from = new Date(to.getTime() - 30 * 86_400_000);
const social = await socialTraffic({ from, to });
check(Array.isArray(social.articles) && typeof social.totals.linkedin.visits === "number", `blog_social_traffic (30 days): LinkedIn ${social.totals.linkedin.visits} visits / ${social.totals.linkedin.uniqueVisitors} unique, X ${social.totals.x.visits} / ${social.totals.x.uniqueVisitors}, leadsWithFirstTouchUtm ${JSON.stringify(social.totals.leadsWithFirstTouchUtm)}; ${social.articles.length} articles with social visits`);
for (const a of social.articles.slice(0, 5)) console.log(`  ${a.slug}: linkedin ${a.linkedin.visits}/${a.linkedin.uniqueVisitors}, x ${a.x.visits}/${a.x.uniqueVisitors}`);
const single = await socialTraffic({ from, to, slug: SLUG });
check(single.articles.length === 1 && single.articles[0].slug === SLUG, `blog_social_traffic for "${SLUG}" returns exactly that article (${single.articles[0]?.linkedin.visits ?? 0} LinkedIn / ${single.articles[0]?.x.visits ?? 0} X visits)`);

await prisma.$disconnect();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
