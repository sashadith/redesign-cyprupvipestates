// Pure helpers for the staff side of partner claims (partner portal phase 3b, task 5):
// review cards in /crm/inbox, the Accept precondition, the partner card on the lead
// cockpit, the outbox ref keys and the partner share on new deals. No DB access, so
// the tests and the client components can import it without Prisma.
import { adminDate } from "@/lib/adminTime";
import { claimProtection } from "@/lib/partner/claims";
import { partnerShareFor } from "@/lib/partner/share";
import { SOURCE_LABEL } from "./boardModel";
import { STATUS_LABEL, isLeadStatus } from "./leadStatus";

/** Lead statuses that commit a claim: protection never runs out (same rule as the portal). */
export const COMMITTED_LEAD_STATUSES = ["RESERVED", "CLOSED"] as const;

export const PROTECTION_ACTIVE_ERROR = "Another partner's client protection is still active.";
export const PARTNER_MESSAGE_MAX = 2000;
export const OUTCOME_NOTE_MAX = 1000;
export const REVIEW_CAP = 50;

export type ClaimStateValue = "ACTIVE" | "IN_REVIEW" | "REJECTED" | "EXPIRED";
export type PartnerModeValue = "HANDOVER" | "FIX";

// ── Outbox ref keys (decision 10) ─────────────────────────────────────────
export const claimOutcomeRefKey = (claimId: string, state: "ACTIVE" | "REJECTED") => `claim:${claimId}:${state}`;
export const messageRefKey = (messageId: string) => `msg:${messageId}`;

// ── Labels (CRM copy: English) ────────────────────────────────────────────
export const MODE_LABEL: Record<PartnerModeValue, string> = { HANDOVER: "Handover", FIX: "Fix" };
export const CONTACT_MODE_LABEL: Record<string, string> = {
  DIRECT: "We contact the client directly",
  VIA_PARTNER: "Via the partner",
  VIA_PARTNER_REP: "Via the partner's representative",
  VIA_CLIENT_REP: "Via the client's representative",
};
export const CLAIM_STATE_LABEL: Record<ClaimStateValue, string> = {
  ACTIVE: "Active", IN_REVIEW: "In review", REJECTED: "Rejected", EXPIRED: "Expired",
};
export const PARTNER_TYPE_LABEL: Record<string, string> = {
  REAL_ESTATE: "Real estate", PRIVATE_BROKER: "Private broker", BANK: "Bank", INVESTMENT: "Investment", FAMILY_OFFICE: "Family office",
  TOURISM: "Tourism", DESIGN: "Interior & design", LEGAL: "Legal", OTHER: "Other",
};

export function partnerName(p: { company: string | null; firstName: string; lastName: string }): string {
  const person = `${p.firstName} ${p.lastName}`.trim();
  const company = p.company?.trim();
  return company ? `${company} (${person})` : person;
}


// ── Protection status of an ACTIVE claim ─────────────────────────────────
export type ProtectionStatus =
  | { kind: "committed" }
  | { kind: "protected"; until: Date }
  | { kind: "expired"; until: Date };

/** Committed (RESERVED/CLOSED or a non-cancelled deal) beats the computed expiry, as in the portal. */
export function protectionStatus(input: {
  claimCreatedAt: Date; lastRealContactAt: Date | null; now: Date; hasDeal: boolean; leadStatus: string;
}): ProtectionStatus {
  if (input.hasDeal || (COMMITTED_LEAD_STATUSES as readonly string[]).includes(input.leadStatus)) return { kind: "committed" };
  const p = claimProtection({ claimCreatedAt: input.claimCreatedAt, lastRealContactAt: input.lastRealContactAt, now: input.now });
  return p.expired ? { kind: "expired", until: p.protectedUntil } : { kind: "protected", until: p.protectedUntil };
}

export function protectionLabel(s: ProtectionStatus): string {
  if (s.kind === "committed") return "Secured — reserved, closed or a live deal";
  return s.kind === "expired" ? `Protection expired ${adminDate(s.until)}` : `Protected until ${adminDate(s.until)}`;
}

// ── Accept precondition (decision 3 + 4) ─────────────────────────────────
export type AcceptDecision = { kind: "ACCEPT" } | { kind: "EXPIRE_OTHER_THEN_ACCEPT" } | { kind: "BLOCKED"; error: string };

/**
 * May an IN_REVIEW claim be accepted? Only one ACTIVE claim per lead: another ACTIVE claim blocks
 * unless its protection has run out AND it is not committed (no non-cancelled deal, lead not
 * RESERVED/CLOSED) — then Accept marks it EXPIRED in the same transaction.
 */
export function acceptDecision(input: {
  otherActive: boolean;
  protection: { expired: boolean } | null;
  hasDeal: boolean;
  status: string;
}): AcceptDecision {
  if (!input.otherActive) return { kind: "ACCEPT" };
  const committed = input.hasDeal || (COMMITTED_LEAD_STATUSES as readonly string[]).includes(input.status);
  if (committed || !input.protection?.expired) return { kind: "BLOCKED", error: PROTECTION_ACTIVE_ERROR };
  return { kind: "EXPIRE_OTHER_THEN_ACCEPT" };
}

// ── Partner share on a new deal (decision 9) ─────────────────────────────
/**
 * Percent of our commission the partner earns on a deal, or null when no partner holds the client.
 * Only an ACTIVE claim of the lead's partner counts. A suspended partner still gets the share —
 * the commission is owed for the client they brought. A lead without a mode is a handover.
 */
export function dealPartnerShare(input: {
  partnerId: string | null;
  partnerMode: PartnerModeValue | null;
  activeClaimPartnerId: string | null;
  partner: { handoverShare: number; fixShare: number; status?: string } | null;
}): number | null {
  if (!input.partnerId || !input.partner || input.activeClaimPartnerId !== input.partnerId) return null;
  return partnerShareFor({ mode: input.partnerMode ?? "HANDOVER", handoverShare: input.partner.handoverShare, fixShare: input.partner.fixShare });
}

// ── Message to partner ────────────────────────────────────────────────────
export function validatePartnerMessage(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const body = typeof raw === "string" ? raw.trim() : "";
  if (!body) return { ok: false, error: "Write a message first." };
  if (body.length > PARTNER_MESSAGE_MAX) return { ok: false, error: `Keep it under ${PARTNER_MESSAGE_MAX} characters.` };
  return { ok: true, body };
}

export function normaliseOutcomeNote(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s.slice(0, OUTCOME_NOTE_MAX) : null;
}

// ── Review card DTO (inbox) ───────────────────────────────────────────────
type PartnerLite = { id: string; company: string | null; firstName: string; lastName: string; status: string };

export type RawReviewClaim = {
  id: string;
  createdAt: Date;
  mode: PartnerModeValue;
  contactMode: string;
  submission: unknown;
  partner: PartnerLite;
  lead: {
    id: string; firstName: string; lastName: string; email: string | null; phone: string | null; status: string; source: string;
    createdAt: Date; deletedAt: Date | null; ownerName: string | null; hasDeal: boolean; lastRealContactAt: Date | null;
    claims: { id: string; state: ClaimStateValue; mode: PartnerModeValue; createdAt: Date; partner: PartnerLite }[];
  };
};

export type ReviewCard = {
  id: string;
  submittedAt: string;
  partner: string;
  partnerSuspended: boolean;
  submission: {
    name: string; email: string | null; phone: string | null; mode: string; contactMode: string; rep: string | null;
    projects: string | null; comment: string | null;
  };
  lead: {
    id: string; name: string; email: string | null; phone: string | null; owner: string | null; stage: string; source: string;
    createdAt: string; lastRealContact: string | null; trashed: boolean;
  };
  others: { id: string; partner: string; state: string; mode: string; createdAt: string; protection: string | null }[];
  /** What Accept would do right now (re-checked inside the transaction). */
  accept: { blocked: boolean; note: string | null };
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Reads the partner's typed submission defensively: the JSON is ours, but never trust its shape. */
export function readSubmission(raw: unknown) {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const projects = Array.isArray(o.projects)
    ? o.projects.map((p) => (p && typeof p === "object" ? str((p as Record<string, unknown>).name) : null)).filter((s): s is string => !!s)
    : [];
  const projectsText = str(o.projectsText);
  const all = [...projects, ...(projectsText ? [projectsText] : [])];
  return {
    firstName: str(o.firstName) ?? "", lastName: str(o.lastName) ?? "",
    email: str(o.email), phone: str(o.phone),
    repName: str(o.repName), repPhone: str(o.repPhone),
    projects: all.length ? all.join(", ") : null,
    comment: str(o.comment),
  };
}

export function buildReviewCard(c: RawReviewClaim, now: Date): ReviewCard {
  const s = readSubmission(c.submission);
  const rep = [s.repName, s.repPhone].filter(Boolean).join(" · ") || null;
  const others = c.lead.claims.filter((o) => o.id !== c.id);
  const statusOf = (o: { state: ClaimStateValue; createdAt: Date }) =>
    o.state === "ACTIVE"
      ? protectionStatus({ claimCreatedAt: o.createdAt, lastRealContactAt: c.lead.lastRealContactAt, now, hasDeal: c.lead.hasDeal, leadStatus: c.lead.status })
      : null;
  const otherActive = others.find((o) => o.state === "ACTIVE") ?? null;
  const otherStatus = otherActive ? statusOf(otherActive) : null;
  const decision = c.lead.deletedAt
    ? { kind: "BLOCKED" as const, error: "The lead is in the trash." }
    : acceptDecision({
      otherActive: !!otherActive,
      protection: otherStatus ? { expired: otherStatus.kind === "expired" } : null,
      hasDeal: c.lead.hasDeal,
      status: c.lead.status,
    });
  return {
    id: c.id,
    submittedAt: c.createdAt.toISOString(),
    partner: partnerName(c.partner),
    partnerSuspended: c.partner.status === "SUSPENDED",
    submission: {
      name: `${s.firstName} ${s.lastName}`.trim() || "—",
      email: s.email, phone: s.phone,
      mode: MODE_LABEL[c.mode] ?? c.mode,
      contactMode: CONTACT_MODE_LABEL[c.contactMode] ?? c.contactMode,
      rep, projects: s.projects, comment: s.comment,
    },
    lead: {
      id: c.lead.id,
      name: `${c.lead.firstName} ${c.lead.lastName}`.trim() || "Unnamed lead",
      email: c.lead.email, phone: c.lead.phone,
      owner: c.lead.ownerName,
      stage: isLeadStatus(c.lead.status) ? STATUS_LABEL[c.lead.status] : c.lead.status,
      source: SOURCE_LABEL[c.lead.source] ?? c.lead.source,
      createdAt: c.lead.createdAt.toISOString(),
      lastRealContact: c.lead.lastRealContactAt ? c.lead.lastRealContactAt.toISOString() : null,
      trashed: !!c.lead.deletedAt,
    },
    others: others.map((o) => {
      const st = statusOf(o);
      return {
        id: o.id, partner: partnerName(o.partner), state: CLAIM_STATE_LABEL[o.state], mode: MODE_LABEL[o.mode] ?? o.mode,
        createdAt: o.createdAt.toISOString(), protection: st ? protectionLabel(st) : null,
      };
    }),
    accept: decision.kind === "BLOCKED"
      ? { blocked: true, note: decision.error }
      : decision.kind === "EXPIRE_OTHER_THEN_ACCEPT"
        ? { blocked: false, note: "Accepting marks the other partner's expired claim as expired." }
        : { blocked: false, note: null },
  };
}

// ── Cockpit partner card ──────────────────────────────────────────────────
/** The claim the card describes: the ACTIVE one, else the newest decided one (IN_REVIEW claims are listed apart). */
export function pickCardClaim<T extends { state: ClaimStateValue; createdAt: Date }>(claims: T[]): T | null {
  const active = claims.find((c) => c.state === "ACTIVE");
  if (active) return active;
  const decided = claims.filter((c) => c.state !== "IN_REVIEW").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return decided[0] ?? null;
}

export type RawCockpitClaim = {
  id: string; state: ClaimStateValue; mode: PartnerModeValue; contactMode: string; createdAt: Date; submission: unknown;
  partner: PartnerLite & { type: string };
};

/** Partner card data for the cockpit; null when the lead has no claim at all. */
export function buildCockpitPartnerCard(input: {
  claims: RawCockpitClaim[];
  lead: { status: string; hasDeal: boolean; lastRealContactAt: Date | null; contactRepName: string | null; contactRepPhone: string | null };
  now: Date;
}) {
  if (!input.claims.length) return null;
  const c = pickCardClaim(input.claims);
  const inReview = input.claims
    .filter((x) => x.state === "IN_REVIEW")
    .map((x) => ({ id: x.id, partner: partnerName(x.partner), submittedAt: x.createdAt.toISOString() }));
  let card = null;
  if (c) {
    const isActive = c.state === "ACTIVE";
    // The lead's rep fields belong to the ACTIVE claim; any other claim shows what its partner typed.
    const sub = readSubmission(c.submission);
    const repName = isActive ? input.lead.contactRepName : sub.repName;
    const repPhone = isActive ? input.lead.contactRepPhone : sub.repPhone;
    const protection = isActive
      ? protectionLabel(protectionStatus({
        claimCreatedAt: c.createdAt, lastRealContactAt: input.lead.lastRealContactAt, now: input.now, hasDeal: input.lead.hasDeal, leadStatus: input.lead.status,
      }))
      : null;
    card = {
      partner: partnerName(c.partner),
      type: PARTNER_TYPE_LABEL[c.partner.type] ?? c.partner.type,
      status: c.partner.status,
      mode: MODE_LABEL[c.mode] ?? c.mode,
      contactMode: CONTACT_MODE_LABEL[c.contactMode] ?? c.contactMode,
      rep: [repName, repPhone].filter(Boolean).join(" · ") || null,
      state: CLAIM_STATE_LABEL[c.state],
      isActive,
      protection,
    };
  }
  return { card, inReview, hasActive: c?.state === "ACTIVE" };
}
