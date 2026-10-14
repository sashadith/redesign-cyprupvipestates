// Adds a "PDF guides" item to the About-us submenu of the header menu of en/de/pl/ru (Hebrew has no guides page).
// Usage: node scripts/guides/add-header-link.mjs <backup.json>            (dry run: prints what would change)
//        node scripts/guides/add-header-link.mjs <backup.json> --apply    (backs up the four header documents, then writes)
// The menu lives in the database (SiteDocument type "header"); links are stored WITHOUT a language prefix
// (the header adds it), so the slug is the page's own translated slug, e.g. "/ratgeber". Idempotent.
// The item goes into the About-us submenu, before Contacts. The owner can reorder or remove it in the admin.
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
    // The guides link is a submenu item of the "About us" entry (the top-level entry that has subLinks, found by its
    // /partners child since the About-us slug differs per language). A top-level copy from an earlier run is removed.
    const parent = links.find((l) => Array.isArray(l.subLinks) && l.subLinks.some((s) => s.link === "/partners"));
    if (!parent) { console.log(lang, "no About-us submenu found, skipped"); continue; }
    const topLevel = links.some((l) => l.link === item.link);
    if (!topLevel && parent.subLinks.some((s) => s.link === item.link)) { console.log(lang, "already in the submenu", item.link); continue; }
    const subs = parent.subLinks.filter((s) => s.link !== item.link);
    // before the last entry (Contacts), so Contacts stays at the bottom
    subs.splice(Math.max(subs.length - 1, 0), 0, { _key: Math.random().toString(16).slice(2, 14), link: item.link, label: item.label });
    const next = links.filter((l) => l.link !== item.link).map((l) => (l === parent ? { ...l, subLinks: subs } : l));
    plan.push({ lang, id: doc.id, data: { ...doc.data, navLinks: next }, summary: `${parent.label} > ${subs.map((l) => l.label).join(" | ")}` });
  }
  for (const p of plan) console.log(`${p.lang}: ${p.summary}`);
  if (!apply) { console.log(plan.length ? "\nDRY RUN, nothing written" : "\nnothing to do"); await prisma.$disconnect(); return; }
  fs.writeFileSync(backup, JSON.stringify(saved));
  for (const p of plan) await prisma.siteDocument.update({ where: { id: p.id }, data: { data: p.data } });
  console.log(`\nAPPLIED to ${plan.length} document(s); backup: ${backup}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
