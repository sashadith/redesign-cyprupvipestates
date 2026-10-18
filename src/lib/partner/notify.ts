// Partner notification e-mails and the stage-event planner (partner portal phase 3b). Pure, no DB access.
// The server half (collect + send against the outbox) lives in notifySend.ts.
// Emails carry only what the portal shows: the name the partner submitted, the partner-facing stage,
// our message body. Never our commission, the lead's stored name/contact data, or staff e-mails.
import type { Prisma } from "@prisma/client";
import { isLeadStatus } from "@/lib/crm/leadStatus";
import type { EffectiveClaimState } from "./claimState";
import { dict, fmt, lookup, type PartnerLocale } from "./i18n";
import { greet, renderPartnerEmail, type BuiltEmail } from "./mail";
import { partnerStage } from "./milestones";

// ── Builders ────────────────────────────────────────────────────────────────

type Common = { partnerFirstName: string; clientName: string; link: string };

const client = (name: string) => name.trim() || "—";

/** Portal client page for a claim. */
export function clientLink(base: string, claimId: string): string {
  return `${base}/clients/${encodeURIComponent(claimId)}`;
}

export function buildStageEmail(locale: PartnerLocale, p: Common & { stageKey: string }): BuiltEmail {
  const t = dict(locale).mail;
  const vars = { client: client(p.clientName), stage: lookup(locale, p.stageKey) ?? lookup(locale, "stages.onHold")! };
  return renderPartnerEmail({
    subject: fmt(t.stage.subject, vars),
    greeting: greet(t.stage.greeting, p.partnerFirstName),
    intro: fmt(t.stage.intro, vars),
    button: t.stage.button,
    link: p.link,
    notes: [],
    signature: t.signature,
  });
}

export function buildMessageEmail(locale: PartnerLocale, p: Common & { body: string; authorFirstName?: string | null }): BuiltEmail {
  const t = dict(locale).mail;
  const author = (p.authorFirstName ?? "").trim();
  const vars = { client: client(p.clientName), author };
  return renderPartnerEmail({
    subject: fmt(t.message.subject, vars),
    greeting: greet(t.message.greeting, p.partnerFirstName),
    intro: fmt(author ? t.message.intro : t.message.introTeam, vars),
    quote: p.body,
    button: t.message.button,
    link: p.link,
    notes: [],
    signature: t.signature,
  });
}

/** Accepted, or a neutral "not accepted" — nothing about why or about any existing lead. */
export function buildClaimOutcomeEmail(locale: PartnerLocale, p: Common & { accepted: boolean }): BuiltEmail {
  const t = dict(locale).mail.claimOutcome;
  const vars = { client: client(p.clientName) };
  return renderPartnerEmail({
    subject: fmt(p.accepted ? t.acceptedSubject : t.rejectedSubject, vars),
    greeting: greet(t.greeting, p.partnerFirstName),
    intro: fmt(p.accepted ? t.acceptedIntro : t.rejectedIntro, vars),
    button: t.button,
    link: p.link,
    notes: [],
    signature: dict(locale).mail.signature,
  });
}

/** Portal commissions page (credit notes are downloaded there; the mail never attaches the PDF). */
export function commissionsLink(base: string): string {
  return `${base}/commissions`;
}

/**
 * "Your commission has been paid": the submitted client name, project/unit, the amount transferred
 * (already formatted) and the credit-note number. Nothing else — no bank data, no our-commission figures.
 */
export function buildPayoutEmail(
  locale: PartnerLocale,
  p: Common & { project?: string | null; unit?: string | null; amount: string; creditNoteNumber: string },
): BuiltEmail {
  const t = dict(locale).mail.payout;
  const dash = (v: string | null | undefined) => (v ?? "").trim() || "—";
  const vars = { client: client(p.clientName), project: dash(p.project), unit: dash(p.unit), amount: p.amount };
  return renderPartnerEmail({
    subject: t.subject,
    greeting: greet(t.greeting, p.partnerFirstName),
    intro: fmt(t.intro, vars),
    button: t.button,
    link: p.link,
    notes: [fmt(t.creditNoteLine, { number: p.creditNoteNumber })],
    signature: dict(locale).mail.signature,
  });
}

/**
 * Match alert (phase 3e, Decision 6): a project/unit change that fits the client's budget. Carries the
 * submitted client name, the public project name, the change, the new price from and the public project
 * link — nothing about the lead, our commission or other partners.
 */
export function buildMatchEmail(
  locale: PartnerLocale,
  p: {
    partnerFirstName: string; clientName: string; projectName: string; changeType: string;
    priceFrom: number | null; url: string; portalUrl: string;
  },
): BuiltEmail {
  const d = dict(locale);
  const t = d.mail.match;
  const change = (d.telegram.changeTypes as Record<string, string>)[p.changeType] ?? "—";
  const vars = { client: client(p.clientName), project: p.projectName.trim() || "—", change };
  const notes: string[] = [];
  if (p.priceFrom != null && Number.isFinite(p.priceFrom) && p.priceFrom > 0) {
    notes.push(fmt(t.price, { price: formatPayoutAmount(locale, p.priceFrom) }));
  }
  notes.push(`${d.telegram.notify.open}: ${p.portalUrl}`);
  return renderPartnerEmail({
    subject: fmt(t.subject, vars),
    greeting: greet(t.greeting, p.partnerFirstName),
    intro: fmt(t.intro, vars),
    button: t.button,
    link: p.url,
    notes,
    signature: d.mail.signature,
  });
}

/** "Your presentation for {client} has been opened" (phase 3e, Decision 7); link = the portal's presentations page. */
export function buildPresentationOpenedEmail(locale: PartnerLocale, p: Common): BuiltEmail {
  const t = dict(locale).mail.presentationOpened;
  const vars = { client: client(p.clientName) };
  return renderPartnerEmail({
    subject: fmt(t.subject, vars),
    greeting: greet(t.greeting, p.partnerFirstName),
    intro: fmt(t.intro, vars),
    button: t.button,
    link: p.link,
    notes: [],
    signature: dict(locale).mail.signature,
  });
}

/** Portal presentations page. */
export function presentationsLink(base: string): string {
  return `${base}/presentations`;
}

/** Amount for the payout mail: whole euros in the partner's locale. */
export function formatPayoutAmount(locale: PartnerLocale, euros: number): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(euros);
}

export const NOTIFICATION_KINDS = ["STAGE", "MESSAGE", "CLAIM_OUTCOME", "PAYOUT", "MATCH", "PRESENTATION_OPENED"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Compile-time exhaustiveness: a new kind that is not handled fails the build instead of falling through. */
export function unhandledKind(kind: never): never {
  throw new Error(`partner notify: unhandled notification kind ${String(kind)}`);
}

/** Partner-dictionary stage key for a lead status from STATUS_CHANGE metadata; null when not a lead status. */
export function stageKeyFor(toStatus: unknown): string | null {
  return isLeadStatus(toStatus) ? partnerStage(toStatus).key : null;
}

/** First word of a staff display name — the only author detail a partner e-mail carries. */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
}

// ── Outbox keys and errors ──────────────────────────────────────────────────

export const stageRefKey = (interactionId: string) => `stage:${interactionId}`;

/** PartnerMessage id from a `msg:<id>` refKey. */
export function messageIdFromRefKey(refKey: string): string | null {
  return refKey.startsWith("msg:") && refKey.length > 4 ? refKey.slice(4) : null;
}

/** Deal id from a `paid:<dealId>` refKey (written by markPaidOut). */
export function payoutDealIdFromRefKey(refKey: string): string | null {
  return refKey.startsWith("paid:") && refKey.length > 5 ? refKey.slice(5) : null;
}

/** PARTNER_NOTIFY_START (ISO) — nothing older is ever mailed; unset → the job does nothing. */
export function notifyStartFromEnv(env: Record<string, string | undefined>): Date | null {
  const s = env.PARTNER_NOTIFY_START?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
}

export const MAX_ATTEMPTS = 6;
/** Retry backoff: attempt n+1 is due 10 min · 2^(n−1) after the n-th failure (10, 20, 40, 80, 160 min). */
export const BACKOFF_BASE_MS = 10 * 60_000;
/** Consecutive shared-transport errors (mail transport, Telegram 5xx/429/network/timeout) that stop a batch — the transport is down, not the rows. */
export const TRANSPORT_BREAKER = 3;
/** Marker in `error` while a row is claimed by a running send (sentAt set, outcome not recorded yet). */
export const SENDING_MARK = "sending";
export const ERROR_MAX = 500;

/** Earliest time a failed row may be retried; null = due now (never failed). */
export function retryAt(row: { attempts: number; failedAt: Date | null }): Date | null {
  if (row.attempts <= 0 || !row.failedAt) return null;
  return new Date(row.failedAt.getTime() + BACKOFF_BASE_MS * 2 ** (row.attempts - 1));
}

/** Unsent, under MAX_ATTEMPTS and past its backoff. */
export function isDue(row: { sentAt: Date | null; attempts: number; failedAt: Date | null }, now: Date): boolean {
  if (row.sentAt || row.attempts >= MAX_ATTEMPTS) return false;
  const at = retryAt(row);
  return !at || at.getTime() <= now.getTime();
}

/** Prisma filter equivalent to isDue (one branch per attempt count). */
export function dueWhere(now: Date): Prisma.PartnerNotificationWhereInput {
  const OR: Prisma.PartnerNotificationWhereInput[] = [{ attempts: 0 }, { attempts: { gt: 0, lt: MAX_ATTEMPTS }, failedAt: null }];
  for (let n = 1; n < MAX_ATTEMPTS; n++) {
    OR.push({ attempts: n, failedAt: { lte: new Date(now.getTime() - BACKOFF_BASE_MS * 2 ** (n - 1)) } });
  }
  return { sentAt: null, OR };
}

/** A row still marked "sending" this long after it was claimed belongs to a run that died mid-send. */
export const STUCK_SENDING_MS = 60 * 60_000;
export const INTERRUPTED_ERROR = "interrupted while sending";

/** Rows claimed (sentAt set, error "sending") more than STUCK_SENDING_MS ago: recovered as a failed attempt. */
export function stuckSendingWhere(now: Date): Prisma.PartnerNotificationWhereInput {
  return { error: SENDING_MARK, sentAt: { lt: new Date(now.getTime() - STUCK_SENDING_MS) } };
}

/** Rows that gave up: unsent after MAX_ATTEMPTS failures. */
export function deadWhere(): Prisma.PartnerNotificationWhereInput {
  return { sentAt: null, attempts: { gte: MAX_ATTEMPTS } };
}

/**
 * Tracks consecutive transport errors in one batch. A failed row is held (not charged an attempt)
 * until the streak is broken by a successful send — then the held rows are charged. When the streak
 * reaches TRANSPORT_BREAKER the batch stops and the held rows are never charged (the transport failed).
 */
export class TransportStreak {
  private held: string[] = [];
  /** Records a transport failure; true = stop the batch now. */
  fail(id: string): boolean {
    this.held.push(id);
    return this.held.length >= TRANSPORT_BREAKER;
  }
  /** A send went through: returns the held rows, which are now charged an attempt. */
  succeed(): string[] {
    const out = this.held;
    this.held = [];
    return out;
  }
  /** End of a batch that did not trip: the held rows are charged. */
  finish(tripped: boolean): string[] {
    const out = tripped ? [] : this.held;
    this.held = [];
    return out;
  }
}

/** MESSAGE / CLAIM_OUTCOME rows written before PARTNER_NOTIFY_START are never mailed (STAGE rows are filtered at collect). */
export function beforeStart(row: { kind: string; createdAt: Date }, start: Date): boolean {
  return row.kind !== "STAGE" && row.createdAt.getTime() < start.getTime();
}

/** A STAGE row repeating the stage last mailed for this claim says nothing new (e.g. OFFER → VIEWING → OFFER collapsed). */
export function isUnchangedStage(toStatus: unknown, lastMailedToStatus: unknown): boolean {
  return isLeadStatus(toStatus) && toStatus === lastMailedToStatus;
}

export const OPTED_OUT_ERROR = "opted out";
/** Kinds a partner can switch off in the profile; CLAIM_OUTCOME and PAYOUT concern the claim decision and money. */
export const OPTIONAL_KINDS: readonly NotificationKind[] = ["STAGE", "MESSAGE"];

/** Profile switch (phase 3d): "opted out" for STAGE/MESSAGE when email notifications are off, else null. */
export function optOutGate(kind: NotificationKind, emailNotifications: boolean): string | null {
  return !emailNotifications && OPTIONAL_KINDS.includes(kind) ? OPTED_OUT_ERROR : null;
}

/** Only an ACTIVE partner is told anything; the skip reason otherwise. */
export function partnerStatusGate(status: string | null | undefined): string | null {
  if (!status) return "partner missing";
  if (status === "SUSPENDED") return "suspended";
  if (status !== "ACTIVE") return "pending";
  return null;
}

/**
 * Whether a row may be mailed, given its claim and the claim's effective state (effectiveClaimState);
 * returns the skip reason or null. A rejection and a payout are told regardless of the lead (even
 * trashed); an acceptance, a stage change, a message and a match alert only while the claim is
 * effectively ACTIVE; a presentation-opened row needs no claim at all.
 */
export function notificationGate(input: {
  kind: NotificationKind;
  accepted: boolean;
  claim: { ownedByPartner: boolean; effective: EffectiveClaimState } | null;
}): string | null {
  const { kind, claim } = input;
  // The partner's own presentation was opened (the row is written for presentation.partnerId): only the
  // partner gate applies, the claim's state is irrelevant to a page the client already holds.
  if (kind === "PRESENTATION_OPENED") return null;
  // The money was paid: always told, whatever the claim's state now — but only about the partner's own claim.
  if (kind === "PAYOUT") return claim?.ownedByPartner ? null : "claim missing";
  if (!claim || !claim.ownedByPartner) return kind === "CLAIM_OUTCOME" ? "claim missing" : "claim inactive";
  if (kind === "CLAIM_OUTCOME" && !input.accepted) return null;
  if (claim.effective === "NOT_PROCEEDING") return "lead trashed";
  if (claim.effective === "EXPIRED") return "protection ended";
  if (claim.effective !== "ACTIVE") return "claim inactive";
  return null;
}

export function truncateError(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e);
  return s.length > ERROR_MAX ? s.slice(0, ERROR_MAX) : s;
}

// ── Stage planner ───────────────────────────────────────────────────────────

/** A STATUS_CHANGE interaction joined with the lead's ACTIVE claim. */
export type StageRow = {
  interactionId: string;
  leadId: string;
  occurredAt: Date;
  toStatus: unknown;
  claimId: string;
  partnerId: string;
  /** activeSince(claim): reviewedAt ?? createdAt — changes before the claim became active are not the partner's. */
  claimActiveSince: Date;
};

export type PlannedStage = {
  kind: "STAGE";
  refKey: string;
  partnerId: string;
  leadId: string;
  claimId: string;
  payload: { toStatus: string | null };
  /** null = pending (to be mailed); set = recorded as done without a mail (collapsed / invalid). */
  sentAt: Date | null;
  error: string | null;
};

export type StagePlan = { rows: PlannedStage[]; pending: number; collapsed: number; settlingLeads: number };

export const STAGE_DEBOUNCE_MS = 10 * 60_000;

/**
 * Turns scanned STATUS_CHANGE rows into outbox rows. A row counts only when it is at or after the claim
 * became active (activeSince) and PARTNER_NOTIFY_START. Per lead:
 *  - a change newer than now − debounce means the lead is still settling → nothing for that lead this run;
 *  - otherwise the newest change (also counting rows already in the outbox) is the one to mail; when it is
 *    new it becomes the pending row, and every other not-yet-recorded row is stored as done ("collapsed"),
 *    so it is never reconsidered and never mailed out of order.
 * Rows whose toStatus is not a lead status are stored as done ("invalid status") and never chosen.
 */
export function planStageNotifications(input: {
  rows: StageRow[];
  existingRefKeys: Iterable<string>;
  now: Date;
  start: Date;
  debounceMs?: number;
}): StagePlan {
  const { rows, now, start, debounceMs = STAGE_DEBOUNCE_MS } = input;
  const existing = new Set(input.existingRefKeys);
  const cutoff = now.getTime() - debounceMs;

  const byLead = new Map<string, StageRow[]>();
  for (const r of rows) {
    const t = r.occurredAt.getTime();
    if (t < r.claimActiveSince.getTime() || t < start.getTime()) continue;
    const list = byLead.get(r.leadId);
    if (list) list.push(r);
    else byLead.set(r.leadId, [r]);
  }

  const out: PlannedStage[] = [];
  let pending = 0;
  let collapsed = 0;
  let settlingLeads = 0;
  const done = (r: StageRow, error: string): PlannedStage => ({
    kind: "STAGE", refKey: stageRefKey(r.interactionId), partnerId: r.partnerId, leadId: r.leadId, claimId: r.claimId,
    payload: { toStatus: isLeadStatus(r.toStatus) ? r.toStatus : null }, sentAt: now, error,
  });

  for (const list of Array.from(byLead.values())) {
    if (list.some((r) => r.occurredAt.getTime() > cutoff)) {
      if (list.some((r) => !existing.has(stageRefKey(r.interactionId)))) settlingLeads++;
      continue;
    }
    const valid = list
      .filter((r) => isLeadStatus(r.toStatus))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || (a.interactionId < b.interactionId ? 1 : -1));
    const newest = valid[0];
    for (const r of list) {
      if (existing.has(stageRefKey(r.interactionId))) continue;
      if (!isLeadStatus(r.toStatus)) {
        out.push(done(r, "invalid status"));
      } else if (r === newest) {
        out.push({
          kind: "STAGE", refKey: stageRefKey(r.interactionId), partnerId: r.partnerId, leadId: r.leadId, claimId: r.claimId,
          payload: { toStatus: r.toStatus }, sentAt: null, error: null,
        });
        pending++;
      } else {
        out.push(done(r, "collapsed"));
        collapsed++;
      }
    }
  }
  return { rows: out, pending, collapsed, settlingLeads };
}
