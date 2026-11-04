import type { LeadInteractionType, Prisma } from "@prisma/client";
import { bucketOf } from "@/lib/crm/leadBucket";
import { LAST_CONTACT_TYPES } from "@/app/admin/(panel)/crm/leadListShared";
import { fmtDate } from "./format";
import { leadHints } from "@/lib/crm/leadHints";
import { leadTimeFields } from "./leadTime";

export const CONTACT_TYPES = [...LAST_CONTACT_TYPES] as LeadInteractionType[];

// The one select every list-style tool uses. Explicit on purpose: nothing
// that is not listed here can reach the model (no UTM/click ids, no notes —
// those are crm_get_lead's business; lastMatchFilters is never returned raw —
// crm_match_properties uses it as an input only).
export const LEAD_ROW_SELECT = {
  id: true, firstName: true, lastName: true, email: true, phone: true, status: true, lostReason: true, source: true, countryOfResidence: true,
  languagePreference: true, budgetMin: true, budgetMax: true, hotAt: true, nextFollowUpAt: true, createdAt: true,
  guideTitle: true, guideLanguage: true, emailInvalidAt: true, emailInvalidReason: true, timeZone: true,
  projectInterest: { select: { title: true } },
  interactions: { where: { type: { in: CONTACT_TYPES } }, orderBy: { occurredAt: "desc" as const }, take: 1, select: { type: true, occurredAt: true } },
} satisfies Prisma.LeadSelect;

export type LeadRowSource = Prisma.LeadGetPayload<{ select: typeof LEAD_ROW_SELECT }>;

export function leadRow(l: LeadRowSource) {
  const last = l.interactions[0];
  const hints = leadHints(l);
  return {
    leadId: l.id,
    name: `${l.firstName} ${l.lastName}`.trim(),
    email: l.email,
    emailInvalid: hints.emailInvalid,
    phone: l.phone,
    phoneType: hints.phoneType,
    status: l.status,
    lostReason: l.lostReason,
    source: l.source,
    bucket: bucketOf(l.source),
    countryOfResidence: l.countryOfResidence,
    language: l.languagePreference,
    budget: { min: l.budgetMin, max: l.budgetMax },
    budgetCurrencyUnverified: hints.budgetCurrencyUnverified,
    nameEmailMismatch: hints.nameEmailMismatch,
    projectInterest: l.projectInterest?.title ?? null,
    // GUIDE_DOWNLOAD leads (2026-10-19): the PDF guide they asked for. Null otherwise.
    guide: l.guideTitle ? { title: l.guideTitle, language: l.guideLanguage } : null,
    hot: l.hotAt != null,
    hotSince: fmtDate(l.hotAt),
    nextFollowUpAt: fmtDate(l.nextFollowUpAt),
    // Local time of the lead with a call light, and the follow-up as "KW 45 (02 - 06 Nov)" + the lead's clock.
    ...leadTimeFields(l),
    lastContact: last ? { type: last.type, at: fmtDate(last.occurredAt) } : null,
    createdAt: fmtDate(l.createdAt),
    // Soft warnings about the data (leadHints.ts); empty when there is nothing to check.
    hints: hints.messages,
  };
}
