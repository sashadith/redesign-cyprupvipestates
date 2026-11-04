// One-off backfill (2026-10-19): guide (lead-magnet) leads that arrived before
// GUIDE_DOWNLOAD existed were stored as BLOG_ENQUIRY. Run AFTER the migration
// 20261025120000_lead_source_guide_download is deployed:
//   node scripts/backfill-guide-leads.mjs           (lists the affected leads, writes nothing)
//   node scripts/backfill-guide-leads.mjs --apply   (re-labels them)
//
// The rule is the operator's: source = BLOG_ENQUIRY AND the message begins
// with "[Guide]". Those get source GUIDE_DOWNLOAD plus guideTitle /
// guideLanguage read from the "[Guide] <title> (DE)" line, and a SOURCE_CHANGE
// timeline entry (same two rows moveLeadToBucket writes). Nothing is deleted;
// status, follow-up dates and everything else stay as they are.
//
// Leads that carry a guide line but do NOT match the rule (a typed message
// before the guide line, or another source) are only LISTED, never changed.
//
// Self-contained plain `node` like the other backfill-*.mjs scripts (no "@/..."
// alias); the parsing mirrors guideFromMessage() in src/lib/guides/leadSource.ts.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function guideFromMessage(message) {
  if (!message) return null;
  for (const raw of message.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("[Guide]")) continue;
    const m = /^\[Guide\]\s+(.+?)\s+\(([A-Za-z]{2})\)$/.exec(line);
    if (m) return { title: m[1], language: m[2].toLowerCase() };
  }
  return null;
}

const leads = await prisma.lead.findMany({
  where: { message: { contains: "[Guide]" } },
  select: { id: true, firstName: true, lastName: true, email: true, source: true, status: true, message: true, createdAt: true, deletedAt: true },
  orderBy: { createdAt: "asc" },
});

const matches = [];
const others = [];
for (const l of leads) {
  const guide = guideFromMessage(l.message);
  const rule = l.source === "BLOG_ENQUIRY" && (l.message ?? "").trimStart().startsWith("[Guide]");
  (rule ? matches : others).push({ ...l, guide });
}

const line = (l) =>
  `${l.createdAt.toISOString().slice(0, 10)}  ${l.id}  ${`${l.firstName} ${l.lastName}`.trim().padEnd(28)} ${String(l.email ?? "").padEnd(34)} ${l.status.padEnd(13)} ${l.deletedAt ? "[trash] " : ""}` +
  (l.guide ? `${l.guide.title} (${l.guide.language.toUpperCase()})` : "(guide line not parseable)");

console.log(`\nWILL BE RE-LABELLED BLOG_ENQUIRY → GUIDE_DOWNLOAD (${matches.length}):`);
for (const l of matches) console.log("  " + line(l));
console.log(`\nCARRY A [Guide] LINE BUT DO NOT MATCH THE RULE — listed only, not changed (${others.length}):`);
for (const l of others) console.log(`  [${l.source}] ` + line(l));

if (!APPLY) {
  console.log("\nDry run — nothing written. Re-run with --apply to re-label the first list.");
  await prisma.$disconnect();
  process.exit(0);
}

let done = 0;
for (const l of matches) {
  const content = "Moved to Guide Leads — source changed from BLOG_ENQUIRY to GUIDE_DOWNLOAD (backfill: guide request recorded before the source existed)";
  await prisma.$transaction([
    prisma.lead.update({
      where: { id: l.id },
      data: { source: "GUIDE_DOWNLOAD", guideTitle: l.guide?.title ?? null, guideLanguage: l.guide?.language ?? null },
    }),
    prisma.leadActivity.create({ data: { leadId: l.id, type: "SOURCE_CHANGE", content, createdBy: "system" } }),
    prisma.leadInteraction.create({
      data: {
        leadId: l.id,
        type: "SYSTEM",
        channel: "SYSTEM",
        body: content,
        metadata: { fromSource: "BLOG_ENQUIRY", toSource: "GUIDE_DOWNLOAD", toBucket: "guide", backfill: "2026-10-19" },
        createdByName: "system",
      },
    }),
  ]);
  done++;
}
console.log(`\nApplied: ${done} lead(s) re-labelled.`);
await prisma.$disconnect();
