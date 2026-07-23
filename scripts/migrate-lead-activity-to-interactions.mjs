// Lead Cockpit Phase 1 (2026-07-23) — one-time copy-migration: LeadActivity
// (154 rows as of writing) -> LeadInteraction. LeadActivity is never read
// from or written to by this script; it stays exactly as-is, forever.
//
// Idempotent via legacyActivityId (unique): re-running only inserts rows
// that don't already have a matching LeadInteraction, so it's safe to run
// against the rehearsal DB, re-run after a fix, then run again for real
// against the shared DB.
//
// Run (against the ambient DATABASE_URL — used for the real, approved run):
//   node scripts/migrate-lead-activity-to-interactions.mjs           (dry run, prints the plan + counts)
//   node scripts/migrate-lead-activity-to-interactions.mjs --apply   (writes)
//
// Rehearsal mode (reads REHEARSAL_DATABASE_URL instead, and hard-aborts if
// that URL resolves to the production DB name — the rehearsal tooling must
// be physically unable to touch the real DB by accident):
//   REHEARSAL_DATABASE_URL="postgresql://.../cvp_rehearsal" node scripts/migrate-lead-activity-to-interactions.mjs --rehearsal
//   REHEARSAL_DATABASE_URL="postgresql://.../cvp_rehearsal" node scripts/migrate-lead-activity-to-interactions.mjs --rehearsal --apply
import { PrismaClient } from "@prisma/client";
import { assertNotProdDb } from "./assert-not-prod-db.mjs";

const REHEARSAL = process.argv.includes("--rehearsal");
const APPLY = process.argv.includes("--apply");

let prisma;
if (REHEARSAL) {
  const url = process.env.REHEARSAL_DATABASE_URL;
  if (!url) {
    console.error("ABORT: --rehearsal requires REHEARSAL_DATABASE_URL to be set.");
    process.exit(1);
  }
  assertNotProdDb(url); // hard-aborts if this resolves to the production DB name
  prisma = new PrismaClient({ datasources: { db: { url } } });
} else {
  prisma = new PrismaClient(); // ambient DATABASE_URL — the real, approved run
}

// Every type string actually written by the 16 current leadActivity.create()
// call sites across actions.ts, presentationActions.ts,
// api/admin/presentations/route.ts + [id]/route.ts,
// api/c/[token]/favorite+view/route.ts, and src/lib/leadNotify.ts.
const TYPE_MAP = {
  STATUS_CHANGE: { type: "STATUS_CHANGE", channel: "SYSTEM" },
  NOTE: { type: "NOTE", channel: null },
  ASSIGNMENT: { type: "SYSTEM", channel: "SYSTEM" },
  CREATED: { type: "SYSTEM", channel: "SYSTEM" },
  EDIT: { type: "SYSTEM", channel: "SYSTEM" },
  MERGE: { type: "SYSTEM", channel: "SYSTEM" },
  DELETED: { type: "SYSTEM", channel: "SYSTEM" },
  RESTORED: { type: "SYSTEM", channel: "SYSTEM" },
  // The only historical type that represents genuine "contact" (the lead's
  // own inbound approach) — carries direction so the Cockpit's "last contact"
  // stat has something to find even for a lead nobody has manually logged
  // a call/note against yet.
  INBOUND: { type: "SYSTEM", channel: "SYSTEM", direction: "INBOUND" },
  PRESENTATION_CREATED: { type: "PRESENTATION_EVENT", channel: "SYSTEM" },
  PRESENTATION_EDITED: { type: "PRESENTATION_EVENT", channel: "SYSTEM" },
  PRESENTATION_REVOKED: { type: "PRESENTATION_EVENT", channel: "SYSTEM" },
  PRESENTATION_DELETED: { type: "PRESENTATION_EVENT", channel: "SYSTEM" },
  PRESENTATION_EXTENDED: { type: "PRESENTATION_EVENT", channel: "SYSTEM" },
  PRESENTATION_VIEWED: { type: "PRESENTATION_EVENT", channel: "SYSTEM" },
  PRESENTATION_FAVORITE: { type: "PRESENTATION_EVENT", channel: "SYSTEM" },
};

function mapRow(activity) {
  const mapped = TYPE_MAP[activity.type];
  // Unknown/legacy free-form type string never seen in the current codebase
  // (e.g. hand-inserted historical data) — fall back to SYSTEM rather than
  // dropping the row, and keep the original string for traceability.
  const { type, channel, direction } = mapped ?? { type: "SYSTEM", channel: "SYSTEM", direction: null };
  return {
    leadId: activity.leadId,
    type,
    direction: direction ?? null,
    channel,
    subject: null,
    body: activity.content,
    occurredAt: activity.createdAt,
    createdByUserId: activity.createdById,
    createdByName: activity.createdBy,
    metadata: mapped ? { legacyType: activity.type } : { legacyType: activity.type, unmappedType: true },
    legacyActivityId: activity.id,
  };
}

async function main() {
  const activities = await prisma.leadActivity.findMany({ orderBy: { createdAt: "asc" } });
  const alreadyMigrated = await prisma.leadInteraction.count({ where: { legacyActivityId: { not: null } } });

  console.log(`LeadActivity total: ${activities.length}`);
  console.log(`LeadInteraction rows already copy-migrated: ${alreadyMigrated}`);

  const unmapped = activities.filter((a) => !TYPE_MAP[a.type]);
  if (unmapped.length) {
    console.log(`WARNING: ${unmapped.length} row(s) have an unrecognized type string, mapped to SYSTEM:`, [
      ...new Set(unmapped.map((a) => a.type)),
    ]);
  }

  if (!APPLY) {
    console.log("Dry run — pass --apply to write. No changes made.");
    return;
  }

  for (const activity of activities) {
    await prisma.leadInteraction.upsert({
      where: { legacyActivityId: activity.id },
      create: mapRow(activity),
      update: {}, // idempotent: never overwrite an existing copy-migrated row
    });
  }
  const finalCount = await prisma.leadInteraction.count({ where: { legacyActivityId: { not: null } } });
  const created = finalCount - alreadyMigrated;
  const skipped = activities.length - created - alreadyMigrated;

  console.log(`Copy-migration complete. Newly created: ${created}. Already present (skipped): ${skipped}.`);
  console.log(`LeadActivity count: ${activities.length} | LeadInteraction (legacy-sourced) count: ${finalCount}`);
  if (finalCount !== activities.length) {
    console.log("MISMATCH — investigate before proceeding.");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
