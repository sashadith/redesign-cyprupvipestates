"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PARTNER_AGREEMENT_VERSION } from "@/lib/partner/agreement";
import { needsAgreementAcceptance } from "@/lib/partner/agreementGate";
import { partnerClientIp } from "@/lib/partner/clientIp";
import { getPartner } from "@/lib/partner/session";

/**
 * Records the logged-in partner's acceptance of the current agreement version (clause 13.1) and
 * returns them to the portal. getPartner, not requirePartner: requirePartner would send an
 * unaccepted partner straight back to /agreement.
 */
export async function acceptAgreementAction(formData: FormData): Promise<void> {
  const me = await getPartner();
  if (!me) redirect("/login");
  if (formData.get("accept") !== "on") redirect("/agreement");
  if (await needsAgreementAcceptance(me.partner)) {
    await prisma.partnerAgreementAcceptance.create({
      data: { partnerId: me.partner.id, version: PARTNER_AGREEMENT_VERSION, ip: partnerClientIp(headers()) },
    });
  }
  redirect("/home");
}
