// The one list of lead statuses (CRM v2, 2026-10-18). Before this, eight files
// carried their own copy of the array; adding a status meant finding all of
// them. Everything that needs order, grouping or a label imports from here.

export const LEAD_STATUSES = [
  "NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "KEEP_CONTACT", "CLOSED", "LOST",
] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

// Kanban order. KEEP_CONTACT runs parallel to the funnel and LOST leaves it.
export const FUNNEL_STATUSES = [
  "NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED",
] as const satisfies readonly LeadStatusValue[];

// Listed under the board, outside the funnel columns.
export const SIDE_STATUSES = ["KEEP_CONTACT", "LOST"] as const satisfies readonly LeadStatusValue[];

// Statuses the stale-follow-up rules nag about (see actionCenter/rules/crm.ts).
export const ACTIVE_LEAD_STATUSES = [
  "NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED",
] as const satisfies readonly LeadStatusValue[];

// Statuses that cannot be reached without real contact having happened.
export const ELEVATED_NO_CONTACT_STATUSES = [
  "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "RESERVED",
] as const satisfies readonly LeadStatusValue[];

// The compose flow treats these as "already in conversation".
export const COMMUNICATING_STATUSES = ELEVATED_NO_CONTACT_STATUSES;

export const STATUS_LABEL: Record<LeadStatusValue, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  COMMUNICATING: "Communicating",
  VIEWING_SCHEDULED: "Viewing scheduled",
  OFFER: "Offer",
  RESERVED: "Reserved",
  KEEP_CONTACT: "Keep contact",
  CLOSED: "Closed",
  LOST: "Lost",
};

export const LOST_REASONS = [
  "BUDGET", "BOUGHT_ELSEWHERE", "UNREACHABLE", "NOT_INTERESTED", "TIMING", "INVALID", "OTHER",
] as const;
export type LostReasonValue = (typeof LOST_REASONS)[number];

export const LOST_REASON_LABEL: Record<LostReasonValue, string> = {
  BUDGET: "Budget does not fit",
  BOUGHT_ELSEWHERE: "Bought elsewhere",
  UNREACHABLE: "Not reachable",
  NOT_INTERESTED: "No longer interested",
  TIMING: "Not the right time",
  INVALID: "Invalid or spam",
  OTHER: "Other",
};

export function isLeadStatus(x: unknown): x is LeadStatusValue {
  return typeof x === "string" && (LEAD_STATUSES as readonly string[]).includes(x);
}
