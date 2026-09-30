// October Content Calendar — sprint day 1 (Wed 30.09.2026)
// Three internal-linking / on-page-relevance fixes, all idempotent:
//  A) taxes-on-real-estate-in-cyprus: H2 #7 doesn't contain "immovable property
//     tax" despite that being the exact GSC query phrase surfacing the page
//     (avg position 70-90, 1-2 impressions each, zero clicks) — sharpen it.
//  B) cost-of-buying-property-in-cyprus (a real pillar page, currently zero
//     related articles) links to the taxes guide — a legitimate authority page
//     pointing at it, on top of its existing 3 inbound refs.
//  C) off-plan cluster (umbrella + Paphos/Limassol/Larnaca) never linked to
//     each other despite being a clear hub/spoke set — add the missing
//     cross-links so Google can see the cluster structure.
//  D) the two PR/Golden-Visa Blog posts never linked to each other — the
//     newer one (5 days old) is a true orphan. Cross-link them; the 3-item
//     display cap on blog/[slug]/page.tsx means the new ref must be unshifted
//     to the front of the older post's array, so the least-relevant existing
//     ref (UK pet-relocation guide) is dropped to keep exactly 3 visible.
import fs from "node:fs";
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function newKey() {
  return Math.random().toString(36).slice(2, 12);
}

async function main() {
  // --- A) taxes page H2 relevance fix ---
  const taxes = await prisma.blog.findFirst({
    where: { slug: "taxes-on-real-estate-in-cyprus", language: "en" },
    select: { id: true, sanityId: true, contentBlocks: true },
  });
  if (!taxes) throw new Error("ABORT: taxes page not found");
  const OLD_H2 = "7. Tax Residency & Annual Property Tax";
  const NEW_H2 = "7. Immovable Property Tax in Cyprus: Tax Residency & Annual Charges";
  let h2Fixed = false;
  const taxesBlocks = taxes.contentBlocks.map((b) => {
    if (b._type !== "textContent" || !Array.isArray(b.content)) return b;
    const content = b.content.map((c) => {
      if (c._type === "block" && c.style === "h2" && Array.isArray(c.children)) {
        const text = c.children.map((x) => x.text).join("");
        if (text === OLD_H2) {
          h2Fixed = true;
          return {
            ...c,
            children: c.children.map((child, i) =>
              i === 0 ? { ...child, text: NEW_H2 } : child,
            ),
          };
        }
      }
      return c;
    });
    return { ...b, content };
  });
  if (!h2Fixed) throw new Error(`ABORT: H2 "${OLD_H2}" not found — taxes page content changed since diagnosis`);

  await prisma.blog.update({ where: { id: taxes.id }, data: { contentBlocks: taxesBlocks } });
  console.log("A) taxes page H2 #7 sharpened for 'immovable property tax' phrasing");

  // --- B) cost-of-buying-property-in-cyprus -> links to taxes page ---
  const costOfBuying = await prisma.blog.findFirst({
    where: { slug: "cost-of-buying-property-in-cyprus", language: "en" },
    select: { id: true, relatedArticles: true },
  });
  if (!costOfBuying) throw new Error("ABORT: cost-of-buying-property-in-cyprus not found");
  if (costOfBuying.relatedArticles !== null) {
    console.log("B) SKIPPED: cost-of-buying-property-in-cyprus already has relatedArticles, not overwriting");
  } else {
    await prisma.blog.update({
      where: { id: costOfBuying.id },
      data: { relatedArticles: [{ _key: newKey(), _ref: taxes.sanityId, _type: "reference" }] },
    });
    console.log("B) cost-of-buying-property-in-cyprus now links to the taxes guide");
  }

  // --- C) off-plan cluster cross-links ---
  const offplan = await prisma.singlepage.findMany({
    where: {
      slug: {
        in: [
          "off-plan-properties-cyprus",
          "off-plan-properties-in-paphos",
          "off-plan-properties-in-limassol",
          "off-plan-properties-in-larnaca",
        ],
      },
      language: "en",
    },
    select: { id: true, slug: true, sanityId: true, relatedLandingPages: true },
  });
  if (offplan.length !== 4) throw new Error(`ABORT: expected 4 off-plan pages, found ${offplan.length}`);
  const bySlug = new Map(offplan.map((p) => [p.slug, p]));
  const umbrella = bySlug.get("off-plan-properties-cyprus");
  const cities = ["off-plan-properties-in-paphos", "off-plan-properties-in-limassol", "off-plan-properties-in-larnaca"]
    .map((s) => bySlug.get(s));

  const ref = (p) => ({ _key: newKey(), _ref: p.sanityId, _type: "singlepageRef" });

  if (umbrella.relatedLandingPages !== null) {
    console.log("C) SKIPPED umbrella: off-plan-properties-cyprus already has relatedLandingPages");
  } else {
    await prisma.singlepage.update({
      where: { id: umbrella.id },
      data: { relatedLandingPages: cities.map(ref) },
    });
    console.log("C) off-plan-properties-cyprus now cross-links to the 3 city pages");
  }

  for (const city of cities) {
    const existingRefs = new Set((city.relatedLandingPages || []).map((r) => r._ref));
    const siblings = [umbrella, ...cities.filter((c) => c.slug !== city.slug)];
    const toAdd = siblings.filter((s) => !existingRefs.has(s.sanityId));
    if (!toAdd.length) {
      console.log(`C) SKIPPED ${city.slug}: already cross-linked`);
      continue;
    }
    await prisma.singlepage.update({
      where: { id: city.id },
      data: { relatedLandingPages: [...(city.relatedLandingPages || []), ...toAdd.map(ref)] },
    });
    console.log(`C) ${city.slug} now links to ${toAdd.map((s) => s.slug).join(", ")}`);
  }

  // --- D) residency cluster reciprocal links ---
  const golden = await prisma.blog.findFirst({
    where: { slug: "cyprus-permanent-residency-golden-visa-guide", language: "en" },
    select: { id: true, sanityId: true, relatedArticles: true },
  });
  const howTo = await prisma.blog.findFirst({
    where: { slug: "how-to-get-permanent-residence-in-cyprus", language: "en" },
    select: { id: true, sanityId: true, relatedArticles: true },
  });
  if (!golden || !howTo) throw new Error("ABORT: residency posts not found");

  if (golden.relatedArticles !== null) {
    console.log("D) SKIPPED golden-visa-guide: already has relatedArticles");
  } else {
    await prisma.blog.update({
      where: { id: golden.id },
      data: { relatedArticles: [{ _key: newKey(), _ref: howTo.sanityId, _type: "reference" }] },
    });
    console.log("D) cyprus-permanent-residency-golden-visa-guide now links to the how-to-get-PR guide");
  }

  const howToRefs = howTo.relatedArticles || [];
  if (howToRefs.some((r) => r._ref === golden.sanityId)) {
    console.log("D) SKIPPED how-to-get-permanent-residence-in-cyprus: already links to golden-visa-guide");
  } else {
    const trimmed = howToRefs.slice(0, 2); // drop the least-relevant 3rd ref (UK pet-relocation guide) to stay within the 3-item display cap
    const updated = [{ _key: newKey(), _ref: golden.sanityId, _type: "reference" }, ...trimmed];
    await prisma.blog.update({ where: { id: howTo.id }, data: { relatedArticles: updated } });
    console.log("D) how-to-get-permanent-residence-in-cyprus now links to golden-visa-guide (unshifted into the visible 3)");
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
