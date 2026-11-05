"use server";
import { revalidatePath } from "next/cache";
import { requireCrmUser } from "@/lib/crm/session";
import { acceptHandover, setKeepFix } from "@/lib/crm/handoverReview";
import { takeOverPartnerLead } from "@/lib/crm/partnerTakeover";
import type { ReviewResult } from "@/lib/crm/claimReview";

// A partner's handover request (partner pipeline, 2026-11-05): Accept on Today/Inbox, the
// keep-FIX toggle on the lead cockpit, and "Take over" for a partner-worked lead the partner can
// no longer work. Every export checks the session itself (middleware does not guard server
// actions); who may act (admin, owner or the partner's manager) is decided inside, on the rows
// read under the lead lock.

const idOk = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

export async function acceptHandoverAction(requestId: string, keepFix: boolean): Promise<{ ok: true; ownerName?: string; mine?: boolean } | { error: string }> {
  const actor = await requireCrmUser();
  if (!idOk(requestId)) return { error: "Handover request not found." };
  const res = await acceptHandover(actor, requestId, keepFix === true);
  revalidatePath("/crm/today");
  revalidatePath("/crm/inbox");
  if ("ok" in res && res.leadId) revalidatePath(`/crm/leads/${res.leadId}`);
  return "ok" in res ? { ok: true, ownerName: res.ownerName, mine: res.ownerId === actor.id } : res;
}

export async function setKeepFixAction(leadId: string, keep: boolean): Promise<ReviewResult> {
  const actor = await requireCrmUser();
  if (!idOk(leadId)) return { error: "Lead not found." };
  const res = await setKeepFix(actor, leadId, keep === true);
  if ("ok" in res) revalidatePath(`/crm/leads/${leadId}`);
  return res;
}

export async function takeOverPartnerLeadAction(leadId: string): Promise<{ ok: true; ownerName: string; mine: boolean } | { error: string }> {
  const actor = await requireCrmUser();
  if (!idOk(leadId)) return { error: "Lead not found." };
  const res = await takeOverPartnerLead(actor, leadId);
  if ("error" in res) return res;
  revalidatePath(`/crm/leads/${leadId}`);
  revalidatePath("/crm/partner-pipelines");
  revalidatePath("/crm/today");
  return { ok: true, ownerName: res.ownerName, mine: res.ownerId === actor.id };
}
