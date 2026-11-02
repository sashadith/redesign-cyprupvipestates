// Creates the four guide categories (src/lib/guideCategories.json) in en/de/pl/ru. An article in one of them lives in the
// guides section instead of the blog (src/lib/articleSections.ts). Additive and invisible on the site until an article uses
// a category; Hebrew gets none. Idempotent (a category that exists is left alone).
//   node scripts/guides/create-guide-categories.mjs            dry run
//   node scripts/guides/create-guide-categories.mjs --apply    writes
import fs from "node:fs";

for (const line of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const cats = JSON.parse(fs.readFileSync(new URL("../../src/lib/guideCategories.json", import.meta.url), "utf8"));

let made = 0;
for (const c of cats) {
  for (const lang of ["en", "de", "pl", "ru"]) {
    const { title, slug } = c[lang];
    const have = await prisma.category.findUnique({ where: { language_slug: { language: lang, slug } } });
    if (have) { console.log(`${lang} ${slug}: exists`); continue; }
    console.log(`${lang} ${slug}: ${apply ? "create" : "would create"} "${title}" (group ${c.group.slice(0, 8)})`);
    if (apply) await prisma.category.create({ data: { sanityId: `guide-category-${c.key}-${lang}`, translationGroupId: c.group, language: lang, title, slug } });
    made++;
  }
}
console.log(`${made} categor${made === 1 ? "y" : "ies"} ${apply ? "created" : "to create"}`);
await prisma.$disconnect();
