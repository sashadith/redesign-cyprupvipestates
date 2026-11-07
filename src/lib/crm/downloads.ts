import { prisma } from "@/lib/prisma";
import { canAssignLeads } from "./access";
import { writeAudit } from "./audit";
import { ONLY_GUIDE } from "./leadBucket";
import { SOURCE_LABEL } from "./boardModel";
import { STATUS_LABEL, isLeadStatus } from "./leadStatus";
import type { SessionCrmUser } from "./session";
import { sourceForTakenOverDownload, statusForTakenOverDownload } from "./downloadSource";

// Inbox -> Downloads (operator, 2026-11-07): guide and Private Collection briefing
// readers, listed apart from the work views, never assigned, until someone takes
// one over as a lead.

export const DOWNLOADS_CAP = 300;

export type DownloadRow = {
  id: string; name: string; email: string | null; lang: string | null;
  guide: string | null; status: string; createdAt: string; owner: string | null;
};

const where = { AND: [ONLY_GUIDE, { deletedAt: null }] };

export async function countDownloads(): Promise<number> {
  return prisma.lead.count({ where });
}

export async function listDownloads(): Promise<DownloadRow[]> {
  const rows = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: DOWNLOADS_CAP,
    select: { id: true, firstName: true, lastName: true, email: true, languagePreference: true, guideTitle: true, status: true, createdAt: true, assignedTo: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id, name: `${r.firstName} ${r.lastName}`.trim() || "—", email: r.email, lang: r.languagePreference?.toUpperCase() ?? null,
    guide: r.guideTitle, status: isLeadStatus(r.status) ? STATUS_LABEL[r.status] : r.status,
    createdAt: r.createdAt.toISOString(), owner: r.assignedTo?.name ?? null,
  }));
}

export type TakeOverDownloadResult = { ok: true } | { error: string };

/** Moves a download into the work views: buyer source, a parked or lost one back to New, into the inbox. */
export async function takeOverDownload(actor: SessionCrmUser, leadId: string): Promise<TakeOverDownloadResult> {
  if (!canAssignLeads(actor)) return { error: "Only admins can take over downloads." };
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, source: true, status: true, guideTitle: true, pageSource: true } });
  if (!lead) return { error: "Lead not found." };
  if (lead.source !== "GUIDE_DOWNLOAD") return { error: "This is already a lead." };
  const source = sourceForTakenOverDownload(lead);
  const status = statusForTakenOverDownload(lead.status);
  const label = SOURCE_LABEL[source] ?? source;
  await prisma.$transaction(async (tx) => {
    // Compare-and-set on the source: a second click (or a second admin) writes nothing twice.
    const { count } = await tx.lead.updateMany({
      where: { id: lead.id, source: "GUIDE_DOWNLOAD" },
      data: { source, ...(status ? { status, lostReason: null } : {}) },
    });
    if (count === 0) return;
    await tx.leadInteraction.create({
      data: {
        leadId: lead.id, type: "SYSTEM", channel: "SYSTEM",
        body: `Taken over from Downloads as a lead by ${actor.name} (source Guide download → ${label}${status ? ", status New" : ""})`,
        metadata: { from: "GUIDE_DOWNLOAD", to: source, ...(status ? { toStatus: status } : {}), via: "crm-v2-downloads" },
        createdByUserId: actor.id, createdByName: actor.name,
      },
    });
    await writeAudit(actor, "download_taken_over", "lead", lead.id, { to: source, ...(status ? { status } : {}) }, tx);
  });
  return { ok: true };
}
