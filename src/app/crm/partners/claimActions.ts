"use server";
import { revalidatePath } from "next/cache";
import { requireCrmUser } from "@/lib/crm/session";
import { canAssignLeads } from "@/lib/crm/access";
import { acceptClaim, rejectClaim, sendPartnerMessage, type ReviewResult } from "@/lib/crm/claimReview";

// Partner claim review (inbox) and "Message to partner" (lead cockpit) — phase 3b, task 5.
// Every export checks the session itself: middleware does not guard server actions.

const DENIED = "Only managers can review partner claims.";

export async function acceptClaimAction(claimId: string): Promise<ReviewResult> {
  const actor = await requireCrmUser();
  if (!canAssignLeads(actor)) return { error: DENIED };
  if (typeof claimId !== "string" || !claimId) return { error: "Claim not found." };
  const res = await acceptClaim(actor, claimId);
  revalidatePath("/crm/inbox");
  if ("ok" in res && res.leadId) revalidatePath(`/crm/leads/${res.leadId}`);
  return "ok" in res ? { ok: true } : res;
}

export async function rejectClaimAction(claimId: string, note: unknown): Promise<ReviewResult> {
  const actor = await requireCrmUser();
  if (!canAssignLeads(actor)) return { error: DENIED };
  if (typeof claimId !== "string" || !claimId) return { error: "Claim not found." };
  const res = await rejectClaim(actor, claimId, note);
  revalidatePath("/crm/inbox");
  return res;
}

export async function sendPartnerMessageAction(leadId: string, body: unknown): Promise<ReviewResult> {
  const actor = await requireCrmUser();
  if (typeof leadId !== "string" || !leadId) return { error: "Lead not found." };
  // canEditLead is checked inside, on the row read in the same transaction.
  const res = await sendPartnerMessage(actor, leadId, body);
  if ("ok" in res) revalidatePath(`/crm/leads/${leadId}`);
  return res;
}
