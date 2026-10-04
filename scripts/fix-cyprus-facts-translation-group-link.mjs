// Found while running the full site content inventory (step 1 of the new
// content-planning process, 2026-09-30): the 4 "Cyprus basic facts" pages
// written earlier this session (en/de/pl/ru) each had translationGroupId:
// null, despite being the same topic in all 4 languages. That field also
// drives the site's own language switcher (`translationsFor()` in
// sanity.utils.ts), so visitors on one language version had no working way
// to switch to another - a real UX bug, not just an inventory artifact.
import fs from "node:fs";
import crypto from "node:crypto";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TARGETS = [
  { slug: "cyprus-basic-facts", language: "en" },
  { slug: "zypern-fakten-grundlagen", language: "de" },
  { slug: "podstawowe-fakty-o-cyprze", language: "pl" },
  { slug: "osnovnye-fakty-o-kipre", language: "ru" },
];

async function main() {
  const rows = await prisma.blog.findMany({
    where: { OR: TARGETS.map((t) => ({ slug: t.slug, language: t.language })) },
    select: { id: true, slug: true, language: true, translationGroupId: true },
  });
  if (rows.length !== 4) throw new Error(`ABORT: expected 4 rows, found ${rows.length}`);
  if (rows.some((r) => r.translationGroupId !== null)) {
    console.log("SKIPPED: at least one row already has a translationGroupId, not overwriting");
    return;
  }
  const groupId = crypto.randomUUID();
  for (const r of rows) await prisma.blog.update({ where: { id: r.id }, data: { translationGroupId: groupId } });
  console.log("Linked 4 Cyprus-facts pages under translationGroupId", groupId);
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
