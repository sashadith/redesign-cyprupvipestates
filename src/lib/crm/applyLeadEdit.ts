import { prisma } from "@/lib/prisma";
import { changedFields, changeSummary, type LeadEditBefore, type LeadEditInput } from "./editLead";
import { emailEditData } from "./leadHints";
import { contactToCheck, findDuplicateLead, type DuplicateLead } from "./createLead";
import { authorColumns, isPartnerActor, type LeadActor } from "./leadActor";

export type ApplyLeadEditResult =
  | { kind: "unchanged" }
  | { kind: "duplicate"; dup: DuplicateLead }
  | { kind: "ok"; changed: string };

// The write behind "Edit" (cockpit 2026-10-28, partner pipeline 2026-11-05), after
// the caller has authorized and run validateLeadEdit. Nothing changed: no write.
// A new email or phone that already belongs to another lead is refused, as on
// create; each caller shapes that refusal for its user. A staff edit also writes
// the LeadActivity row (staff-only); a partner edit writes the timeline row alone.
export async function applyLeadEdit(leadId: string, before: LeadEditBefore, data: LeadEditInput, author: LeadActor): Promise<ApplyLeadEditResult> {
  const fields = changedFields(before, data);
  if (fields.length === 0) return { kind: "unchanged" };

  const check = contactToCheck(before, data);
  if (check.email || check.phone) {
    const dup = await findDuplicateLead(check.email, check.phone);
    if (dup && dup.id !== leadId) return { kind: "duplicate", dup };
  }

  const changed = changeSummary(fields);
  const content = `Lead details edited: ${changed}`;
  const partner = isPartnerActor(author);
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { ...data, lastName: data.lastName ?? "", ...emailEditData(before.email, data.email) } }),
    ...(partner ? [] : [prisma.leadActivity.create({ data: { leadId, type: "EDIT", content, createdBy: author.userName, createdById: author.userId } })]),
    prisma.leadInteraction.create({
      data: {
        leadId, type: "SYSTEM", channel: "SYSTEM", body: content,
        ...authorColumns(author), metadata: { kind: "lead_edit", fields, ...(partner ? { via: "partner" } : {}) },
      },
    }),
  ]);
  return { kind: "ok", changed };
}
