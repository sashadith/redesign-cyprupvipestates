// Re-acceptance gate for the partner agreement (clause 13.1): an ACTIVE partner who has not accepted
// the current PARTNER_AGREEMENT_VERSION may only read and accept it. requirePartner / partnerForRoute
// send such a partner to /agreement; the accept action records the acceptance.
import { prisma } from "@/lib/prisma";
import { PARTNER_AGREEMENT_VERSION } from "./agreement";

/** True when the partner must still accept the current agreement version. Only ACTIVE partners are gated. */
export async function needsAgreementAcceptance(partner: { id: string; status: string }): Promise<boolean> {
  if (partner.status !== "ACTIVE") return false;
  const hit = await prisma.partnerAgreementAcceptance.findFirst({
    where: { partnerId: partner.id, version: PARTNER_AGREEMENT_VERSION },
    select: { id: true },
  });
  return !hit;
}
