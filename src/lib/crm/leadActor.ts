import type { EmailActor } from "./sendLeadEmail";

// Who writes to a lead (partner pipeline, 2026-11-05): a CRM user, or a partner
// user working his own FIX client. Pure: no prisma, safe for tests.

export type PartnerActor = { partnerUserId: string; partnerId: string; userName: string };
export type LeadActor = EmailActor | PartnerActor;

export function isPartnerActor(a: LeadActor): a is PartnerActor {
  return "partnerUserId" in a;
}

// The author columns of a LeadInteraction row. LeadActivity is staff-only, so
// a partner write never creates one.
export function authorColumns(a: LeadActor): { createdByUserId: string | null; createdByPartnerUserId: string | null; createdByName: string } {
  return isPartnerActor(a)
    ? { createdByUserId: null, createdByPartnerUserId: a.partnerUserId, createdByName: a.userName }
    : { createdByUserId: a.userId, createdByPartnerUserId: null, createdByName: a.userName };
}
