"use server";
/**
 * Phase 3e: presentations a partner sends to their own clients. Scoped to the session's own partner
 * (requirePartner({ active: true })). The allowed clients (effectively ACTIVE claims) and projects
 * (myProjects) are built on the server; nothing from the form is trusted beyond membership in them.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { uniquePresentationToken } from "@/lib/crm/presentationToken";
import { writePartnerAudit } from "@/lib/partner/audit";
import { partnerLimits as L } from "@/lib/partner/limits";
import { allowedPresentationSets, buildPresentationCreate, draftFromForm, presentationUrl } from "@/lib/partner/partnerPresentations";
import { validatePresentationDraft } from "@/lib/partner/presentationDraft";
import { myPresentationClients, myProjects } from "@/lib/partner/scope";
import { requirePartner } from "@/lib/partner/session";
import type { PresentationState } from "./formState";

class ClaimGone extends Error {}

export async function createPresentationAction(_prev: PresentationState, fd: FormData): Promise<PresentationState> {
  const me = await requirePartner({ active: true });
  if (!L.presentation.hit(me.partner.id)) return { error: "err.rateLimited" };
  const now = new Date();
  const [clients, mine] = await Promise.all([myPresentationClients(me.partner.id, now), myProjects(me.partner.id)]);
  const v = validatePresentationDraft(draftFromForm(fd), allowedPresentationSets(clients, mine.projects));
  if (!v.ok) return { error: v.code, field: v.field };
  const client = clients.find((c) => c.claimId === v.data.claimId);
  if (!client) return { error: "err.presentationClient", field: "claimId" };
  const lead = await prisma.lead.findUnique({ where: { id: client.leadId }, select: { budgetMin: true, budgetMax: true } });
  if (!lead) return { error: "err.presentationClient", field: "claimId" };
  const token = await uniquePresentationToken();
  const data = buildPresentationCreate({ draft: v.data, leadId: client.leadId, lead, partnerId: me.partner.id, token, now });
  try {
    await prisma.$transaction(async (tx) => {
      // The claim must still be this partner's ACTIVE claim on that lead at write time.
      const claim = await tx.partnerClaim.findFirst({
        where: { id: client.claimId, partnerId: me.partner.id, leadId: client.leadId, state: "ACTIVE" },
        select: { id: true },
      });
      if (!claim) throw new ClaimGone();
      const created = await tx.clientPresentation.create({
        data: { ...data.presentation, items: { create: data.items } },
        select: { id: true },
      });
      await writePartnerAudit(me.partner, me.user, "partner_presentation_created", {
        presentationId: created.id, claimId: client.claimId, projects: data.items.length,
      }, tx);
    });
  } catch (e) {
    if (e instanceof ClaimGone) return { error: "err.presentationClient", field: "claimId" };
    throw e;
  }
  revalidatePath("/partner-portal/presentations");
  return { ok: true, url: presentationUrl(token) };
}

export async function revokePresentationAction(fd: FormData): Promise<void> {
  const me = await requirePartner({ active: true });
  if (!L.presentation.hit(me.partner.id)) return;
  const id = fd.get("id");
  if (typeof id !== "string" || !id || id.length > 64) return;
  // Guarded: only this partner's own presentation, and only once.
  const r = await prisma.clientPresentation.updateMany({
    where: { id, partnerId: me.partner.id, status: { not: "revoked" } },
    data: { status: "revoked" },
  });
  if (r.count) await writePartnerAudit(me.partner, me.user, "partner_presentation_revoked", { presentationId: id });
  revalidatePath("/partner-portal/presentations");
}
