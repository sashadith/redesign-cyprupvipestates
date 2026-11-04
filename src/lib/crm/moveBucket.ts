import { prisma } from "@/lib/prisma";
import { BUCKET_LABEL, bucketOf, sourceForBucket, type LeadBucket } from "./leadBucket";

// Moving a lead between the CRM buckets. `source` IS the bucket, so this overwrites it, and the
// write is lossy (a PROJECT_ENQUIRY lead comes back from Partner as MANUAL): the timeline rows are
// the only place that history survives. Shared by the old admin's moveLeadToBucket and crm_update_lead.
// Returns false when the lead is already in that bucket — a no-op writes no timeline row.
export async function moveLeadBucket(leadId: string, bucket: LeadBucket, actor: { id: string | null; name: string }): Promise<boolean> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { source: true } });
  if (!lead) throw new Error("Lead not found");
  if (bucketOf(lead.source) === bucket) return false;

  const fromSource = lead.source;
  const toSource = sourceForBucket(bucket);
  await prisma.lead.update({ where: { id: leadId }, data: { source: toSource } });

  const content = `Moved to ${BUCKET_LABEL[bucket]} — source changed from ${fromSource} to ${toSource}`;
  await prisma.leadActivity.create({
    data: { leadId, type: "SOURCE_CHANGE", content, createdBy: actor.name, createdById: actor.id },
  });
  await prisma.leadInteraction.create({
    data: {
      leadId,
      type: "SYSTEM",
      channel: "SYSTEM",
      body: content,
      // Structured as well as prose, for the same reason updateLeadStatus writes metadata.toStatus.
      metadata: { fromSource, toSource, toBucket: bucket },
      createdByUserId: actor.id,
      createdByName: actor.name,
    },
  });
  return true;
}
