/* Rewrites internal links to articles that moved from the blog to the guides section, in stored content.
 *
 *   node scripts/sweep-blog-links-to-guides.mjs            # dry run: counts per table, nothing written
 *   node scripts/sweep-blog-links-to-guides.mjs --apply    # writes, after saving a JSON backup of every changed row
 *
 * Which articles moved is decided by src/lib/articleSections.ts (the category's translationGroupId), read from the
 * database here with the same list. The old /blog/<slug> URL of a moved article keeps working (permanent redirect), so
 * this sweep only removes a hop; run it AFTER the guides routes are deployed: the new URLs 404 until then.
 *
 * Links are matched in any stored JSON text: "/blog/<slug>", "/de/blog/<slug>", with or without the site's origin.
 * A link whose slug is not a guide in that language (a blog article, or no article) is left alone.
 * Hebrew rows are skipped entirely. */
import fs from "node:fs";
import path from "node:path";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

// Keep in sync with src/lib/articleSections.ts and src/lib/guidesPage.ts.
const GUIDE_GROUPS = [
  "678f40ba-004f-48d1-95e9-8be5b03566cf", "a90f42e8-a9e4-4a61-8639-29fa6df09654", "0cb25ffc-8e3f-4e89-b663-b6d73d949ec0",
  "a3e8946e-8857-4c0f-a2bc-ab20c0abacd2", "696a0e69-d198-4af3-a296-e61776d6c56a",
];
const SLUG = { en: "guides", de: "ratgeber", pl: "poradniki", ru: "gajdy" };
const PREFIX = { en: "", de: "/de", pl: "/pl", ru: "/ru" };

const guideRows = await prisma.blog.findMany({
  where: { status: "PUBLISHED", language: { in: Object.keys(SLUG) }, category: { is: { translationGroupId: { in: GUIDE_GROUPS } } } },
  select: { language: true, slug: true },
});
const moved = new Map(guideRows.map((r) => [`${r.language}|${r.slug}`, true]));
console.log(`guide articles: ${guideRows.length}`);

// /blog/x (English: no prefix) or /<lang>/blog/x, optionally preceded by the site origin, ended by a non-slug character.
const RE = /((?:https?:\/\/(?:www\.)?cyprusvipestates\.com)?)(\/(?:de|pl|ru|he))?\/blog\/([A-Za-z0-9][A-Za-z0-9_-]*)/g;
function rewrite(text) {
  let n = 0;
  const out = text.replace(RE, (whole, origin, pfx, slug) => {
    const lang = pfx ? pfx.slice(1) : "en";
    if (!SLUG[lang] || !moved.has(`${lang}|${slug}`)) return whole;
    n++;
    return `${origin}${PREFIX[lang]}/${SLUG[lang]}/${slug}`;
  });
  return { out, n };
}

const TABLES = [
  { name: "blog", model: prisma.blog, fields: ["contentBlocks", "popularProperties", "videoBlock"] },
  { name: "singlepage", model: prisma.singlepage, fields: ["contentBlocks"] },
  { name: "caseStudy", model: prisma.caseStudy, fields: ["contentBlocks"] },
  { name: "siteDocument", model: prisma.siteDocument, fields: ["data"] },
];

const backup = [];
let total = 0;
for (const t of TABLES) {
  // Hebrew rows are never touched (standing rule), whatever they link to.
  const rows = (await t.model.findMany()).filter((r) => r.language !== "he");
  let changedRows = 0, changedLinks = 0;
  for (const row of rows) {
    const data = {};
    for (const f of t.fields) {
      if (row[f] == null) continue;
      const { out, n } = rewrite(JSON.stringify(row[f]));
      if (n) { data[f] = JSON.parse(out); changedLinks += n; }
    }
    if (!Object.keys(data).length) continue;
    changedRows++;
    backup.push({ table: t.name, id: row.id, before: Object.fromEntries(Object.keys(data).map((f) => [f, row[f]])) });
    if (apply) await t.model.update({ where: { id: row.id }, data });
  }
  console.log(`${t.name}: ${changedRows} row(s), ${changedLinks} link(s)${apply ? " written" : " (dry run)"}`);
  total += changedLinks;
}
if (apply && backup.length) {
  const file = path.join(process.cwd(), `sweep-blog-links-to-guides-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(backup));
  console.log("backup:", file);
}
console.log(`total links ${apply ? "rewritten" : "to rewrite"}: ${total}`);
await prisma.$disconnect();
