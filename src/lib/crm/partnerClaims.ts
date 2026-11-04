// Pure helpers for the staff side of partner claims (partner portal phase 3b, task 5):
// review cards in /crm/inbox, the Accept precondition, the partner card on the lead
// cockpit, the outbox ref keys and the partner share on new deals. No DB access, so
// the tests and the client components can import it without Prisma.
import { adminDate } from "@/lib/adminTime";
import { claimProtection } from "@/lib/partner/claims";
import { COMMITTED_LEAD_STATUSES, activeSince, effectiveClaimState, isCommitted, type ClaimStateValue, type EffectiveClaimState } from "@/lib/partner/claimState";
import { partnerShareFor } from "@/lib/partner/share";
import { SOURCE_LABEL } from "./boardModel";
import { STATUS_LABEL, isLeadStatus } from "./leadStatus";

export { COMMITTED_LEAD_STATUSES, type ClaimStateValue, type EffectiveClaimState };

export const PROTECTION_ACTIVE_ERROR = "Another partner's client protection is still active.";
export const SAME_PARTNER_ACTIVE_ERROR = "This partner already holds this client — reject the duplicate claim.";
export const MESSAGE_NO_ACTIVE_ERROR = "No partner holds this client right now.";
export const PARTNER_MESSAGE_MAX = 2000;
export const OUTCOME_NOTE_MAX = 1000;
export const REVIEW_CAP = 50;

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

/** Short partner label on a cockpit message: the company, else the person's name. */
export function messagePartnerLabel(p: { company: string | null; firstName: string; lastName: string }): string {
  return p.company?.trim() || `${p.firstName} ${p.lastName}`.trim() || "Partner";
}

// ── Protection status of an ACTIVE claim ─────────────────────────────────
export type ProtectionStatus =
  | { kind: "committed" }
  | { kind: "protected"; until: Date }
  | { kind: "expired"; until: Date };

/**
 * Label data for an ACTIVE claim on a live lead — the same rule as effectiveClaimState (committed beats
 * the computed expiry; protection runs from activeSince). `kind` is "expired" exactly when
 * effectiveClaimState would say EXPIRED.
 */
export function protectionStatus(input: {
  activeSince: Date; lastRealContactAt: Date | null; now: Date; hasDeal: boolean; leadStatus: string;
}): ProtectionStatus {
  if (isCommitted({ leadStatus: input.leadStatus, hasLiveDeal: input.hasDeal })) return { kind: "committed" };
  const p = claimProtection({ claimCreatedAt: input.activeSince, lastRealContactAt: input.lastRealContactAt, now: input.now });
  return p.expired ? { kind: "expired", until: p.protectedUntil } : { kind: "protected", until: p.protectedUntil };
}

export function protectionLabel(s: ProtectionStatus): string {
  if (s.kind === "committed") return "Secured — reserved, closed or a live deal";
  return s.kind === "expired" ? `Protection expired ${adminDate(s.until)}` : `Protected until ${adminDate(s.until)}`;
}

// ── Accept precondition (decision 3 + 4) ─────────────────────────────────
export type AcceptDecision = { kind: "ACCEPT" } | { kind: "EXPIRE_OTHER_THEN_ACCEPT" } | { kind: "BLOCKED"; error: string };

/**
 * May an IN_REVIEW claim be accepted? Only one ACTIVE claim per lead. `other` is the lead's other
 * ACTIVE claim with its effective state (effectiveClaimState). Effectively EXPIRED → Accept marks it
 * EXPIRED in the same transaction, whichever partner held it (also the same partner's own lapsed claim).
 * Anything else (still protected, or committed) blocks — with a distinct message for the same partner.
 */
export function acceptDecision(input: {
  other: { samePartner: boolean; effective: EffectiveClaimState } | null;
}): AcceptDecision {
  const o = input.other;
  if (!o) return { kind: "ACCEPT" };
  if (o.effective === "EXPIRED") return { kind: "EXPIRE_OTHER_THEN_ACCEPT" };
  return { kind: "BLOCKED", error: o.samePartner ? SAME_PARTNER_ACTIVE_ERROR : PROTECTION_ACTIVE_ERROR };
}

// ── Partner share on a new deal (decision 9) ─────────────────────────────
/**
 * Percent of our commission the partner earns on a deal, or null when no partner holds the client.
 * Only a claim of the lead's partner that is EFFECTIVELY active (effectiveClaimState, evaluated on the
 * lead as it was before this move) counts. A suspended partner still gets the share — the commission
 * is owed for the client they brought. A lead without a mode is a handover.
 */
export function dealPartnerShare(input: {
  partnerId: string | null;
  partnerMode: PartnerModeValue | null;
  activeClaim: { partnerId: string; effective: EffectiveClaimState } | null;
  partner: { handoverShare: number; fixShare: number; status?: string } | null;
}): number | null {
  const c = input.activeClaim;
  if (!input.partnerId || !input.partner || !c || c.partnerId !== input.partnerId || c.effective !== "ACTIVE") return null;
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
    claims: { id: string; state: ClaimStateValue; mode: PartnerModeValue; createdAt: Date; reviewedAt?: Date | null; partner: PartnerLite }[];
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
  const statusOf = (o: { state: ClaimStateValue; createdAt: Date; reviewedAt?: Date | null }) =>
    o.state === "ACTIVE"
      ? protectionStatus({ activeSince: activeSince(o), lastRealContactAt: c.lead.lastRealContactAt, now, hasDeal: c.lead.hasDeal, leadStatus: c.lead.status })
      : null;
  const otherActive = others.find((o) => o.state === "ACTIVE") ?? null;
  const decision = c.lead.deletedAt
    ? { kind: "BLOCKED" as const, error: "The lead is in the trash." }
    : acceptDecision({
      other: otherActive
        ? {
          samePartner: otherActive.partner.id === c.partner.id,
          effective: effectiveClaimState({
            state: otherActive.state, activeSince: activeSince(otherActive), lastRealContactAt: c.lead.lastRealContactAt, now,
            leadDeleted: false, leadStatus: c.lead.status, hasLiveDeal: c.lead.hasDeal,
          }),
        }
        : null,
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
        ? { blocked: false, note: "Accepting marks the earlier claim, whose protection has run out, as expired." }
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
  id: string; state: ClaimStateValue; mode: PartnerModeValue; contactMode: string; createdAt: Date; reviewedAt?: Date | null; submission: unknown;
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
        activeSince: activeSince(c), lastRealContactAt: input.lead.lastRealContactAt, now: input.now, hasDeal: input.lead.hasDeal, leadStatus: input.lead.status,
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
  // The composer (and sendPartnerMessage) need an EFFECTIVELY active claim — not one whose protection ran out.
  const effectivelyActive = !!c && c.state === "ACTIVE" && effectiveClaimState({
    state: c.state, activeSince: activeSince(c), lastRealContactAt: input.lead.lastRealContactAt, now: input.now,
    leadDeleted: false, leadStatus: input.lead.status, hasLiveDeal: input.lead.hasDeal,
  }) === "ACTIVE";
  return { card, inReview, hasActive: effectivelyActive };
}
