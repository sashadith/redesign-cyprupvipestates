// One-off repair for Meta leads imported before the field-key fix
// (2026-10-12): those leads lost email (and on DE forms the name) because
// Meta's keys follow the form's labels ("email_address", "e-mail-adresse",
// "vollständiger_name"). The raw answers were stored on the timeline entry, so
// everything is re-derived from there — no Graph call.
//
// Per affected lead:
//   • its canonical email belongs to another live lead → the import was really
//     a duplicate: move its timeline/activities to that lead, put the
//     duplicate in the CRM trash (restorable 90 days), event → ATTACHED;
//   • otherwise → fill in only the fields that are empty.
//
// Dry run by default; --apply writes. Only ever writes to META_LEAD_AD leads
// it created, plus timeline rows moved onto the matched existing lead.
//   npx tsx scripts/meta-leadgen-repair.mts [--apply]
import { PrismaClient, type Prisma } from "@prisma/client";
import { mapFieldData, type MetaFieldDatum } from "../src/lib/metaLeadgen/mapFields";
import { canonicalizeEmail } from "../src/lib/emailInbound/matchLead";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();
const ACTOR = "Meta Lead Ads (repair)";

const events = await prisma.metaLeadgenEvent.findMany({ where: { status: "DONE", outcome: "CREATED" }, orderBy: { createdAt: "asc" } });
console.log(`${apply ? "APPLY" : "DRY RUN"} — ${events.length} created Meta lead(s) to check`);

for (const ev of events) {
  const lead = ev.leadId ? await prisma.lead.findUnique({ where: { id: ev.leadId } }) : null;
  if (!lead || lead.source !== "META_LEAD_AD" || lead.deletedAt) {
    console.log(`· ${ev.leadgenId}: lead missing / not META_LEAD_AD / deleted — skip`);
    continue;
  }
  const ix = await prisma.leadInteraction.findFirst({ where: { leadId: lead.id, metadata: { path: ["leadgenId"], equals: ev.leadgenId } } });
  const fd = ((ix?.metadata as Record<string, unknown> | null)?.fieldData ?? []) as MetaFieldDatum[];
  if (!fd.length) {
    console.log(`· ${ev.leadgenId}: no stored fieldData — skip`);
    continue;
  }
  const m = mapFieldData(fd, ev.formName);
  const key = canonicalizeEmail(m.email);
  const others = key
    ? (await prisma.lead.findMany({ where: { deletedAt: null, id: { not: lead.id }, email: { not: null }, source: { not: "NEWSLETTER" } }, select: { id: true, email: true, firstName: true, lastName: true, status: true, createdAt: true } }))
        .filter((l) => canonicalizeEmail(l.email) === key)
    : [];
  const target = others.length ? others.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)) : null;

  if (target) {
    console.log(`→ ${ev.leadgenId} (${ev.formName}): DUPLICATE of ${target.firstName} ${target.lastName} [${target.status}] ${target.id} — move timeline, trash ${lead.id}`);
    if (!apply) continue;
    await prisma.$transaction(async (tx) => {
      await tx.leadInteraction.updateMany({ where: { leadId: lead.id }, data: { leadId: target.id } });
      await tx.leadActivity.updateMany({ where: { leadId: lead.id }, data: { leadId: target.id } });
      await tx.leadInteraction.create({
        data: {
          leadId: target.id, type: "SYSTEM", channel: "SYSTEM", createdByName: ACTOR,
          body: `Meta lead form submission (leadgen_id ${ev.leadgenId}) was first imported as a separate lead because of a field-mapping bug; it has been merged here and the duplicate moved to the trash.`,
          metadata: { source: "meta_leadgen_repair", leadgenId: ev.leadgenId, duplicateLeadId: lead.id } satisfies Prisma.InputJsonObject,
        },
      });
      await tx.lead.update({ where: { id: lead.id }, data: { deletedAt: new Date() } });
      await tx.metaLeadgenEvent.update({ where: { id: ev.id }, data: { outcome: "ATTACHED", leadId: target.id } });
    });
    continue;
  }

  const data: Prisma.LeadUpdateInput = {};
  if (!lead.email && m.email) data.email = m.email;
  if (!lead.firstName && m.firstName) data.firstName = m.firstName;
  if (!lead.lastName && m.lastName) data.lastName = m.lastName;
  if (!lead.phone && m.phone) data.phone = m.phone;
  const fields = Object.keys(data);
  if (!fields.length) {
    console.log(`· ${ev.leadgenId} (${ev.formName}): nothing missing`);
    continue;
  }
  console.log(`→ ${ev.leadgenId} (${ev.formName}): fill ${fields.join(", ")} on ${lead.id} → ${m.firstName} ${m.lastName} <${m.email}>`);
  if (!apply) continue;
  await prisma.$transaction([
    prisma.lead.update({ where: { id: lead.id }, data }),
    prisma.leadInteraction.create({
      data: { leadId: lead.id, type: "SYSTEM", channel: "SYSTEM", createdByName: ACTOR, body: `Filled ${fields.join(", ")} from the stored Meta form answers (field-mapping fix).`, metadata: { source: "meta_leadgen_repair", leadgenId: ev.leadgenId, fields } },
    }),
  ]);
}
await prisma.$disconnect();
