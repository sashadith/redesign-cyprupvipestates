#!/usr/bin/env node
/* One-off: align Development.developer to the linked public developer page's
   own title, for the developers whose rows still carry a shorter form.

   Follow-up to fix-developer-integration-markers.mjs (2026-10-09). That one
   removed the internal "(SharePoint)"-style markers and, where an account was
   linked to a public page, took the brand from that page's title. This one
   closes the remaining gap: two developers whose rows predate that rule and
   still hold a short form the public page spells out in full.

     AGG  "AGG"  → "AGG Luxury Homes"      (12 published)
     Luma "Luma" → "Luma Development"      ( 3 published)

   WHY THIS IS SAFE ONLY FOR SOME ADAPTERS, and the reason for the guard below:
   `developer` is in NO adapter's FROZEN_WHEN_PUBLISHED list. For the XML/API
   feeds it is rewritten from the vendor's own feed data on EVERY sync
   (feedSync.ts developmentRow → vm.developer), so correcting such a row by
   hand would be silently reverted the same night. Those rows are therefore
   left alone and reported instead — "Domenica" → "Domenica Group" (23 rows)
   and "Mito" → "Mito Developers" (4) are real mismatches but belong to that
   class and need a feed-side or freeze-side decision, not an UPDATE here.

   Dry run (prints the plan, writes nothing):
     node --env-file=.env.local scripts/align-developer-labels-to-page-title.mjs

   Apply:
     node --env-file=.env.local scripts/align-developer-labels-to-page-title.mjs --apply

   NOTE: .env.local points at PRODUCTION. Read the plan before applying. */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

/* Adapters that write `developer` on CREATE only (drive, dropbox, sharepoint,
   agg) or re-derive it from publicDeveloperLabel() on every write (cybarco,
   plusproperties), plus "manual" rows the admin creates. For all of these the
   corrected value is what a future write would produce anyway, so it holds. */
const SAFE_ADAPTERS = new Set(["drive", "dropbox", "sharepoint", "agg", "manual", "cybarco", "plusproperties"]);

const accts = await prisma.developerAccount.findMany({
  select: { id: true, name: true, developerTranslationGroupId: true },
});

async function pageTitle(groupId) {
  if (!groupId) return null;
  const rows = await prisma.developer.findMany({
    where: { translationGroupId: groupId }, select: { language: true, title: true },
  });
  return (rows.find((r) => r.language === "en") ?? rows[0])?.title?.trim() || null;
}

const want = new Map();
for (const a of accts) want.set(a.id, await pageTitle(a.developerTranslationGroupId));

const rows = await prisma.development.findMany({
  select: { id: true, slug: true, publicName: true, developer: true, dev: true, publishStatus: true, developerAccountId: true },
  orderBy: [{ dev: "asc" }, { publicName: "asc" }],
});

const mismatched = rows.filter((r) => {
  const t = want.get(r.developerAccountId);
  return t && r.developer && r.developer !== t;
});
const safe = mismatched.filter((r) => SAFE_ADAPTERS.has(r.dev));
const unsafe = mismatched.filter((r) => !SAFE_ADAPTERS.has(r.dev));

const nameOf = (id) => accts.find((a) => a.id === id).name;
const group = (list) => {
  const m = new Map();
  for (const r of list) {
    const k = `${nameOf(r.developerAccountId)}|${r.developer}|${want.get(r.developerAccountId)}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
};

console.log(`${APPLY ? "APPLYING" : "DRY RUN"}\n`);
console.log(`== correcting (${safe.length} row(s)) ==\n`);
for (const [k, rs] of group(safe)) {
  const [acct, from, to] = k.split("|");
  console.log(`${acct}: "${from}" → "${to}"   ${rs.length} row(s), ${rs.filter((r) => r.publishStatus === "published").length} published`);
  for (const r of rs) console.log(`   [${r.publishStatus}] ${r.publicName}  (adapter=${r.dev}, /projects/${r.slug ?? "—"})`);
  console.log();
}

if (unsafe.length) {
  console.log(`== NOT touched — the feed rewrites these every sync (${unsafe.length} row(s)) ==\n`);
  for (const [k, rs] of group(unsafe)) {
    const [acct, from, to] = k.split("|");
    console.log(`${acct}: "${from}" → would be "${to}"   ${rs.length} row(s), adapter=${rs[0].dev}`);
  }
  console.log("\nTo change those, the brand has to come from the feed adapter or `developer`");
  console.log("has to join that adapter's FROZEN_WHEN_PUBLISHED list — not from an UPDATE here.\n");
}

if (!APPLY) {
  console.log("Nothing written. Re-run with --apply to write the corrections above.");
} else {
  let n = 0;
  for (const r of safe) {
    await prisma.development.update({ where: { id: r.id }, data: { developer: want.get(r.developerAccountId) } });
    n++;
  }
  console.log(`Updated ${n} row(s).`);
  /* /[lang]/projects/[slug] is force-dynamic, so this is live on the next request. */
  console.log("/projects/<slug> is force-dynamic — the new label is live immediately.");
}
await prisma.$disconnect();
