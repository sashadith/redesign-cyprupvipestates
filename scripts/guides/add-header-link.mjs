// Adds a "PDF guides" item to the header menu of en/de/pl/ru (Hebrew has no guides page).
// Usage: node scripts/guides/add-header-link.mjs <backup.json>            (dry run: prints what would change)
//        node scripts/guides/add-header-link.mjs <backup.json> --apply    (backs up the four header documents, then writes)
// The menu lives in the database (SiteDocument type "header"); links are stored WITHOUT a language prefix
// (the header adds it), so the slug is the page's own translated slug, e.g. "/ratgeber". Idempotent.
// The item goes right after the blog entry ("/blog"). The owner can reorder or remove it in the admin.
import fs from "fs";

function loadEnv() {
  for (const line of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const ITEMS = {
  en: { link: "/guides", label: "PDF Guides" },
  de: { link: "/ratgeber", label: "PDF-Ratgeber" },
  pl: { link: "/poradniki", label: "Przewodniki PDF" },
  ru: { link: "/gajdy", label: "PDF-гайды" },
};

async function main() {
  const [backup, flag] = process.argv.slice(2);
  if (!backup) { console.error("usage: add-header-link.mjs <backup.json> [--apply]"); process.exit(2); }
  const apply = flag === "--apply";
  loadEnv();
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const saved = {};
  const plan = [];
  for (const [lang, item] of Object.entries(ITEMS)) {
    const doc = await prisma.siteDocument.findUnique({ where: { type_language: { type: "header", language: lang } } });
    if (!doc) { console.log(lang, "no header document, skipped"); continue; }
    const links = Array.isArray(doc.data?.navLinks) ? doc.data.navLinks : [];
    saved[lang] = { id: doc.id, data: doc.data };
    if (links.some((l) => l.link === item.link)) { console.log(lang, "already has", item.link); continue; }
    const at = links.findIndex((l) => l.link === "/blog");
    const next = [...links];
    next.splice(at >= 0 ? at + 1 : next.length, 0, { _key: Math.random().toString(16).slice(2, 14), link: item.link, label: item.label });
    plan.push({ lang, id: doc.id, data: { ...doc.data, navLinks: next }, summary: next.map((l) => l.label).join(" | ") });
  }
  for (const p of plan) console.log(`${p.lang}: ${p.summary}`);
  if (!apply) { console.log(plan.length ? "\nDRY RUN, nothing written" : "\nnothing to do"); await prisma.$disconnect(); return; }
  fs.writeFileSync(backup, JSON.stringify(saved));
  for (const p of plan) await prisma.siteDocument.update({ where: { id: p.id }, data: { data: p.data } });
  console.log(`\nAPPLIED to ${plan.length} document(s); backup: ${backup}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
