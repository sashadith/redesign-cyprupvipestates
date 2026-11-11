"use server";
/**
 * Phase 3e: presentations a partner sends to their own clients. Creating and editing live in
 * presentationBuilderActions.ts (2026-11-11); this file keeps the revoke. Scoped to the session's own partner
 * (requirePartner({ active: true })). The allowed clients (effectively ACTIVE claims) and projects
 * (myProjects) are built on the server; nothing from the form is trusted beyond membership in them.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writePartnerAudit } from "@/lib/partner/audit";
import { partnerLimits as L } from "@/lib/partner/limits";
import { requirePartner } from "@/lib/partner/session";

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
