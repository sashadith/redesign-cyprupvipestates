/* Moves six German guide articles into the Ratgeber section AND drops the year from their slug, then repoints every
   internal link at the new URL (DE rows only; Hebrew is never touched).
     node scripts/guides/rename-de-guides-2026-11-04.mjs                         dry run
     node scripts/guides/rename-de-guides-2026-11-04.mjs --apply <backupDir>     writes
     node scripts/guides/rename-de-guides-2026-11-04.mjs --restore <backupDir>   puts category, slug and links back
   RUN ONLY AFTER DE_BLOG_RENAMES (src/middleware.ts) is deployed: with --apply the script refuses to run until each live
   old /de/blog URL already answers a 301 to the new /de/ratgeber URL, so the rename can never open a 404 gap. */
import fs from "node:fs";
import path from "node:path";

for (const line of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const [mode, dir] = process.argv.slice(2);
const apply = mode === "--apply", restore = mode === "--restore";
if ((apply || restore) && !dir) { console.error("a backup directory is required"); process.exit(2); }

// old slug -> new slug and guide category key (src/lib/guideCategories.json)
const RENAMES = [
  ["steuern-auf-zypern-privatpersonen-2026", "steuern-auf-zypern-privatpersonen", "tax"],
  ["einkommensteuer-zypern-2026-stufen-beispiele", "einkommensteuer-zypern-stufen-beispiele", "tax"],
  ["non-dom-status-zypern-2026", "non-dom-status-zypern", "tax"],
  ["kapitalertraege-dividenden-krypto-zypern-2026", "kapitalertraege-dividenden-krypto-zypern", "tax"],
  ["selbstaendig-auf-zypern-steuern-sozialabgaben-2026", "selbstaendig-auf-zypern-steuern-sozialabgaben", "tax"],
  ["rentner-zypern-rente-steuern-krankenversicherung-2026", "rentner-zypern-rente-steuern-krankenversicherung", "life"],
];

if (restore) {
  const rowsFile = path.join(dir, "rows.json");
  for (const r of JSON.parse(fs.readFileSync(rowsFile, "utf8"))) await prisma.blog.update({ where: { id: r.id }, data: { categoryId: r.categoryBefore, slug: r.slugBefore } });
  for (const f of fs.readdirSync(dir).filter((f) => f.startsWith("links-"))) {
    const b = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    await prisma[b.model].update({ where: { id: b.id }, data: b.before });
  }
  console.log("restored");
  await prisma.$disconnect();
  process.exit(0);
}

const cats = JSON.parse(fs.readFileSync(new URL("../../src/lib/guideCategories.json", import.meta.url), "utf8"));
const target = {};
for (const c of cats) target[c.key] = await prisma.category.findUnique({ where: { language_slug: { language: "de", slug: c.de.slug } } });

const rows = [];
for (const [oldSlug, newSlug, key] of RENAMES) {
  const r = await prisma.blog.findUnique({ where: { language_slug: { language: "de", slug: oldSlug } }, select: { id: true, slug: true, categoryId: true, status: true } });
  if (!r) { console.log(`skip ${oldSlug}: no such DE row (already renamed?)`); continue; }
  if (await prisma.blog.findUnique({ where: { language_slug: { language: "de", slug: newSlug } } })) { console.log(`new slug taken: ${newSlug}`); process.exit(1); }
  if (apply) {
    const res = await fetch(`https://cyprusvipestates.com/de/blog/${oldSlug}`, { redirect: "manual" });
    const loc = res.headers.get("location") || "";
    if (res.status !== 301 || !loc.endsWith(`/de/ratgeber/${newSlug}`)) { console.log(`REFUSING: live /de/blog/${oldSlug} answers ${res.status} ${loc}; deploy the redirect first`); process.exit(2); }
  }
  console.log(`${apply ? "move" : "would move"} ${oldSlug} -> /de/ratgeber/${newSlug} (${key})`);
  rows.push({ id: r.id, oldSlug, newSlug, to: target[key].id, categoryBefore: r.categoryId, slugBefore: r.slug });
}

const swap = (n, c) => {
  if (typeof n === "string") {
    let s = n;
    for (const x of rows) { const re = new RegExp(`((?:https://cyprusvipestates\\.com)?)/de/blog/${x.oldSlug.replace(/-/g, "\\-")}(?![\\w-])`, "g"); const k = (s.match(re) || []).length; if (k) { c.n += k; s = s.replace(re, `$1/de/ratgeber/${x.newSlug}`); } }
    return s;
  }
  if (Array.isArray(n)) return n.map((x) => swap(x, c));
  if (n && typeof n === "object" && !(n instanceof Date)) return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, swap(v, c)]));
  return n;
};
if (apply) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "rows.json"), JSON.stringify(rows)); }
let links = 0;
for (const model of ["blog", "singlepage"]) {
  for (const r of await prisma[model].findMany({ where: { language: "de" } })) {
    const data = {}; let hits = 0;
    for (const col of ["contentBlocks", "seo", "excerpt"]) { if (!(col in r)) continue; const c = { n: 0 }; const nv = swap(r[col], c); if (c.n) { data[col] = nv; hits += c.n; } }
    if (!hits) continue;
    links += hits;
    console.log(`${apply ? "repoint" : "would repoint"} ${model} ${r.slug} (${hits})`);
    if (apply) {
      fs.writeFileSync(path.join(dir, `links-${model}-${r.id}.json`), JSON.stringify({ model, id: r.id, before: Object.fromEntries(Object.keys(data).map((k) => [k, r[k]])) }));
      await prisma[model].update({ where: { id: r.id }, data });
    }
  }
}
if (apply) for (const x of rows) await prisma.blog.update({ where: { id: x.id }, data: { categoryId: x.to, slug: x.newSlug } });
console.log(`${rows.length} article(s) ${apply ? "renamed and moved" : "to rename and move"}, ${links} link(s) ${apply ? "repointed" : "to repoint"}`);
await prisma.$disconnect();
