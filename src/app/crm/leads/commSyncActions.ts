"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCrmUser } from "@/lib/crm/session";
import { canEditLead } from "@/lib/crm/access";
import { syncLeadEmail, syncLeadWhatsApp } from "@/lib/crm/commSync";
import { syncSummary } from "@/lib/crm/commSyncSummary";

// Cockpit "Sync": pull this lead's WhatsApp thread and mail (inbox + sent) into the timeline now.
// Middleware does not protect server actions: the session and canEditLead are checked here.
export async function syncLeadCommsAction(leadId: unknown): Promise<{ ok: true; message: string } | { error: string }> {
  const user = await requireCrmUser();
  if (typeof leadId !== "string" || !leadId || leadId.length > 64) return { error: "Lead not found." };
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, assignedToId: true, phone: true, email: true } });
  if (!lead || !canEditLead(user, lead)) return { error: "Lead not found." };

  const [wa, mail] = await Promise.all([
    lead.phone ? syncLeadWhatsApp(lead.phone) : Promise.resolve(null),
    lead.email ? syncLeadEmail(lead.email) : Promise.resolve(null),
  ]);
  revalidatePath(`/crm/leads/${lead.id}`);
  return { ok: true, message: syncSummary(wa, mail) };
}
