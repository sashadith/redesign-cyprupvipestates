// One-off seed: populate the `faqPage` SiteDocument (type="faqPage") with EN
// content (copied verbatim from src/app/preview-faq/faqData.ts) plus DE/PL/RU
// translations, so the redesigned /faq page has real content in all 4
// languages. Run: node scripts/seed-faq-translations.mjs
//
// EN_CATEGORIES below is a verbatim, hand-copied mirror of FAQ_CATEGORIES in
// faqData.ts (that file is TypeScript with a type annotation this plain
// Node script can't import directly — same reason every other scripts/*.mjs
// file in this repo is self-contained rather than importing from src/). The
// DE/PL/RU translation JSON files (scripts/faq-translations/{de,pl,ru}.json)
// were generated separately, structurally mirroring EN_CATEGORIES 1:1 (same
// category order, same slugs/ids, only label/description/question/answer
// translated) — first-pass machine translation, not professionally
// reviewed, same caveat as the copy.ts UI-chrome translations.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const EN_CATEGORIES = JSON.parse(fs.readFileSync(path.join(__dirname, "faq-translations", "en.json"), "utf8"));

function buildForLang(lang) {
  if (lang === "en") return EN_CATEGORIES;
  const translated = JSON.parse(fs.readFileSync(path.join(__dirname, "faq-translations", `${lang}.json`), "utf8"));
  const byId = new Map(translated.flatMap((c) => c.items.map((it) => [it.id, it])));
  const catBySlug = new Map(translated.map((c) => [c.slug, c]));
  // Rebuild strictly from EN_CATEGORIES' order/ids/slugs (source of truth for
  // structure), pulling translated text by id/slug — guards against a
  // translation file that reordered or dropped an item.
  return EN_CATEGORIES.map((enCat) => {
    const tCat = catBySlug.get(enCat.slug);
    if (!tCat) throw new Error(`[${lang}] missing category translation for slug "${enCat.slug}"`);
    return {
      slug: enCat.slug,
      label: tCat.label,
      description: tCat.description,
      items: enCat.items.map((enItem) => {
        const tItem = byId.get(enItem.id);
        if (!tItem) throw new Error(`[${lang}] missing item translation for id "${enItem.id}"`);
        if (!Array.isArray(tItem.answer) || tItem.answer.length !== enItem.answer.length) {
          throw new Error(`[${lang}] answer paragraph count mismatch for id "${enItem.id}": EN has ${enItem.answer.length}, ${lang} has ${tItem.answer?.length}`);
        }
        return { id: enItem.id, question: tItem.question, answer: tItem.answer };
      }),
    };
  });
}

async function main() {
  for (const lang of ["en", "de", "pl", "ru"]) {
    const categories = buildForLang(lang);
    const totalItems = categories.reduce((n, c) => n + c.items.length, 0);
    await prisma.siteDocument.upsert({
      where: { type_language: { type: "faqPage", language: lang } },
      update: { data: { categories } },
      create: { sanityId: `faqPage-${lang}`, type: "faqPage", language: lang, data: { categories } },
    });
    console.log(`✓ ${lang}: ${categories.length} categories, ${totalItems} questions`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
