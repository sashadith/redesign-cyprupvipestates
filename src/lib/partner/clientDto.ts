// Partner "My clients" DTOs (partner portal phase 3b). Pure, no DB access: the where-builders
// scope.ts uses and the mappers that turn raw rows into what a portal page may show.
// Isolation rules (plan, Global Constraints): every claim/message query carries the partnerId;
// DTOs never carry lead email/phone/notes, interaction bodies, our commission or other partners' data.
import type { Prisma } from "@prisma/client";
import { isLeadStatus, type LeadStatusValue, type LostReasonValue } from "@/lib/crm/leadStatus";
import { addMonthsUtc, claimProtection, REAL_CONTACT_TYPES } from "./claims";
import { lostCategory, milestonesFor, partnerStage, type Milestone } from "./milestones";

// ── Filters ─────────────────────────────────────────────────────────────────

export const CLIENT_FILTERS = ["active", "closed", "lost", "all"] as const;
export type ClientFilter = (typeof CLIENT_FILTERS)[number];
export const CLIENTS_FILTER_COOKIE = "cve_partner_clients_filter";
export const DEFAULT_CLIENT_FILTER: ClientFilter = "all";
export const CLIENTS_PAGE_SIZE = 50;
/** Upper bound of claims scanned in memory for a name search. */
export const CLIENT_SEARCH_SCAN = 2000;
export const CLIENT_QUERY_MAX = 100;

export function parseClientFilter(v: unknown): ClientFilter | null {
  return typeof v === "string" && (CLIENT_FILTERS as readonly string[]).includes(v) ? (v as ClientFilter) : null;
}

export type ClaimState = "ACTIVE" | "IN_REVIEW" | "REJECTED" | "EXPIRED";
/** What the partner sees: an ACTIVE claim with expired protection reads as EXPIRED, one on a trashed lead as NOT_PROCEEDING. */
export type DisplayState = ClaimState | "NOT_PROCEEDING";
export type ClientCategory = Exclude<ClientFilter, "all">;

/** closed = lead CLOSED; lost = lead LOST or the claim (effectively) REJECTED/EXPIRED/NOT_PROCEEDING; everything else ACTIVE/IN_REVIEW is active. */
export function classifyClaim(state: DisplayState, leadStatus: string | null | undefined): ClientCategory {
  if (state === "REJECTED" || state === "EXPIRED" || state === "NOT_PROCEEDING") return "lost";
  if (state === "ACTIVE" && leadStatus === "CLOSED") return "closed";
  if (state === "ACTIVE" && leadStatus === "LOST") return "lost";
  return "active";
}

/**
 * Display state of a claim. ACTIVE claims on a soft-deleted lead → NOT_PROCEEDING; ACTIVE claims whose
 * computed protection (claimProtection, full real-contact definition) has run out → EXPIRED.
 */
export function displayState(
  row: { state: ClaimState; createdAt: Date; lead: { deletedAt?: Date | null } | null },
  lastRealContactAt: Date | null,
  now: Date,
): DisplayState {
  if (row.state !== "ACTIVE") return row.state;
  if (!row.lead || row.lead.deletedAt) return "NOT_PROCEEDING";
  return claimProtection({ claimCreatedAt: row.createdAt, lastRealContactAt, now }).expired ? "EXPIRED" : "ACTIVE";
}

function needPartner(partnerId: string): string {
  if (typeof partnerId !== "string" || partnerId.trim() === "") throw new Error("partner scope: partnerId required");
  return partnerId;
}

const REAL_TYPES = [...REAL_CONTACT_TYPES];

/**
 * Database approximation of "protection not expired": claim or a real contact after the cutoff
 * (now − 6 months). The mappers re-check with claimProtection; the two can disagree only around
 * month-end clamping (a day or two), which only affects which filter tab a claim appears under.
 */
export function protectionCutoff(now: Date): Date {
  return addMonthsUtc(now, -6);
}
function liveActive(cutoff: Date, status?: Prisma.EnumLeadStatusFilter | "CLOSED" | "LOST" | "VIEWING_SCHEDULED"): Prisma.PartnerClaimWhereInput {
  return {
    state: "ACTIVE",
    lead: { deletedAt: null, ...(status ? { status } : {}) },
    OR: [{ createdAt: { gte: cutoff } }, { lead: { interactions: { some: { type: { in: REAL_TYPES }, occurredAt: { gte: cutoff } } } } }],
  };
}
function expiredActive(cutoff: Date): Prisma.PartnerClaimWhereInput {
  return {
    state: "ACTIVE",
    createdAt: { lt: cutoff },
    lead: { deletedAt: null, interactions: { none: { type: { in: REAL_TYPES }, occurredAt: { gte: cutoff } } } },
  };
}
const trashedActive: Prisma.PartnerClaimWhereInput = { state: "ACTIVE", lead: { deletedAt: { not: null } } };

/** Claims of this partner in the given filter (same split as classifyClaim on the display state). */
export function clientsWhere(partnerId: string, filter: ClientFilter, now: Date = new Date()): Prisma.PartnerClaimWhereInput {
  const p = needPartner(partnerId);
  const cutoff = protectionCutoff(now);
  switch (filter) {
    case "active":
      return { partnerId: p, OR: [{ state: "IN_REVIEW" }, liveActive(cutoff, { notIn: ["CLOSED", "LOST"] })] };
    case "closed":
      return { partnerId: p, AND: [liveActive(cutoff, "CLOSED")] };
    case "lost":
      return {
        partnerId: p,
        OR: [{ state: { in: ["REJECTED", "EXPIRED"] } }, liveActive(cutoff, "LOST"), expiredActive(cutoff), trashedActive],
      };
    default:
      return { partnerId: p };
  }
}

/** One claim — portal identifiers are claim ids, and only the owning partner's. */
export function claimWhere(partnerId: string, claimId: string): Prisma.PartnerClaimWhereInput {
  return { id: claimId, partnerId: needPartner(partnerId) };
}

/** Partner messages: this partner's only, on the given leads only. */
export function messagesWhere(partnerId: string, leadIds: string[]): Prisma.PartnerMessageWhereInput {
  return { partnerId: needPartner(partnerId), leadId: { in: leadIds } };
}

/** Overview KPI counts — expired-protection and trashed-lead claims are left out. */
export function overviewCountWheres(
  partnerId: string,
  now: Date = new Date(),
): Record<"active" | "inReview" | "viewings" | "closed", Prisma.PartnerClaimWhereInput> {
  const p = needPartner(partnerId);
  const cutoff = protectionCutoff(now);
  return {
    active: { partnerId: p, AND: [liveActive(cutoff, { notIn: ["CLOSED", "LOST"] })] },
    inReview: { partnerId: p, state: "IN_REVIEW" },
    viewings: { partnerId: p, AND: [liveActive(cutoff, "VIEWING_SCHEDULED")] },
    closed: { partnerId: p, AND: [liveActive(cutoff, "CLOSED")] },
  };
}

/** ACTIVE claims with live protection on a not-trashed lead (overview commission and updates). */
export function activeClaimsWhere(partnerId: string, now: Date = new Date()): Prisma.PartnerClaimWhereInput {
  return { partnerId: needPartner(partnerId), AND: [liveActive(protectionCutoff(now))] };
}

// ── Raw row shapes (what scope.ts loads) ────────────────────────────────────

export type RawLead = {
  status: string;
  lostReason?: string | null;
  deletedAt?: Date | null;
  assignedTo?: { name: string | null; email?: string | null; phone?: string | null; isActive?: boolean } | null;
};

export type RawClaim = {
  id: string;
  partnerId: string;
  leadId: string;
  state: ClaimState;
  createdAt: Date;
  submission: unknown;
  lead: RawLead | null;
};

export type RawInteraction = { type: string; occurredAt: Date; metadata: unknown };

/**
 * Per lead: stage/booking events after the claim, first and last real contact after it (protection,
 * "first contact" milestone) and the first OUTBOUND contact after it (response time).
 */
export type Activity = {
  events: RawInteraction[];
  firstRealContactAt: Date | null;
  lastRealContactAt: Date | null;
  firstOutboundAt?: Date | null;
};

/** Contacts we initiated — only these count for the response time. */
export const OUTBOUND_CONTACT_TYPES = ["CALL", "EMAIL_OUT", "WHATSAPP_OUT"] as const;

export type RawDeal = {
  id: string;
  leadId: string;
  createdAt: Date;
  projectName: string | null;
  unitLabel: string | null;
  price: number;
  partnerCommission: number | null;
  rateSource: string;
  commissionStatus: CommissionStatus;
  expectedAt: Date;
  earnedAt: Date | null;
  developerPaidAt: Date | null;
  paidOutAt: Date | null;
  cancelledAt: Date | null;
};

export type RawMessage = { leadId: string; partnerId: string; createdAt: Date; body?: string };

export type MapContext = {
  partnerId: string;
  now: Date;
  activity?: Map<string, Activity>;
  deals: RawDeal[];
  messages: RawMessage[];
};

// ── Submission (what the partner typed) ─────────────────────────────────────

export type SubmissionView = {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  language: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  mode: "HANDOVER" | "FIX" | null;
  projects: string[];
  projectsText: string | null;
  contactMode: "DIRECT" | "VIA_PARTNER" | "VIA_PARTNER_REP" | "VIA_CLIENT_REP" | null;
  repName: string | null;
  repPhone: string | null;
  comment: string | null;
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const s = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const CONTACT_MODES = ["DIRECT", "VIA_PARTNER", "VIA_PARTNER_REP", "VIA_CLIENT_REP"] as const;

/** Whitelist of PartnerClaim.submission fields; anything else in the JSON is dropped. */
export function submissionView(json: unknown): SubmissionView {
  const o = obj(json);
  const mode = o.mode === "HANDOVER" || o.mode === "FIX" ? o.mode : null;
  const cm = (CONTACT_MODES as readonly unknown[]).includes(o.contactMode) ? (o.contactMode as SubmissionView["contactMode"]) : null;
  const projects = Array.isArray(o.projects) ? o.projects.map((p) => s(obj(p).name)).filter((x): x is string => !!x) : [];
  return {
    firstName: s(o.firstName) ?? "",
    lastName: s(o.lastName),
    email: s(o.email),
    phone: s(o.phone),
    language: s(o.language),
    budgetMin: n(o.budgetMin),
    budgetMax: n(o.budgetMax),
    mode,
    projects,
    projectsText: s(o.projectsText),
    contactMode: cm,
    repName: s(o.repName),
    repPhone: s(o.repPhone),
    comment: s(o.comment),
  };
}

const joinName = (first: string | null | undefined, last: string | null | undefined) => `${first ?? ""} ${last ?? ""}`.trim();

/**
 * Partner-visible name: always what the partner typed (submission), never the CRM lead's stored name —
 * an accepted duplicate can be a lead with a different name.
 */
export function visibleName(row: Pick<RawClaim, "submission">): string {
  const sub = submissionView(row.submission);
  return joinName(sub.firstName, sub.lastName);
}

export function normalizeName(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Every word of the query must occur in the name (case- and accent-insensitive). Empty query matches all. */
export function matchesQuery(name: string, q: string | null | undefined): boolean {
  const words = normalizeName(q ?? "").split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = normalizeName(name);
  return words.every((w) => hay.includes(w));
}

export function cleanQuery(v: unknown): string {
  return typeof v === "string" ? v.replace(/[\r\n\t]+/g, " ").trim().slice(0, CLIENT_QUERY_MAX) : "";
}

// ── Commission ──────────────────────────────────────────────────────────────

export const COMMISSION_STATUSES = ["EXPECTED", "EARNED", "DEVELOPER_PAID", "PAID_OUT", "CANCELLED"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];
export const COMMISSION_STAGES = ["EXPECTED", "EARNED", "DEVELOPER_PAID", "PAID_OUT"] as const;
export type CommissionStage = (typeof COMMISSION_STAGES)[number];

/** Sum of partnerCommission per stage; CANCELLED and not-yet-calculated (null) deals are left out. */
export function commissionTotals(deals: Pick<RawDeal, "commissionStatus" | "partnerCommission">[]): Record<CommissionStage, number> {
  const out: Record<CommissionStage, number> = { EXPECTED: 0, EARNED: 0, DEVELOPER_PAID: 0, PAID_OUT: 0 };
  for (const d of deals) {
    if (d.commissionStatus === "CANCELLED" || d.partnerCommission == null) continue;
    if (d.commissionStatus in out) out[d.commissionStatus as CommissionStage] += d.partnerCommission;
  }
  return out;
}

function statusDate(d: RawDeal): Date | null {
  switch (d.commissionStatus) {
    case "EARNED": return d.earnedAt;
    case "DEVELOPER_PAID": return d.developerPaidAt;
    case "PAID_OUT": return d.paidOutAt;
    case "CANCELLED": return d.cancelledAt;
    default: return d.expectedAt;
  }
}

export type DealView = {
  id: string;
  project: string | null;
  unit: string | null;
  price: number;
  /** Partner's commission in EUR; null = "being calculated". */
  commission: number | null;
  status: CommissionStatus;
  statusAt: Date | null;
};

export function dealView(d: RawDeal): DealView {
  return {
    id: d.id,
    project: d.projectName,
    unit: d.unitLabel,
    price: d.price,
    commission: d.rateSource === "MISSING" || d.partnerCommission == null ? null : d.partnerCommission,
    status: d.commissionStatus,
    statusAt: statusDate(d),
  };
}

// ── Response time ───────────────────────────────────────────────────────────

export type ResponseTime = { unit: "min" | "h" | "d"; n: number };

/** < 1 h in minutes, < 48 h in hours, otherwise in days (rounded). */
export function formatResponse(minutes: number | null): ResponseTime | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 60) return { unit: "min", n: Math.round(minutes) };
  if (minutes < 48 * 60) return { unit: "h", n: Math.max(1, Math.round(minutes / 60)) };
  return { unit: "d", n: Math.round(minutes / 1440) };
}

export const RESPONSE_KEYS: Record<ResponseTime["unit"], string> = {
  min: "clients.responseMin",
  h: "clients.responseHours",
  d: "clients.responseDays",
};

// ── Mappers ─────────────────────────────────────────────────────────────────

type ClosedState = Exclude<DisplayState, "ACTIVE">;
const STATE_CHIP: Record<ClosedState, string> = {
  IN_REVIEW: "clients.chipReview",
  REJECTED: "clients.chipRejected",
  EXPIRED: "clients.chipExpired",
  NOT_PROCEEDING: "clients.chipNotProceeding",
};
const STATE_MESSAGE: Record<ClosedState, string> = {
  IN_REVIEW: "clients.stateReview",
  REJECTED: "clients.stateRejected",
  EXPIRED: "clients.stateExpired",
  NOT_PROCEEDING: "clients.stateNotProceeding",
};

/** Last real contact at/after the claim (protection anchor), from the loaded activity. */
function lastRealContact(row: RawClaim, ctx: Pick<MapContext, "activity">): Date | null {
  const last = ctx.activity?.get(row.leadId)?.lastRealContactAt ?? null;
  return last && last >= row.createdAt ? last : null;
}

export function displayStateOf(row: RawClaim, ctx: Pick<MapContext, "activity" | "now">): DisplayState {
  return displayState(row, lastRealContact(row, ctx), ctx.now);
}

function ownClaim(row: RawClaim, partnerId: string): void {
  if (row.partnerId !== partnerId) throw new Error("partner scope: claim of another partner");
}

/** Deals and messages that belong to this claim: same lead, created after the claim, messages of this partner only. */
function scoped(row: RawClaim, ctx: MapContext) {
  const deals = ctx.deals.filter((d) => d.leadId === row.leadId && d.createdAt >= row.createdAt);
  const messages = ctx.messages.filter((m) => m.partnerId === ctx.partnerId && m.leadId === row.leadId && m.createdAt >= row.createdAt);
  const act = ctx.activity?.get(row.leadId) ?? { events: [], firstRealContactAt: null, lastRealContactAt: null };
  const interactions: RawInteraction[] = act.events
    .filter((e) => e.occurredAt >= row.createdAt)
    .map((e) => ({ type: e.type, occurredAt: e.occurredAt, metadata: e.metadata }));
  const first = act.firstRealContactAt && act.firstRealContactAt >= row.createdAt ? act.firstRealContactAt : null;
  // milestonesFor only needs the first real contact; one synthetic row stands for it.
  if (first) interactions.push({ type: "CALL", occurredAt: first, metadata: null });
  const last = act.lastRealContactAt && act.lastRealContactAt >= row.createdAt ? act.lastRealContactAt : null;
  const firstOut = act.firstOutboundAt && act.firstOutboundAt >= row.createdAt ? act.firstOutboundAt : null;
  return { deals, messages, interactions, first, last, firstOut };
}

function claimMilestones(row: RawClaim, sc: ReturnType<typeof scoped>): Milestone[] {
  return milestonesFor({
    claimCreatedAt: row.createdAt,
    interactions: sc.interactions,
    deals: sc.deals.map((d) => ({ createdAt: d.createdAt, earnedAt: d.earnedAt, cancelledAt: d.cancelledAt, commissionStatus: d.commissionStatus })),
    messages: sc.messages.map((m) => ({ createdAt: m.createdAt, body: m.body ?? "" })),
  });
}

export type ClientListItem = {
  id: string;
  name: string;
  state: DisplayState;
  category: ClientCategory;
  /** Dictionary key of the chip (lead stage for ACTIVE, claim state otherwise). */
  chipKey: string;
  submittedAt: Date;
  contactName: string | null;
  lastUpdateAt: Date | null;
  commission: Record<CommissionStage, number> | null;
};

export function toListItem(row: RawClaim, ctx: MapContext): ClientListItem {
  ownClaim(row, ctx.partnerId);
  const st = displayStateOf(row, ctx);
  const base = { id: row.id, name: visibleName(row), state: st, submittedAt: row.createdAt };
  if (st !== "ACTIVE" || !row.lead) {
    const closed = st === "ACTIVE" ? "NOT_PROCEEDING" : st;
    return { ...base, category: classifyClaim(closed, null), chipKey: STATE_CHIP[closed], contactName: null, lastUpdateAt: null, commission: null };
  }
  const sc = scoped(row, ctx);
  const ms = claimMilestones(row, sc);
  const status = isLeadStatus(row.lead.status) ? row.lead.status : "NEW";
  const sums = commissionTotals(sc.deals);
  return {
    ...base,
    category: classifyClaim("ACTIVE", status),
    chipKey: partnerStage(status).key,
    contactName: row.lead.assignedTo?.name?.trim() || null,
    lastUpdateAt: ms[0]?.at ?? null,
    commission: Object.values(sums).some((v) => v > 0) ? sums : null,
  };
}

export type ContactView =
  | { kind: "owner"; name: string | null; email: string | null; phone: string | null }
  | { kind: "office"; email: string | null; phone: string | null }
  | { kind: "pending" };

export type ClientDetail =
  | {
      kind: "submission";
      id: string;
      state: ClosedState;
      name: string;
      chipKey: string;
      stateKey: string;
      submittedAt: Date;
      submission: SubmissionView;
    }
  | {
      kind: "active";
      id: string;
      state: "ACTIVE";
      name: string;
      chipKey: string;
      submittedAt: Date;
      submission: SubmissionView;
      stage: { step: number | null; key: string };
      milestones: Milestone[];
      contact: ContactView;
      deals: DealView[];
      lostKey: string | null;
      response: ResponseTime | null;
      protection: { until: Date; expired: boolean };
    };

export function toClientDetail(
  row: RawClaim,
  ctx: MapContext & { office: { email: string | null; phone: string | null } | null },
): ClientDetail {
  ownClaim(row, ctx.partnerId);
  const submission = submissionView(row.submission);
  const st = displayStateOf(row, ctx);
  if (st !== "ACTIVE" || !row.lead) {
    const closed = st === "ACTIVE" ? "NOT_PROCEEDING" : st;
    return {
      kind: "submission",
      id: row.id,
      state: closed,
      name: joinName(submission.firstName, submission.lastName),
      chipKey: STATE_CHIP[closed],
      stateKey: STATE_MESSAGE[closed],
      submittedAt: row.createdAt,
      submission,
    };
  }
  const sc = scoped(row, ctx);
  const status: LeadStatusValue = isLeadStatus(row.lead.status) ? row.lead.status : "NEW";
  const stage = partnerStage(status);
  const owner = row.lead.assignedTo;
  const contact: ContactView =
    owner && owner.isActive !== false
      ? { kind: "owner", name: owner.name?.trim() || null, email: owner.email?.trim() || null, phone: owner.phone?.trim() || null }
      : ctx.office && (ctx.office.email || ctx.office.phone)
        ? { kind: "office", email: ctx.office.email, phone: ctx.office.phone }
        : { kind: "pending" };
  const minutes = sc.firstOut ? Math.round((sc.firstOut.getTime() - row.createdAt.getTime()) / 60000) : null;
  const prot = claimProtection({ claimCreatedAt: row.createdAt, lastRealContactAt: sc.last, now: ctx.now });
  return {
    kind: "active",
    id: row.id,
    state: "ACTIVE",
    name: visibleName(row),
    chipKey: stage.key,
    submittedAt: row.createdAt,
    submission,
    stage: { step: stage.step, key: stage.key },
    milestones: claimMilestones(row, sc),
    contact,
    deals: sc.deals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(dealView),
    lostKey: status === "LOST" ? `lost.${lostCategory((row.lead.lostReason ?? null) as LostReasonValue | null)}` : null,
    response: formatResponse(minutes),
    protection: { until: prot.protectedUntil, expired: prot.expired },
  };
}

export type OverviewMilestone = { claimId: string; name: string; at: Date; key: string };

/** Latest milestones across the given claims that are effectively ACTIVE (message bodies are not carried into the overview). */
export function latestMilestones(rows: RawClaim[], ctx: MapContext, limit = 5): OverviewMilestone[] {
  const out: OverviewMilestone[] = [];
  for (const row of rows) {
    ownClaim(row, ctx.partnerId);
    if (displayStateOf(row, ctx) !== "ACTIVE" || !row.lead) continue;
    const name = visibleName(row);
    for (const m of claimMilestones(row, scoped(row, ctx))) out.push({ claimId: row.id, name, at: m.at, key: m.key });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/** Deals that count for these claims: same lead and created at/after the claim. */
export function dealsForClaims(claims: Pick<RawClaim, "leadId" | "createdAt">[], deals: RawDeal[]): RawDeal[] {
  const since = new Map(claims.map((c) => [c.leadId, c.createdAt]));
  return deals.filter((d) => {
    const at = since.get(d.leadId);
    return !!at && d.createdAt >= at;
  });
}

/** Public project page in the partner's language (English has no prefix); null without a slug. */
export function publicProjectUrl(locale: string, slug: string | null | undefined): string | null {
  if (!slug) return null;
  const prefix = locale === "en" ? "" : `${locale}/`;
  return `https://cyprusvipestates.com/${prefix}projects/${encodeURIComponent(slug)}`;
}
