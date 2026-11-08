import { prisma } from "@/lib/prisma";
import { canEditLead, leadEditError } from "./access";
import { authorColumns } from "./leadActor";
import { insertDeal, moveLead } from "./moveLead";
import { writeAudit } from "./audit";
import type { DealInput } from "./dealInput";
import { shouldMoveToReserved } from "./addDealRules";
import type { SessionCrmUser } from "./session";

// Cockpit "New deal" (operator, 2026-11-08): a deal entered by hand, at any
// stage, by whoever may edit the lead (admins and the lead's owner). With
// moveToReserved the lead then moves to Reserved when it is still before it;
// that move finds the new deal and does not ask for another one.

/** warning: the deal is saved but the follow-up move failed; the dialog must close (a retry would add a second deal). */
export type AddDealResult = { ok: true; moved: boolean; warning?: string } | { error: string };

export async function addDeal(actor: SessionCrmUser, leadId: string, deal: DealInput, moveToReserved: boolean): Promise<AddDealResult> {
  const author = authorColumns({ userId: actor.id, userName: actor.name });
  const res = await prisma.$transaction(async (tx): Promise<{ ok: true; status: string; dealId: string } | { error: string }> => {
    await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE`;
    const lead = await tx.lead.findFirst({
      where: { id: leadId },
      select: { status: true, assignedToId: true, workedByPartner: true, partnerId: true, partnerMode: true, deletedAt: true, deals: { select: { commissionStatus: true } } },
    });
    if (!lead || lead.deletedAt) return { error: "Lead not found." };
    if (!canEditLead(actor, lead)) return { error: leadEditError(actor, lead) ?? "Lead not found." };
    // A lead already Closed gets the deal as earned, as the move to Closed would.
    const made = await insertDeal(tx, { lead, leadId, deal, earnNow: lead.status === "CLOSED", now: new Date(), author });
    if ("error" in made) return made;
    await writeAudit(actor, "deal_created", "lead", leadId, {
      dealId: made.id, price: deal.price,
      ...(deal.developmentId ? { developmentId: deal.developmentId } : { projectName: deal.projectName }),
      ...(deal.developerAccountId ? { developerAccountId: deal.developerAccountId } : deal.developerName ? { developerName: deal.developerName } : {}),
      ...(deal.ratePercent != null ? { ratePercent: deal.ratePercent } : {}),
    }, tx);
    return { ok: true, status: lead.status, dealId: made.id };
  });
  if ("error" in res) return res;
  if (!shouldMoveToReserved(res.status, moveToReserved)) return { ok: true, moved: false };
  const moved = await moveLead(actor, leadId, "RESERVED", {});
  if ("error" in moved) return { ok: true, moved: false, warning: `The deal is saved, but the lead could not move to Reserved: ${moved.error}` };
  return { ok: true, moved: true };
}
