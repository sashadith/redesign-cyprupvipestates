// One-off: apply the 12 human-reviewed DeveloperAccount -> Developer (public
// page) links approved 2026-08-01 (Bündel 3 Schritt 1). Run once, after the
// migration deploys:
//   node scripts/link-developer-accounts.mjs           (dry run)
//   node scripts/link-developer-accounts.mjs --apply   (writes)
//
// This list is NOT derived from slug similarity — 6 of these 12 have a
// DIFFERENT slug than their DeveloperAccount (e.g. "aristo" vs
// "aristo-developers"), and slug matching alone was checked and rejected:
// it would have produced 6 correct matches and left 6 more sitting
// unmatched despite a real page existing. Every row below was confirmed by
// reading that Developer page's EN title + opening description against the
// DeveloperAccount's own name before approval — do not extend this list
// without the same review; do not infer new rows from name/slug similarity.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// [DeveloperAccount.slug, Developer.slug]
const MAPPING = [
  ["bbf", "bbf"],
  ["inex", "inex"],
  ["island-blue", "island-blue"],
  ["olias-homes", "olias-homes"],
  ["pafilia", "pafilia"],
  ["square-one", "square-one"],
  ["agg", "agg-luxury-homes"],
  ["aristo", "aristo-developers"],
  ["domenica", "domenica-group"],
  ["kuutio-homes-drive", "kuutio-homes"],
  ["luma", "luma-development"],
  ["medousa", "medousa-developers"],
  // motive-point: deliberately excluded — no matching Developer page found.
];

async function main() {
  console.log(`Checking ${MAPPING.length} approved mapping(s):\n`);
  const plan = [];
  for (const [accountSlug, developerSlug] of MAPPING) {
    const account = await prisma.developerAccount.findUnique({
      where: { slug: accountSlug },
      select: { id: true, name: true, developerTranslationGroupId: true },
    });
    if (!account) { console.log(`  ✗ DeveloperAccount "${accountSlug}" not found — skipping`); continue; }

    const developer = await prisma.developer.findFirst({
      where: { slug: developerSlug },
      select: { translationGroupId: true, title: true },
    });
    if (!developer?.translationGroupId) { console.log(`  ✗ Developer "${developerSlug}" not found or has no translationGroupId — skipping`); continue; }

    const already = account.developerTranslationGroupId === developer.translationGroupId;
    console.log(`  ${already ? "=" : "→"} [${accountSlug}] ${account.name}  ${already ? "already linked to" : "will link to"}  "${developer.title}" (${developerSlug})`);
    if (!already) plan.push({ accountId: account.id, accountSlug, groupId: developer.translationGroupId });
  }

  if (!APPLY) {
    console.log(`\nDry run — ${plan.length} update(s) would be written. Re-run with --apply to write.`);
    return;
  }

  for (const { accountId, groupId } of plan) {
    await prisma.developerAccount.update({ where: { id: accountId }, data: { developerTranslationGroupId: groupId } });
  }
  console.log(`\n✓ Linked ${plan.length} developer account(s).`);
}

main().finally(() => prisma.$disconnect());
