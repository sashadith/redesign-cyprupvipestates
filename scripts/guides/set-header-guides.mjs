// Puts the guides section into the main menu of en/de/pl/ru (Hebrew has no guides section).
// Usage: node scripts/guides/set-header-guides.mjs <backup.json>                     (dry run: prints what would change)
//        node scripts/guides/set-header-guides.mjs <backup.json> --apply             (backs up the four header documents, then writes)
// The menu lives in the database (SiteDocument type "header"); links are stored WITHOUT a language prefix (the header adds it),
// so the link is the language's own guides slug (src/lib/guidesPage.ts). Adds, per language, a top-level "Guides" entry right
// after "Projects" (before the blog entry). The blog entry is not renamed and the "PDF guides" item of the About-us submenu
// (scripts/guides/add-header-link.mjs) stays as it is.
// Idempotent. The owner can reorder or rename the entries in the admin.
import fs from "fs";

for (const line of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const ITEMS = {
  en: { link: "/guides", label: "Guides" },
  de: { link: "/ratgeber", label: "Ratgeber" },
  pl: { link: "/poradniki", label: "Przewodniki" },
  ru: { link: "/gajdy", label: "Гиды" },
};

const [backup, ...flags] = process.argv.slice(2);
if (!backup) { console.error("usage: set-header-guides.mjs <backup.json> [--apply]"); process.exit(2); }
const apply = flags.includes("--apply");
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const saved = {};
const plan = [];
for (const [lang, item] of Object.entries(ITEMS)) {
  const doc = await prisma.siteDocument.findUnique({ where: { type_language: { type: "header", language: lang } } });
  if (!doc) { console.log(lang, "no header document, skipped"); continue; }
  let links = Array.isArray(doc.data?.navLinks) ? doc.data.navLinks : [];
  saved[lang] = { id: doc.id, data: doc.data };
  // The top-level entry, after "Projects" (a stale top-level copy is replaced; the About-us submenu item is untouched).
  links = links.filter((l) => l.link !== item.link);
  const at = links.findIndex((l) => l.link === "/projects");
  links.splice(at >= 0 ? at + 1 : 0, 0, { _key: Math.random().toString(16).slice(2, 14), link: item.link, label: item.label });
  plan.push({ lang, id: doc.id, data: { ...doc.data, navLinks: links }, summary: links.map((l) => l.label).join(" | ") });
}
for (const p of plan) console.log(`${p.lang}: ${p.summary}`);
if (!apply) { console.log("\nDRY RUN, nothing written"); await prisma.$disconnect(); process.exit(0); }
fs.writeFileSync(backup, JSON.stringify(saved));
for (const p of plan) await prisma.siteDocument.update({ where: { id: p.id }, data: { data: p.data } });
console.log(`\nAPPLIED to ${plan.length} document(s); backup: ${backup}`);
await prisma.$disconnect();
