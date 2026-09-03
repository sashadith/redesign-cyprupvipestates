/* One-off copy fix: the English 404 description carried two typos that were
   live on every not-found page —

     "had its name changer"      -> "had its name changed"
     "is tomporaty unavailable"  -> "is temporarily unavailable"

   The de/pl/ru descriptions were checked at the same time and are correct, so
   only the English document is touched.

   Matches on the exact broken sentence and aborts if it is not found, so a
   re-run after the fix is a no-op rather than a second rewrite. */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const BROKEN =
  "The page you are looking for might have been removed, had its name changer, or is tomporaty unavailable.";
const FIXED =
  "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.";

const prisma = new PrismaClient();

const row = await prisma.siteDocument.findUnique({
  where: { type_language: { type: "notFoundPage", language: "en" } },
});

if (!row) {
  console.log("ABORT: no english notFoundPage document.");
  await prisma.$disconnect();
  process.exit(1);
}

const data = row.data ?? {};
if (data.description !== BROKEN) {
  console.log("nothing to do — description is not the known broken sentence:");
  console.log(`   ${data.description}`);
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.siteDocument.update({
  where: { id: row.id },
  data: { data: { ...data, description: FIXED } },
});

const after = await prisma.siteDocument.findUnique({
  where: { type_language: { type: "notFoundPage", language: "en" } },
});
console.log("before:", BROKEN);
console.log("after: ", after.data.description);

await prisma.$disconnect();
