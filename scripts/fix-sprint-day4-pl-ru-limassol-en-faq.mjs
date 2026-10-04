// October Content Calendar — sprint day 4 (Mon 05.10.2026), fix items only
// (the RU developer-directory item is a separate new-content draft, see
// create-ru-zastroyshchiki-kipra-draft.mjs). Diagnosis found:
//  - RU "pereezd" page already healthy (pos 6.1, no action).
//  - RU Limassol cluster is NOT cannibalized like EN's, unlike the plan's
//    assumption — real gap is one orphan page + one under-linked page.
//  - villy-v-limassole-dlya-investicij's "empty blocks" are the site's own
//    normal paragraph-spacer convention, not a bug — verified against this
//    session's own content scripts before touching anything, no fix needed.
//  - Only 2 of the plan's 4 EN FAQ-schema targets actually lack FAQ schema
//    (how-to-buy and taxes already have it).
// A) PL residency: title/meta didn't contain "prawo stałego pobytu", the
//    exact top real query (168 impr/90d, pos 10, 0 clicks) — sharpen wording
//    + one more inbound link.
// B) RU Limassol: pafos-ili-limassol was a true orphan (relatedArticles:
//    null) despite ranking for real-volume queries; kvartiry-v-limassole
//    needed one more inbound link from the RU investment guide.
// C) EN FAQ: add real FAQ blocks (grounded in each article's own already-
//    published facts, not invented) to cost-of-buying-property-in-cyprus
//    and selling-property-in-cyprus.
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const newKey = () => Math.random().toString(36).slice(2, 12);

function para(text) {
  return { _key: newKey(), _type: "block", style: "normal", markDefs: [], children: [{ _key: newKey(), _type: "span", marks: [], text }] };
}
function faqBlock(items) {
  return {
    _key: newKey(), _type: "faqBlock", marginBottom: "medium",
    faq: { _type: "accordionBlock", items: items.map(([q, a]) => ({ _key: newKey(), question: q, answer: [para(a)] })) },
  };
}

async function main() {
  // --- A) PL residency: title/meta sharpen + inbound link ---
  const pl = await prisma.blog.findFirst({ where: { slug: "jak-uzyskac-pobyt-staly-na-cyprze", language: "pl" }, select: { id: true, title: true, seo: true } });
  if (!pl) throw new Error("ABORT: PL residency page not found");
  const OLD_TITLE = "Jak uzyskać pobyt stały na Cyprze – pełny przewodnik 2026";
  if (pl.title !== OLD_TITLE) {
    console.log("A) SKIPPED: PL title changed since diagnosis, not overwriting");
  } else {
    await prisma.blog.update({
      where: { id: pl.id },
      data: {
        title: "Prawo stałego pobytu na Cyprze – jak je uzyskać (pełny przewodnik 2026)",
        seo: {
          metaTitle: "Prawo stałego pobytu na Cyprze – jak je uzyskać",
          metaDescription: "Prawo stałego pobytu na Cyprze przez zakup nieruchomości: wymagania, dokumenty, koszty i szybka procedura fast-track z Cyprus VIP Estates.",
        },
      },
    });
    console.log("A) PL residency page: title/meta sharpened toward 'prawo stałego pobytu'");
  }

  const rezPod = await prisma.blog.findFirst({ where: { slug: "rezydencja-podatkowa-na-cyprze", language: "pl" }, select: { id: true, relatedArticles: true } });
  const plTarget = await prisma.blog.findFirst({ where: { slug: "jak-uzyskac-pobyt-staly-na-cyprze", language: "pl" }, select: { sanityId: true } });
  if (!rezPod || !plTarget) throw new Error("ABORT: PL linker page not found");
  const rezRefs = rezPod.relatedArticles || [];
  if (rezRefs.some((r) => r._ref === plTarget.sanityId)) {
    console.log("A) SKIPPED: rezydencja-podatkowa-na-cyprze already links to residency page");
  } else {
    const updated = [{ _key: newKey(), _ref: plTarget.sanityId, _type: "reference" }, ...rezRefs].slice(0, 3);
    await prisma.blog.update({ where: { id: rezPod.id }, data: { relatedArticles: updated } });
    console.log("A) rezydencja-podatkowa-na-cyprze now links to the residency guide");
  }

  // --- B) RU Limassol: fix orphan + one inbound link ---
  const pafosIli = await prisma.blog.findFirst({ where: { slug: "pafos-ili-limassol", language: "ru" }, select: { id: true, relatedArticles: true } });
  if (!pafosIli) throw new Error("ABORT: pafos-ili-limassol not found");
  if (pafosIli.relatedArticles !== null) {
    console.log("B) SKIPPED: pafos-ili-limassol already has relatedArticles");
  } else {
    const targets = ["local-ru-kvartiry-v-limassole", "single-villas-in-limassol-for-investors.ru"];
    const invGuide = await prisma.blog.findFirst({ where: { slug: "investicii-v-nedvizhimost-na-kipre-polnoe-rukovodstvo", language: "ru" }, select: { sanityId: true } });
    if (invGuide) targets.push(invGuide.sanityId);
    await prisma.blog.update({
      where: { id: pafosIli.id },
      data: { relatedArticles: targets.map((ref) => ({ _key: newKey(), _ref: ref, _type: "reference" })) },
    });
    console.log("B) pafos-ili-limassol: orphan fixed, now links to kvartiry-v-limassole, villy-v-limassole-dlya-investicij, investment guide");
  }

  const invGuide2 = await prisma.blog.findFirst({ where: { slug: "investicii-v-nedvizhimost-na-kipre-polnoe-rukovodstvo", language: "ru" }, select: { id: true, relatedArticles: true } });
  if (!invGuide2) throw new Error("ABORT: RU investment guide not found");
  const kvartTarget = "local-ru-kvartiry-v-limassole";
  const invRefs = invGuide2.relatedArticles || [];
  if (invRefs.some((r) => r._ref === kvartTarget)) {
    console.log("B) SKIPPED: investment guide already links to kvartiry-v-limassole");
  } else {
    const updated = [{ _key: newKey(), _ref: kvartTarget, _type: "reference" }, ...invRefs].slice(0, 3);
    await prisma.blog.update({ where: { id: invGuide2.id }, data: { relatedArticles: updated } });
    console.log("B) RU investment guide now links to kvartiry-v-limassole");
  }

  // --- C) EN FAQ additions ---
  const costFaqItems = [
    ["How much does it cost to buy property in Cyprus?", "As a rule of thumb, budget 5-10% above the purchase price - closer to 5% for a VAT-eligible primary residence, closer to 8-10% for an investment or resale purchase, now that stamp duty has been abolished."],
    ["Is VAT on property in Cyprus 5% or 19%?", "New-build property carries VAT at one of two rates. The reduced 5% rate applies only when the property will be your main and permanent residence and is up to 130m² (with partial relief up to a higher threshold); otherwise the standard 19% rate applies."],
    ["Do I pay transfer fees on a new-build property in Cyprus?", "No. New-build purchases carry VAT and are exempt from Land Registry transfer fees. Only resale purchases pay transfer fees, charged progressively on the property's market value, with a 50% discount since the transaction isn't VAT-applicable."],
    ["Is there still stamp duty on property purchases in Cyprus?", "No - stamp duty on Cyprus property contracts was abolished from 1 January 2026."],
    ["Is there an annual property tax in Cyprus?", "No. Cyprus has had no annual property tax since 2017. Owners may still pay community or management fees on complexes with shared amenities."],
  ];
  const sellFaqItems = [
    ["What is the capital gains tax rate in Cyprus?", "A flat 20% on gains from the disposal of immovable property located in Cyprus, or on shares in a company deriving a substantial part of its value from Cyprus property."],
    ["Are there capital gains tax exemptions when selling property in Cyprus?", "Yes. A reform effective from 1 January 2026 nearly doubled the lifetime exemptions. The primary-residence exemption requires five years of actual occupation, evidenced by proof such as utility bills."],
    ["What does it cost to sell a property in Cyprus?", "Beyond capital gains tax, sellers pay estate agency commission, their own legal fees, a 0.4% transfer levy on the sale value, and must clear any outstanding municipal or communal charges, or discharge a mortgage, before transfer."],
    ["Can I sell a property in Cyprus before the title deed is issued?", "Yes, but it's more complicated. It involves the developer and narrows the pool of buyers, since anyone using a mortgage will struggle without an individual title deed."],
    ["Do non-residents pay the same capital gains tax when selling in Cyprus?", "Yes. Residency status does not change the capital gains tax position - non-residents pay the same 20% and are eligible for the same lifetime exemptions, though the gain may also be reportable in their country of residence."],
  ];

  const costPage = await prisma.blog.findFirst({ where: { slug: "cost-of-buying-property-in-cyprus", language: "en" }, select: { id: true, contentBlocks: true } });
  if (!costPage) throw new Error("ABORT: cost-of-buying-property-in-cyprus not found");
  if (costPage.contentBlocks.some((b) => b._type === "faqBlock")) {
    console.log("C) SKIPPED: cost-of-buying-property-in-cyprus already has a faqBlock");
  } else {
    await prisma.blog.update({ where: { id: costPage.id }, data: { contentBlocks: [...costPage.contentBlocks, faqBlock(costFaqItems)] } });
    console.log("C) cost-of-buying-property-in-cyprus: FAQ block added (5 items)");
  }

  const sellPage = await prisma.blog.findFirst({ where: { slug: "selling-property-in-cyprus", language: "en" }, select: { id: true, contentBlocks: true } });
  if (!sellPage) throw new Error("ABORT: selling-property-in-cyprus not found");
  if (sellPage.contentBlocks.some((b) => b._type === "faqBlock")) {
    console.log("C) SKIPPED: selling-property-in-cyprus already has a faqBlock");
  } else {
    await prisma.blog.update({ where: { id: sellPage.id }, data: { contentBlocks: [...sellPage.contentBlocks, faqBlock(sellFaqItems)] } });
    console.log("C) selling-property-in-cyprus: FAQ block added (5 items)");
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
