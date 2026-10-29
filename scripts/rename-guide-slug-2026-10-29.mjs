/* Rename the EN Category 6.2 guide's slug (it lost "golden visa" from title and text on 2026-10-29)
   and repoint every internal link at it.
   usage: node scripts/rename-guide-slug-2026-10-29.mjs [--apply]
   RUN ONLY AFTER the 301 (EN_BLOG_RENAMES in src/middleware.ts) is deployed: the script refuses to apply
   until the live old URL already answers a 301 to the new one, so the rename can never open a 404 gap.
   Hebrew rows are left alone (their link keeps working through the redirect). */
import fs from "node:fs";
import path from "node:path";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const OLD = "cyprus-permanent-residency-golden-visa-guide";
const NEW = "cyprus-permanent-residency-category-6-2-guide";
const BACKUP_DIR = process.env.BACKUP_DIR || "./rename-backups";

const row = await prisma.blog.findUnique({ where: { language_slug: { language: "en", slug: OLD } } });
if (!row) { console.log("EN row with the old slug not found (already renamed?)"); process.exit(0); }
if (await prisma.blog.findUnique({ where: { language_slug: { language: "en", slug: NEW } } })) { console.log("new slug already taken"); process.exit(1); }

if (apply) {
  const res = await fetch(`https://cyprusvipestates.com/blog/${OLD}`, { redirect: "manual" });
  const loc = res.headers.get("location") || "";
  if (res.status !== 301 || !loc.endsWith(`/blog/${NEW}`)) {
    console.log(`REFUSING: live old URL answers ${res.status} ${loc} - deploy the redirect first`);
    process.exit(2);
  }
}

function swap(n, c) {
  if (typeof n === "string") return n.includes(OLD) ? (c.n += n.split(OLD).length - 1, n.split(OLD).join(NEW)) : n;
  if (Array.isArray(n)) return n.map((x) => swap(x, c));
  if (n && typeof n === "object" && !(n instanceof Date)) return Object.fromEntries(Object.entries(n).map(([k, v]) => [k, swap(v, c)]));
  return n;
}
fs.mkdirSync(BACKUP_DIR, { recursive: true });
for (const model of ["blog", "singlepage"]) {
  const rows = await prisma[model].findMany({ where: { language: { not: "he" } } });
  for (const r of rows) {
    if (model === "blog" && r.id === row.id) continue;
    const data = {}; let hits = 0;
    for (const col of ["contentBlocks", "seo", "excerpt", "relatedArticles"]) {
      if (!(col in r)) continue;
      const c = { n: 0 }; const nv = swap(r[col], c);
      if (c.n) { data[col] = nv; hits += c.n; }
    }
    if (!hits) continue;
    console.log(`${apply ? "repoint" : "would repoint"} ${model} ${r.language} ${r.slug} (${hits})`);
    if (apply) {
      fs.writeFileSync(path.join(BACKUP_DIR, `${model}-${r.language}-${r.slug}.json`), JSON.stringify(Object.fromEntries(Object.keys(data).map((k) => [k, r[k]]))));
      await prisma[model].update({ where: { id: r.id }, data });
    }
  }
}
console.log(`${apply ? "rename" : "would rename"} blog en ${OLD} -> ${NEW}`);
if (apply) await prisma.blog.update({ where: { id: row.id }, data: { slug: NEW } });
await prisma.$disconnect();
