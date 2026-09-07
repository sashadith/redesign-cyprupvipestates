import type { LeadInteractionType, Prisma } from "@prisma/client";
import { bucketOf } from "@/lib/crm/leadBucket";
import { LAST_CONTACT_TYPES } from "@/app/admin/(panel)/crm/leadListShared";
import { fmtDate } from "./format";

export const CONTACT_TYPES = [...LAST_CONTACT_TYPES] as LeadInteractionType[];

// The one select every list-style tool uses. Explicit on purpose: nothing
// that is not listed here can reach the model (no UTM/click ids, no
// lastMatchFilters, no notes — those are crm_get_lead's business).
export const LEAD_ROW_SELECT = {
  id: true, firstName: true, lastName: true, email: true, phone: true, status: true, source: true, countryOfResidence: true,
  languagePreference: true, budgetMin: true, budgetMax: true, hotAt: true, nextFollowUpAt: true, createdAt: true,
  projectInterest: { select: { title: true } },
  interactions: { where: { type: { in: CONTACT_TYPES } }, orderBy: { occurredAt: "desc" as const }, take: 1, select: { type: true, occurredAt: true } },
} satisfies Prisma.LeadSelect;

export type LeadRowSource = Prisma.LeadGetPayload<{ select: typeof LEAD_ROW_SELECT }>;

export function leadRow(l: LeadRowSource) {
  const last = l.interactions[0];
  return {
    leadId: l.id,
    name: `${l.firstName} ${l.lastName}`.trim(),
    email: l.email,
    phone: l.phone,
    status: l.status,
    source: l.source,
    bucket: bucketOf(l.source),
    countryOfResidence: l.countryOfResidence,
    language: l.languagePreference,
    budget: { min: l.budgetMin, max: l.budgetMax },
    projectInterest: l.projectInterest?.title ?? null,
    hot: l.hotAt != null,
    hotSince: fmtDate(l.hotAt),
    nextFollowUpAt: fmtDate(l.nextFollowUpAt),
    lastContact: last ? { type: last.type, at: fmtDate(last.occurredAt) } : null,
    createdAt: fmtDate(l.createdAt),
  };
}
