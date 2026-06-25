// Generates src/lib/nestedPageRedirects.json — a per-language map of every NESTED singlepage's
// leaf slug → its canonical "parent/child" path. The singlepage catch-all route matches a page by
// its leaf slug alone, so each nested page also resolves at a flat ("/leaf") or wrong-parent URL
// (duplicate content). The middleware uses this map to 308-redirect those to the canonical path.
//
// Page-level redirect()/notFound() are swallowed by the next-intl rewrite (see middleware.ts), so
// canonicalisation must happen in middleware — which is edge-bundled and cannot hit the DB. Hence
// this build-time map. Regenerate after any change to landing-page nesting:
//   node src/lib/genNestedRedirects.mjs   (run where DATABASE_URL + Prisma are available)
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const langs = ["en", "de", "pl", "ru"];
const out = {};

for (const lang of langs) {
  const rows = await prisma.singlepage.findMany({
    where: { language: lang, slug: { not: "" }, status: "PUBLISHED" },
    select: { slug: true, parentSanityId: true, sanityId: true },
  });
  const slugById = new Map(rows.map((r) => [r.sanityId, r.slug]));
  const items = rows.map((r) => ({
    current: r.slug,
    parent: r.parentSanityId ? slugById.get(r.parentSanityId) ?? undefined : undefined,
  }));
  // Same parent-chain resolution as getAllPathsForLang (the source the sitemap <loc> uses).
  const map = {};
  items.forEach(({ current, parent }) => { if (current && !parent) map[current] = [current]; });
  let added = true;
  while (added) {
    added = false;
    items.forEach(({ current, parent }) => {
      if (!current || !parent) return;
      if (map[parent] && !map[current]) { map[current] = [...map[parent], current]; added = true; }
    });
  }
  const nested = {};
  for (const segs of Object.values(map)) {
    if (segs.length >= 2) nested[segs[segs.length - 1]] = segs.join("/");
  }
  out[lang] = nested;
}

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, "nestedPageRedirects.json"), JSON.stringify(out, null, 2) + "\n");
console.log("wrote nestedPageRedirects.json:", Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.keys(v).length])));
await prisma.$disconnect();
