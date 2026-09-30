// October Content Calendar — sprint day 3 (Fri 02.10.2026)
// Limassol cluster diagnosis: NOT a linking problem like days 1-2 — genuine
// cannibalization. apartments-limassol, investment-properties-limassol and
// property-for-sale-limassol share near-identical H2 structure and buyer-
// persona copy ("investors, expats, families, holiday-home seekers" appears
// on all three), so Google has no real topical signal to pick a winner.
// Fix: sharpen each page's actual angle instead of adding more links.
//  A) stale "2025 data" -> 2026 on the two pages that still say it.
//  B) investment-properties-limassol: its "Types of Investment Properties"
//     H2 just re-lists apartments/villas/off-plan — the same job
//     apartments-limassol already does. Retitle toward the ROI/Golden-Visa
//     angle that's genuinely unique to this page.
//  C) property-for-sale-limassol is the most redundant of the three (mirrors
//     apartments-limassol's structure almost line for line). Reposition it
//     as the cluster's actual hub: insert a short comparison section, early,
//     that sends apartment-seekers and investors on to the specialized pages
//     instead of re-pitching the same inventory.
//  D) DE Auswandern cluster (wie-nach-zypern-auswandern, warum-wandern-so-
//     viele-nach-zypern-aus): same lever as krankenversicherung-auf-zypern
//     yesterday — solid content, starved of inbound links (1 each) while a
//     sibling page has 22. Borrow 4 of those 22 topically-adjacent DE pages.
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const newKey = () => Math.random().toString(36).slice(2, 12);

function replaceH2Text(contentBlocks, oldText, newText) {
  let fixed = false;
  const blocks = contentBlocks.map((b) => {
    if ((b._type !== "landingTextFirst" && b._type !== "landingTextSecond") || !Array.isArray(b.content)) return b;
    const content = b.content.map((c) => {
      if (c._type === "block" && c.style === "h2" && Array.isArray(c.children)) {
        const text = c.children.map((x) => x.text).join("");
        if (text === oldText) {
          fixed = true;
          return { ...c, children: c.children.map((child, i) => (i === 0 ? { ...child, text: newText } : child)) };
        }
      }
      return c;
    });
    return { ...b, content };
  });
  return { blocks, fixed };
}

function replaceInParagraph(contentBlocks, oldSubstr, newSubstr) {
  let count = 0;
  const blocks = contentBlocks.map((b) => {
    if ((b._type !== "landingTextFirst" && b._type !== "landingTextSecond") || !Array.isArray(b.content)) return b;
    const content = b.content.map((c) => {
      if (c._type === "block" && Array.isArray(c.children)) {
        const children = c.children.map((child) => {
          if (typeof child.text === "string" && child.text.includes(oldSubstr)) {
            count += 1;
            return { ...child, text: child.text.split(oldSubstr).join(newSubstr) };
          }
          return child;
        });
        return { ...c, children };
      }
      return c;
    });
    return { ...b, content };
  });
  return { blocks, count };
}

function para(text) {
  return { _key: newKey(), _type: "block", style: "normal", children: [{ _key: newKey(), _type: "span", text, marks: [] }], markDefs: [] };
}
function h2(text) {
  return { _key: newKey(), _type: "block", style: "h2", children: [{ _key: newKey(), _type: "span", text, marks: [] }], markDefs: [] };
}
// A paragraph made of plain-text segments and {text, href} link segments.
function paraWithLinks(segments) {
  const markDefs = [];
  const children = segments.map((seg) => {
    if (typeof seg === "string") return { _key: newKey(), _type: "span", text: seg, marks: [] };
    const key = newKey();
    markDefs.push({ _key: key, href: seg.href, _type: "link" });
    return { _key: newKey(), _type: "span", text: seg.text, marks: [key] };
  });
  return { _key: newKey(), _type: "block", style: "normal", children, markDefs };
}

async function main() {
  // --- A) stale year ---
  for (const slug of ["apartments-limassol", "property-for-sale-limassol"]) {
    const p = await prisma.singlepage.findFirst({ where: { slug, language: "en" }, select: { id: true, contentBlocks: true } });
    if (!p) throw new Error(`ABORT: ${slug} not found`);
    const { blocks, count } = replaceInParagraph(p.contentBlocks, "According to 2025 data", "According to 2026 data");
    if (count === 0) {
      console.log(`A) SKIPPED ${slug}: "According to 2025 data" not found (already fixed or wording changed)`);
    } else {
      await prisma.singlepage.update({ where: { id: p.id }, data: { contentBlocks: blocks } });
      console.log(`A) ${slug}: 2025 -> 2026 (${count} occurrence${count > 1 ? "s" : ""})`);
    }
  }

  // --- B) investment-properties-limassol H2 sharpen ---
  const inv = await prisma.singlepage.findFirst({ where: { slug: "investment-properties-limassol", language: "en" }, select: { id: true, contentBlocks: true } });
  if (!inv) throw new Error("ABORT: investment-properties-limassol not found");
  const OLD_INV_H2 = "Types of Investment Properties in Limassol";
  const NEW_INV_H2 = "Investment Property Formats and Expected Returns in Limassol";
  const { blocks: invBlocks, fixed: invFixed } = replaceH2Text(inv.contentBlocks, OLD_INV_H2, NEW_INV_H2);
  if (!invFixed) throw new Error(`ABORT: H2 "${OLD_INV_H2}" not found on investment-properties-limassol`);
  await prisma.singlepage.update({ where: { id: inv.id }, data: { contentBlocks: invBlocks } });
  console.log("B) investment-properties-limassol: H2 sharpened toward ROI/returns framing");

  // --- C) property-for-sale-limassol: insert comparison/hub section ---
  const hub = await prisma.singlepage.findFirst({ where: { slug: "property-for-sale-limassol", language: "en" }, select: { id: true, contentBlocks: true } });
  if (!hub) throw new Error("ABORT: property-for-sale-limassol not found");
  const HUB_MARKER = "Apartments vs. Investment Property in Limassol";
  const alreadyHasHub = hub.contentBlocks.some(
    (b) =>
      (b._type === "landingTextFirst" || b._type === "landingTextSecond") &&
      (b.content || []).some((c) => c.style === "h2" && (c.children || []).some((ch) => ch.text?.includes(HUB_MARKER))),
  );
  if (alreadyHasHub) {
    console.log("C) SKIPPED property-for-sale-limassol: hub section already present");
  } else {
    const newSection = [
      h2("Apartments vs. Investment Property in Limassol — Which Page Fits You?"),
      paraWithLinks([
        "This page covers the full Limassol market — apartments, villas and houses for any budget or purpose. If you already know what you're after, two more focused pages may save you time: browse our dedicated ",
        { text: "Apartments in Limassol for Sale", href: "/apartments-limassol" },
        " listing if you want inventory and pricing by apartment type, or see ",
        { text: "Investment Properties in Limassol", href: "/investment-properties-limassol" },
        " if your focus is rental yield, Golden Visa eligibility and property management.",
      ]),
    ];
    const blocksWithHub = hub.contentBlocks.map((b, idx) => {
      if (b._type !== "landingTextFirst") return b;
      // insert right after the opening paragraph (index 0), before the first H2.
      return { ...b, content: [b.content[0], ...newSection, ...b.content.slice(1)] };
    });
    await prisma.singlepage.update({ where: { id: hub.id }, data: { contentBlocks: blocksWithHub } });
    console.log("C) property-for-sale-limassol: hub/comparison section inserted, linking to the 2 specialized pages");
  }

  // --- D) DE Auswandern inbound links ---
  const wieNach = await prisma.blog.findFirst({ where: { slug: "wie-nach-zypern-auswandern", language: "de" }, select: { sanityId: true } });
  const warumWandern = await prisma.blog.findFirst({ where: { slug: "warum-wandern-so-viele-nach-zypern-aus", language: "de" }, select: { sanityId: true } });
  if (!wieNach || !warumWandern) throw new Error("ABORT: DE Auswandern target pages not found");

  const sources = [
    { slug: "immobilienmarkt-zypern-prognose", target: wieNach.sanityId },
    { slug: "ratgeber-fuer-deutsche-rentner", target: wieNach.sanityId },
    { slug: "immobilieninvestitionen-in-zypern-umfassende-leitfaden", target: warumWandern.sanityId },
    { slug: "wie-man-eine-daueraufenthaltserlaubnis-auf-zypern-erhaelt", target: warumWandern.sanityId },
  ];
  for (const { slug, target } of sources) {
    const p = await prisma.blog.findFirst({ where: { slug, language: "de" }, select: { id: true, relatedArticles: true } });
    if (!p) throw new Error(`ABORT: DE source page ${slug} not found`);
    const refs = p.relatedArticles || [];
    if (refs.some((r) => r._ref === target)) {
      console.log(`D) SKIPPED ${slug}: already links to target`);
      continue;
    }
    const trimmed = refs.slice(0, 2);
    const updated = [{ _key: newKey(), _ref: target, _type: "reference" }, ...trimmed];
    await prisma.blog.update({ where: { id: p.id }, data: { relatedArticles: updated } });
    console.log(`D) ${slug} now links to Auswandern target`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
