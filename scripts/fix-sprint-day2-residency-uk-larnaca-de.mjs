// October Content Calendar — sprint day 2 (Thu 01.10.2026)
// A) how-to-get-cyprus-residency-if-you-re-not-an-eu-citizen: H3 "2. Permanent
//    Residency by Investment (Regulation 6.2" is truncated mid-sentence, live-
//    confirmed rendering with an unclosed parenthesis.
// B) UK/Brexit cluster: why-uk-citizens-invest-in-cyprus-real-estate-post-brexit
//    already links to how-to-move-to-cyprus-from-the-uk, but not the reverse —
//    close the silo (unshifted into the 3-item display cap, dropping the least
//    topically-aligned existing ref: the >€1M luxury-villas page).
// C) investment-property-larnaca: already ranks well (mostly page 1) except
//    "property investment in larnaca" (pos 36-37) — the H2 says "Investment
//    Properties" not "Property Investment"; swap word order to match.
// D) krankenversicherung-auf-zypern: solid content already at pos 8-23 (DE),
//    only 3 inbound links — add 3 more from topically relevant DE pages that
//    currently have zero related-article links of their own.
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const newKey = () => Math.random().toString(36).slice(2, 12);

async function main() {
  // --- A) fix truncated H3 ---
  const nonEu = await prisma.blog.findFirst({
    where: { slug: "how-to-get-cyprus-residency-if-you-re-not-an-eu-citizen", language: "en" },
    select: { id: true, contentBlocks: true },
  });
  if (!nonEu) throw new Error("ABORT: non-EU residency page not found");
  const OLD_H3 = "2. Permanent Residency by Investment (Regulation 6.2";
  const NEW_H3 = "2. Permanent Residency by Investment (Regulation 6.2)";
  let h3Fixed = false;
  const nonEuBlocks = nonEu.contentBlocks.map((b) => {
    if (b._type !== "textContent" || !Array.isArray(b.content)) return b;
    const content = b.content.map((c) => {
      if (c._type === "block" && c.style === "h3" && Array.isArray(c.children)) {
        const text = c.children.map((x) => x.text).join("");
        if (text === OLD_H3) {
          h3Fixed = true;
          return { ...c, children: c.children.map((child, i) => (i === 0 ? { ...child, text: NEW_H3 } : child)) };
        }
      }
      return c;
    });
    return { ...b, content };
  });
  if (!h3Fixed) throw new Error(`ABORT: H3 "${OLD_H3}" not found`);
  await prisma.blog.update({ where: { id: nonEu.id }, data: { contentBlocks: nonEuBlocks } });
  console.log("A) non-EU residency page: truncated H3 closed");

  // --- B) UK/Brexit reciprocal link ---
  const ukMove = await prisma.blog.findFirst({
    where: { slug: "how-to-move-to-cyprus-from-the-uk", language: "en" },
    select: { id: true, relatedArticles: true },
  });
  const whyUk = await prisma.blog.findFirst({
    where: { slug: "why-uk-citizens-invest-in-cyprus-real-estate-post-brexit", language: "en" },
    select: { sanityId: true },
  });
  if (!ukMove || !whyUk) throw new Error("ABORT: UK/Brexit pages not found");
  const ukRefs = ukMove.relatedArticles || [];
  if (ukRefs.some((r) => r._ref === whyUk.sanityId)) {
    console.log("B) SKIPPED: how-to-move-to-cyprus-from-the-uk already links to why-uk-citizens...");
  } else {
    const withoutLuxuryVillas = ukRefs.filter((r) => r._ref !== "single-luxury-villas-in-cyprus-over-1-million-euros.en");
    const updated = [{ _key: newKey(), _ref: whyUk.sanityId, _type: "reference" }, ...withoutLuxuryVillas].slice(0, 3);
    await prisma.blog.update({ where: { id: ukMove.id }, data: { relatedArticles: updated } });
    console.log("B) how-to-move-to-cyprus-from-the-uk now links back to why-uk-citizens-invest...");
  }

  // --- C) Larnaca H2 word-order fix ---
  const larnaca = await prisma.singlepage.findFirst({
    where: { slug: "investment-property-larnaca", language: "en" },
    select: { id: true, contentBlocks: true },
  });
  if (!larnaca) throw new Error("ABORT: investment-property-larnaca not found");
  const OLD_H2 = "Types of Investment Properties in Larnaca";
  const NEW_H2 = "Types of Property Investment in Larnaca";
  let h2Fixed = false;
  const larnacaBlocks = larnaca.contentBlocks.map((b) => {
    // landingTextFirst/landingTextSecond are the block's _type, not a key holding
    // the array — the portable-text blocks live under .content either way.
    if ((b._type !== "landingTextFirst" && b._type !== "landingTextSecond") || !Array.isArray(b.content)) return b;
    const content = b.content.map((c) => {
      if (c._type === "block" && c.style === "h2" && Array.isArray(c.children)) {
        const text = c.children.map((x) => x.text).join("");
        if (text === OLD_H2) {
          h2Fixed = true;
          return { ...c, children: c.children.map((child, i) => (i === 0 ? { ...child, text: NEW_H2 } : child)) };
        }
      }
      return c;
    });
    return { ...b, content };
  });
  if (!h2Fixed) throw new Error(`ABORT: H2 "${OLD_H2}" not found`);
  await prisma.singlepage.update({ where: { id: larnaca.id }, data: { contentBlocks: larnacaBlocks } });
  console.log("C) investment-property-larnaca: H2 reworded to 'Types of Property Investment in Larnaca'");

  // --- D) DE health-insurance inbound links ---
  const kv = await prisma.blog.findFirst({
    where: { slug: "krankenversicherung-auf-zypern", language: "de" },
    select: { sanityId: true },
  });
  if (!kv) throw new Error("ABORT: krankenversicherung-auf-zypern not found");
  const linkerSlugs = ["zypern-oder-griechenland", "zypern-oder-tuerkei", "lebenshaltungskosten-auf-zypern"];
  const linkers = await prisma.blog.findMany({ where: { slug: { in: linkerSlugs }, language: "de" }, select: { id: true, slug: true, relatedArticles: true } });
  if (linkers.length !== 3) throw new Error(`ABORT: expected 3 DE linker pages, found ${linkers.length}`);
  for (const p of linkers) {
    if (p.relatedArticles !== null) {
      console.log(`D) SKIPPED ${p.slug}: already has relatedArticles`);
      continue;
    }
    await prisma.blog.update({
      where: { id: p.id },
      data: { relatedArticles: [{ _key: newKey(), _ref: kv.sanityId, _type: "reference" }] },
    });
    console.log(`D) ${p.slug} now links to krankenversicherung-auf-zypern`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
