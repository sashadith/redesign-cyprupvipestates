/* One-off copy fixes on the 404 page's CMS documents.

   en — two typos that were live on every not-found page:
     "had its name changer"      -> "had its name changed"
     "is tomporaty unavailable"  -> "is temporarily unavailable"

   pl — missing comma closing the relative clause:
     "Strona, której szukasz mogła"  -> "Strona, której szukasz, mogła"

   de and ru were read at the same time and are correct, so they are not
   touched. Each entry matches on the exact broken sentence and is skipped if
   it does not match, so re-running after a fix is a no-op rather than a second
   rewrite. */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const FIXES = [
  {
    language: "en",
    broken:
      "The page you are looking for might have been removed, had its name changer, or is tomporaty unavailable.",
    fixed:
      "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.",
  },
  {
    language: "pl",
    broken:
      "Strona, której szukasz mogła zostać usunięta, zmieniono jej nazwę lub jest tymczasowo niedostępna.",
    fixed:
      "Strona, której szukasz, mogła zostać usunięta, zmieniono jej nazwę lub jest tymczasowo niedostępna.",
  },
];

const prisma = new PrismaClient();

for (const fix of FIXES) {
  const row = await prisma.siteDocument.findUnique({
    where: { type_language: { type: "notFoundPage", language: fix.language } },
  });
  if (!row) {
    console.log(`${fix.language}: no notFoundPage document — skipped.`);
    continue;
  }

  const data = row.data ?? {};
  if (data.description !== fix.broken) {
    console.log(`${fix.language}: already correct (or changed since) — skipped.`);
    console.log(`   ${data.description}`);
    continue;
  }

  await prisma.siteDocument.update({
    where: { id: row.id },
    data: { data: { ...data, description: fix.fixed } },
  });
  console.log(`${fix.language}: fixed`);
  console.log(`   before: ${fix.broken}`);
  console.log(`   after:  ${fix.fixed}`);
}

await prisma.$disconnect();
