// Moves the articles listed in moved-articles.json (a translation group each) from the blog to the guides section by giving
// every en/de/pl/ru row of the group the guide category of its topic. The URL changes from /blog/<slug> to the language's
// guides URL (src/lib/articleSections.ts); the old URL redirects. Content, slug, dates and translations are untouched.
// Hebrew rows are skipped. Run AFTER the guides section is deployed and the categories exist
// (create-guide-categories.mjs). Each changed row's previous categoryId is saved to the backup file, so a move is undone with
// --restore <backup.json>.
//   node scripts/guides/move-articles-to-guides.mjs                      dry run
//   node scripts/guides/move-articles-to-guides.mjs --apply <backup>     writes
//   node scripts/guides/move-articles-to-guides.mjs --restore <backup>   puts the old categories back
import fs from "node:fs";

for (const line of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const args = process.argv.slice(2);
const apply = args[0] === "--apply";
const restore = args[0] === "--restore";
const backupFile = args[1];
if ((apply || restore) && !backupFile) { console.error("a backup file path is required"); process.exit(2); }

if (restore) {
  const saved = JSON.parse(fs.readFileSync(backupFile, "utf8"));
  for (const r of saved) await prisma.blog.update({ where: { id: r.id }, data: { categoryId: r.before } });
  console.log(`restored ${saved.length} row(s)`);
  await prisma.$disconnect();
  process.exit(0);
}

const cats = JSON.parse(fs.readFileSync(new URL("../../src/lib/guideCategories.json", import.meta.url), "utf8"));
const list = JSON.parse(fs.readFileSync(new URL("./moved-articles.json", import.meta.url), "utf8"));
const target = {};
for (const c of cats) for (const lang of ["en", "de", "pl", "ru"]) {
  const row = await prisma.category.findUnique({ where: { language_slug: { language: lang, slug: c[lang].slug } } });
  if (!row) { console.error(`guide category missing: ${lang} ${c[lang].slug}; run create-guide-categories.mjs --apply first`); process.exit(1); }
  target[`${c.key}|${lang}`] = row;
}

const saved = [];
for (const item of list) {
  const rows = await prisma.blog.findMany({
    where: { translationGroupId: item.group, language: { in: ["en", "de", "pl", "ru"] } },
    select: { id: true, language: true, slug: true, status: true, categoryId: true, category: { select: { slug: true } } },
  });
  console.log(`\n${item.note}  [-> ${item.to}]`);
  for (const r of rows) {
    const to = target[`${item.to}|${r.language}`];
    const same = r.categoryId === to.id;
    console.log(`  ${r.language} ${r.status} ${r.slug}: ${r.category?.slug ?? "(none)"} -> ${to.slug}${same ? " (already)" : ""}`);
    if (same) continue;
    saved.push({ id: r.id, before: r.categoryId });
    if (apply) await prisma.blog.update({ where: { id: r.id }, data: { categoryId: to.id } });
  }
}
console.log(`\n${saved.length} row(s) ${apply ? "moved" : "to move"}`);
if (apply) { fs.writeFileSync(backupFile, JSON.stringify(saved)); console.log("backup:", backupFile); }
await prisma.$disconnect();
