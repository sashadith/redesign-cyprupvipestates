/* One-off copy fix: the in-article CTA on /de/blog/kapital-nach-zypern-transferieren
   said "Jetzt Beratung buchen" — booking implies a slot is being reserved,
   which the form does not do; it sends an enquiry. Changed to
   "Jetzt Beratung anfragen".

   Scoped to that single block on purpose. The other German posts carry their
   own editor-written CTAs ("Anfrage senden", "Jetzt Kontakt aufnehmen",
   "Vereinbaren Sie einen Beratungstermin", …) and are left alone — only this
   one used the wording in question.

   Idempotent: reports and exits if the new text is already in place, aborts if
   the current value is anything other than the known previous one. */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SLUG = "kapital-nach-zypern-transferieren";
const BEFORE = "Jetzt Beratung buchen";
const AFTER = "Jetzt Beratung anfragen";

const prisma = new PrismaClient();

const row = await prisma.blog.findFirst({
  where: { slug: SLUG, language: "de" },
  select: { id: true, contentBlocks: true },
});
if (!row) {
  console.log(`ABORT: /de/blog/${SLUG} not found.`);
  await prisma.$disconnect();
  process.exit(1);
}

const blocks = Array.isArray(row.contentBlocks) ? row.contentBlocks : [];
const idx = blocks.findIndex((b) => b?._type === "formMinimalBlock");
if (idx < 0) {
  console.log("ABORT: no formMinimalBlock on that post.");
  await prisma.$disconnect();
  process.exit(1);
}

const current = blocks[idx].buttonText;
if (current === AFTER) {
  console.log("already applied — nothing to do.");
  await prisma.$disconnect();
  process.exit(0);
}
if (current !== BEFORE) {
  console.log(`ABORT: buttonText is ${JSON.stringify(current)}, not the expected ${JSON.stringify(BEFORE)}.`);
  await prisma.$disconnect();
  process.exit(1);
}

const next = blocks.map((b, i) => (i === idx ? { ...b, buttonText: AFTER } : b));
await prisma.blog.update({ where: { id: row.id }, data: { contentBlocks: next } });

const after = await prisma.blog.findFirst({ where: { slug: SLUG, language: "de" }, select: { contentBlocks: true } });
const check = after.contentBlocks.find((b) => b?._type === "formMinimalBlock");
console.log(`before: ${JSON.stringify(BEFORE)}`);
console.log(`after:  ${JSON.stringify(check.buttonText)}`);
console.log(`blocks preserved: ${after.contentBlocks.length} (was ${blocks.length})`);

await prisma.$disconnect();
