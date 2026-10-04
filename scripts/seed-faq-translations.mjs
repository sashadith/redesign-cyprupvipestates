// Seeds the `faqPage` SiteDocument (type="faqPage") with EN content (copied
// verbatim from src/app/preview-faq/faqData.ts) plus DE/PL/RU/HE
// translations, so the redesigned /faq page has real content in all 5
// languages.
//
// ****************  THIS WRITES TO THE PRODUCTION DATABASE  *****************
// The local DATABASE_URL is the PRODUCTION database (see the repo's "Local DB
// is production" note) — run this on the STAGING SERVER, never on a laptop.
// Same two-key guard as scripts/he-content/seed.mjs:
//
//   node scripts/seed-faq-translations.mjs                 dry run (default):
//                                                          prints the plan for
//                                                          every language,
//                                                          touches no DB, exit 0
//   CVP_CONFIRM_CONTENT_SEED=yes node … --lang he --yes    real run, he only
//
// Missing either the env var or --yes means no write happens; --yes without
// the env var is an error (exit 1) rather than a silent downgrade.
//
// A REAL run additionally requires `--lang <code>` and writes ONLY that
// language's row. Without it the script cannot write at all: it prints the
// all-language plan and exits 0. The reason is that the four LTR rows are
// live content an editor can change in /admin/content/faq — re-upserting
// them from the repo files would silently discard those edits, so seeding
// Hebrew must never be a five-language write.
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
//
// scripts/faq-translations/he.json is the Hebrew content pack (Phase 5,
// Task 4): authored against the styleguide/glossary, Pass A + Pass B done,
// native review (Pass C) still pending — see docs/i18n/reviews/c-faq.md.
// It cannot carry a `"review": "pending"` field of its own, because
// buildForLang() below rebuilds every row strictly from EN_CATEGORIES and
// would drop it; the protocol file carries that status instead.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LANGUAGES = ["en", "de", "pl", "ru", "he"];

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

function parseArgs(argv) {
  let yes = false;
  let lang = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--yes") yes = true;
    else if (argv[i] === "--lang" && argv[i + 1]) lang = argv[++i];
    else if (argv[i].startsWith("--lang=")) lang = argv[i].slice("--lang=".length);
  }
  return { yes, lang };
}

async function main() {
  const { yes, lang } = parseArgs(process.argv.slice(2));
  const confirmed = process.env.CVP_CONFIRM_CONTENT_SEED === "yes";

  if (yes && !confirmed) {
    console.error(
      "seed-faq-translations.mjs: --yes was given but CVP_CONFIRM_CONTENT_SEED=yes is not set in the environment. Refusing to run for real (see content/he/README.md).",
    );
    process.exitCode = 1;
    return;
  }
  if (lang !== null && !LANGUAGES.includes(lang)) {
    console.error(`seed-faq-translations.mjs: unknown --lang "${lang}". Known languages: ${LANGUAGES.join(", ")}.`);
    process.exitCode = 1;
    return;
  }
  // A real run needs --lang: without it there is nothing this script is
  // allowed to write (see the banner), so it degrades to the all-language dry
  // run and exits 0 rather than touching four live rows.
  const isDryRun = !yes || lang === null;
  const langs = lang === null ? LANGUAGES : [lang];

  // Building every selected language also validates its translation file
  // against EN_CATEGORIES (buildForLang throws on a missing category/item or
  // a paragraph-count drift) — a dry run over all five is therefore a full
  // structural check.
  const built = langs.map((l) => {
    const categories = buildForLang(l);
    return { lang: l, categories, totalItems: categories.reduce((n, c) => n + c.items.length, 0) };
  });

  console.log(`seed-faq-translations: ${isDryRun ? "DRY RUN" : "REAL RUN"} — languages: ${langs.join(", ")}`);
  for (const { lang: l, categories, totalItems } of built) {
    console.log(`  faqPage-${l}: upsert — ${categories.length} categories, ${totalItems} questions`);
  }

  if (isDryRun) {
    if (yes && lang === null) {
      console.log(
        "\nseed-faq-translations.mjs: --yes was given without --lang <code> — nothing written. " +
          "A real run must name exactly one language (e.g. --lang he), so the en/de/pl/ru rows editors maintain in /admin/content/faq are never overwritten.",
      );
    } else {
      console.log(
        "\nseed-faq-translations.mjs: dry run — nothing written. Re-run with --lang <code>, --yes and CVP_CONFIRM_CONTENT_SEED=yes to apply that one language.",
      );
    }
    return; // no PrismaClient constructed — see the banner at the top
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    for (const { lang, categories, totalItems } of built) {
      await prisma.siteDocument.upsert({
        where: { type_language: { type: "faqPage", language: lang } },
        update: { data: { categories } },
        create: { sanityId: `faqPage-${lang}`, type: "faqPage", language: lang, data: { categories } },
      });
      console.log(`✓ ${lang}: ${categories.length} categories, ${totalItems} questions`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
