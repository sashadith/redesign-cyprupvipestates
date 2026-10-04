/* Content Offensive Plan — inserts the 3 uploaded images into all 4
   language versions of the banking-account DRAFT article:
   - illustration: right after the opening paragraph, as a hero image
   - 5-steps infographic: right before the "choose your bank" step section
   - bank-comparison infographic: right after the bank comparison table
   Position is found by matching each block's own distinctive text rather
   than a hardcoded index, since DE/RU carry extra sections (anonymous-
   account answer, RU sensitive section) that shift indices between
   languages. */
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const key = () => `img${Math.random().toString(36).slice(2, 10)}`;

const refs = JSON.parse(fs.readFileSync(new URL("../scratchpad/uploaded-image-refs.json", import.meta.url), "utf8"));
const byPath = Object.fromEntries(refs.map((r) => [r.path, r]));
const illustration = byPath["scratchpad/banking-illustration.png"];
const steps5 = byPath["scratchpad/infographic-5-steps.png"];
const bankComparison = byPath["scratchpad/infographic-bank-comparison.png"];

function imageFullBlock(ref, alt, aspectRatio) {
  return {
    _key: key(), _type: "imageFullBlock", title: "",
    imageMain: { picture: { alt, _type: "image", asset: { _ref: ref, _type: "reference" } }, aspectRatio },
    hasDescription: false,
  };
}

const ROWS = [
  { lang: "en", id: "b7d0574c-b5ed-4e18-b7c8-dfa5674d380d", stepMarker: "Step 1: choose your bank" },
  { lang: "de", id: "3e9dbbb4-c74b-4ceb-95ec-dc970afac1bb", stepMarker: "Schritt 1: die Bank wählen" },
  { lang: "pl", id: "5476a35e-daf1-4634-85a2-d7019e9598c3", stepMarker: "Krok 1: wybór banku" },
  { lang: "ru", id: "93ca09f6-f138-4b84-9088-62624a9dedd6", stepMarker: "Шаг 1: выбор банка" },
];

function blockText(b) {
  if (b._type !== "textContent" || !Array.isArray(b.content)) return "";
  return b.content.map((c) => (c.children || []).map((ch) => ch.text).join("")).join(" ");
}

async function main() {
  for (const row of ROWS) {
    const rec = await prisma.blog.findUnique({ where: { id: row.id } });
    if (!rec) throw new Error(`ABORT: ${row.lang} row not found`);
    if (rec.status !== "DRAFT") throw new Error(`ABORT: ${row.lang} status is ${rec.status}, not DRAFT`);
    const blocks = rec.contentBlocks;

    if (blocks.some((b) => b._type === "imageFullBlock")) {
      console.log(`SKIPPED ${row.lang}: already has imageFullBlock(s)`);
      continue;
    }

    const stepIdx = blocks.findIndex((b) => blockText(b).includes(row.stepMarker));
    const tableIdx = blocks.findIndex((b) => b._type === "tableBlock");
    if (stepIdx === -1 || tableIdx === -1) throw new Error(`ABORT: ${row.lang} couldn't find step marker (${stepIdx}) or table (${tableIdx})`);

    const heroImg = imageFullBlock(illustration.ref, illustration.alt, "16:9");
    const stepsImg = imageFullBlock(steps5.ref, steps5.alt, "16:9");
    const compareImg = imageFullBlock(bankComparison.ref, bankComparison.alt, "16:9");

    // Insert from the back so earlier indices stay valid.
    const out = [...blocks];
    out.splice(tableIdx + 1, 0, compareImg); // after the comparison table
    out.splice(stepIdx, 0, stepsImg); // right before "Step 1: choose your bank"
    out.splice(1, 0, heroImg); // right after the opening paragraph (index 0)

    await prisma.blog.update({ where: { id: row.id }, data: { contentBlocks: out } });
    console.log(`${row.lang}: inserted 3 image blocks (hero after intro, 5-steps before step section, comparison after table)`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
