// Partner notifications v2 (2026-10-30): the daily partner-alerts planner. Pure, no I/O.
// Turns catalogue changes, claim protection dates, quiet clients, deals without bank details and tier
// progress into PartnerNotification rows. The DB side is alertsSend.ts; delivery is the existing
// partner-notify sender (notifySend.ts). Payloads carry only what the portal shows the partner: public
// project names and links, the partner's own rates, the submitted client name — never the developer,
// our commission or lead contact data.
import type { NotificationKind } from "./notify";
import { dayKey } from "@/lib/crm/today";
import { claimProtection } from "./claims";

const DAY = 86_400_000;

/** Max projects in one PROJECT_NEWS / WATCH message. */
export const ALERT_MAX_PROJECTS = 5;
/** Reminder offsets before the protection end, largest first. */
export const PROTECTION_REMINDER_DAYS = [30, 7] as const;
/** A client with no activity for this long gets one CLIENT_QUIET row (per quiet stretch). */
export const QUIET_DAYS = 14;
/** "Almost sold out": available units fell from above this to 1..this. */
export const LOW_STOCK_MAX = 3;

export type PlannedAlert = {
  kind: NotificationKind;
  refKey: string;
  partnerId: string;
  leadId: string | null;
  claimId: string | null;
  payload: Record<string, unknown>;
};

/** Cyprus date "YYYY-MM-DD" of an instant (refKeys and day buckets). */
export const cyDate = (at: Date): string => dayKey(at);

// ── 1: new projects ─────────────────────────────────────────────────────────

export type NewsProject = { id: string; name: string; area: string | null; priceFrom: number | null; url: string; publishedAt: Date };
export type NewsPartner = { id: string; rates: Map<string, number | null> };

/** One PROJECT_NEWS row per partner for the day, newest projects first, at most ALERT_MAX_PROJECTS. */
export function planProjectNews(input: { partners: NewsPartner[]; projects: NewsProject[]; today: string }): PlannedAlert[] {
  if (!input.projects.length) return [];
  const projects = [...input.projects]
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || a.name.localeCompare(b.name, "en"))
    .slice(0, ALERT_MAX_PROJECTS);
  return input.partners.map((p) => ({
    kind: "PROJECT_NEWS",
    refKey: `news:${p.id}:${input.today}`,
    partnerId: p.id,
    leadId: null,
    claimId: null,
    payload: {
      projects: projects.map((pr) => ({
        name: pr.name, area: pr.area, priceFrom: pr.priceFrom, url: pr.url, rate: p.rates.get(pr.id) ?? null,
      })),
    },
  }));
}

// ── 2+3: projects from the partner's presentations ──────────────────────────

/** A change worth telling on a watched project. `n` = available units for low_stock. */
export type WatchChange = { type: "new_units" | "price_from_changed" | "unit_price_changed" | "back_on_market" | "low_stock"; n?: number };
export type WatchEvent = { developmentId: string; name: string; url: string | null; type: string; [k: string]: unknown };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * inventoryChanges event → the watch change it means, or null. Decreases only for prices; availability only
 * when it crosses into 1..LOW_STOCK_MAX from above.
 */
export function watchChangeOf(ev: WatchEvent): WatchChange | null {
  switch (ev.type) {
    case "new_units":
    case "back_on_market":
      return { type: ev.type };
    case "price_from_changed": {
      const from = num(ev.from), to = num(ev.to);
      return from != null && to != null && to < from ? { type: "price_from_changed" } : null;
    }
    case "unit_price_changed": {
      const units = Array.isArray(ev.units) ? (ev.units as { from?: unknown; to?: unknown }[]) : [];
      return units.some((u) => { const f = num(u.from), t = num(u.to); return f != null && t != null && t < f; })
        ? { type: "unit_price_changed" } : null;
    }
    case "availability_changed": {
      const from = num(ev.from), to = num(ev.to);
      return from != null && to != null && from > LOW_STOCK_MAX && to >= 1 && to <= LOW_STOCK_MAX ? { type: "low_stock", n: to } : null;
    }
    default:
      return null;
  }
}

/**
 * One WATCH row per partner for the day: changes on developments in that partner's own active
 * presentations. A project with several changes lists each once (unit-price folds into price-from).
 */
export function planWatch(input: {
  watched: Map<string, Set<string>>;
  events: WatchEvent[];
  priceFrom: Map<string, number | null>;
  today: string;
}): PlannedAlert[] {
  const byDev = new Map<string, { name: string; url: string; changes: WatchChange[] }>();
  for (const ev of input.events) {
    const c = watchChangeOf(ev);
    if (!c || !ev.url) continue;
    const cur = byDev.get(ev.developmentId) ?? { name: ev.name, url: ev.url, changes: [] };
    if (c.type === "unit_price_changed" && cur.changes.some((x) => x.type === "price_from_changed")) continue;
    if (c.type === "price_from_changed") cur.changes = cur.changes.filter((x) => x.type !== "unit_price_changed");
    if (!cur.changes.some((x) => x.type === c.type)) cur.changes.push(c);
    byDev.set(ev.developmentId, cur);
  }
  if (!byDev.size) return [];
  const out: PlannedAlert[] = [];
  for (const [partnerId, devIds] of Array.from(input.watched)) {
    const projects = Array.from(devIds)
      .flatMap((id) => {
        const d = byDev.get(id);
        return d ? [{ name: d.name, url: d.url, changes: d.changes, priceFrom: input.priceFrom.get(id) ?? null }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name, "en"))
      .slice(0, ALERT_MAX_PROJECTS);
    if (!projects.length) continue;
    out.push({ kind: "WATCH", refKey: `watch:${partnerId}:${input.today}`, partnerId, leadId: null, claimId: null, payload: { projects } });
  }
  return out;
}

// ── 4: protection ending ────────────────────────────────────────────────────

export type ProtectionClaim = { claimId: string; partnerId: string; leadId: string; protectedUntil: Date };

/**
 * The reminder due now for each claim: the smallest offset (30 / 7 days) the end is within. A claim whose
 * end moved (a new real contact) gets a new refKey, so the reminder is told again for the new date.
 */
export function planProtectionReminders(input: { claims: ProtectionClaim[]; now: Date }): PlannedAlert[] {
  const out: PlannedAlert[] = [];
  for (const c of input.claims) {
    const left = c.protectedUntil.getTime() - input.now.getTime();
    if (left <= 0) continue;
    const due = [...PROTECTION_REMINDER_DAYS].reverse().find((d) => left <= d * DAY);
    if (!due) continue;
    const until = cyDate(c.protectedUntil);
    out.push({
      kind: "PROTECTION_ENDING", refKey: `protect:${c.claimId}:${due}:${until}`, partnerId: c.partnerId, leadId: c.leadId, claimId: c.claimId,
      payload: { protectedUntil: c.protectedUntil.toISOString(), days: due },
    });
  }
  return out;
}

/** protectedUntil the planner and the sender both use (claims.ts rule: 6 months from max(activeSince, last real contact)). */
export function protectionEnd(activeSince: Date, lastRealContactAt: Date | null): Date {
  return claimProtection({ claimCreatedAt: activeSince, lastRealContactAt, now: activeSince }).protectedUntil;
}

// ── 5: quiet client ─────────────────────────────────────────────────────────

export type QuietClaim = { claimId: string; partnerId: string; leadId: string; lastActivityAt: Date };

/** One CLIENT_QUIET row per quiet stretch: keyed by the last activity's date, so it is told once until something happens. */
export function planQuietClients(input: { claims: QuietClaim[]; now: Date }): PlannedAlert[] {
  return input.claims
    .filter((c) => input.now.getTime() - c.lastActivityAt.getTime() >= QUIET_DAYS * DAY)
    .map((c) => ({
      kind: "CLIENT_QUIET" as const,
      refKey: `quiet:${c.claimId}:${cyDate(c.lastActivityAt)}`,
      partnerId: c.partnerId, leadId: c.leadId, claimId: c.claimId,
      payload: { since: c.lastActivityAt.toISOString() },
    }));
}

// ── 8: bank details missing ─────────────────────────────────────────────────

export type BankDeal = { dealId: string; partnerId: string; leadId: string; claimId: string; developerPaid: boolean };

/** Once when the deal exists, once more when the developer has paid; a deal first seen already paid gets only the paid wording. */
export function planBankMissing(input: { deals: BankDeal[] }): PlannedAlert[] {
  return input.deals.flatMap((d) => {
    const stages: ("created" | "devpaid")[] = d.developerPaid ? ["devpaid"] : ["created"];
    return stages.map((stage) => ({
      kind: "BANK_MISSING" as const, refKey: `bank:${d.dealId}:${stage}`, partnerId: d.partnerId, leadId: d.leadId, claimId: d.claimId,
      payload: { dealId: d.dealId, stage },
    }));
  });
}

// ── 10: one deal to the next tier ───────────────────────────────────────────

export type TierStep = { key: string; name: string; handoverShare: number; fixShare: number };

/** `next` = the partner's next tier when exactly one closed deal is missing (tierProgress.remaining === 1). */
export function planTierNear(input: { partners: { id: string; next: TierStep | null }[] }): PlannedAlert[] {
  return input.partners.flatMap((p) =>
    p.next
      ? [{
          kind: "TIER_NEAR" as const, refKey: `tiernear:${p.id}:${p.next.key}`, partnerId: p.id, leadId: null, claimId: null,
          payload: { tierKey: p.next.key, tierName: p.next.name, handoverShare: p.next.handoverShare, fixShare: p.next.fixShare },
        }]
      : [],
  );
}

// ── Payload readers (send side) ─────────────────────────────────────────────

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export type NewsItem = { name: string; area: string | null; priceFrom: number | null; url: string; rate: number | null };
export type WatchItem = { name: string; url: string; priceFrom: number | null; changes: WatchChange[] };

const WATCH_TYPES: readonly WatchChange["type"][] = ["new_units", "price_from_changed", "unit_price_changed", "back_on_market", "low_stock"];

/** PROJECT_NEWS payload → items; anything malformed is dropped (an empty list skips the row). */
export function readNewsPayload(payload: unknown, urlOk: (u: unknown) => u is string): NewsItem[] {
  const list = obj(payload).projects;
  if (!Array.isArray(list)) return [];
  return list.slice(0, ALERT_MAX_PROJECTS).flatMap((raw) => {
    const p = obj(raw);
    const name = str(p.name);
    if (!name || !urlOk(p.url)) return [];
    const price = num(p.priceFrom);
    const rate = num(p.rate);
    return [{ name, area: str(p.area), priceFrom: price != null && price > 0 ? price : null, url: p.url, rate: rate != null && rate > 0 ? rate : null }];
  });
}

/** WATCH payload → items with known change types only. */
export function readWatchPayload(payload: unknown, urlOk: (u: unknown) => u is string): WatchItem[] {
  const list = obj(payload).projects;
  if (!Array.isArray(list)) return [];
  return list.slice(0, ALERT_MAX_PROJECTS).flatMap((raw) => {
    const p = obj(raw);
    const name = str(p.name);
    if (!name || !urlOk(p.url)) return [];
    const changes = (Array.isArray(p.changes) ? p.changes : []).flatMap((c): WatchChange[] => {
      const o = obj(c);
      const type = o.type as WatchChange["type"];
      if (!WATCH_TYPES.includes(type)) return [];
      const n = num(o.n);
      return [type === "low_stock" && n != null ? { type, n } : { type }];
    });
    if (!changes.length) return [];
    const price = num(p.priceFrom);
    return [{ name, url: p.url, priceFrom: price != null && price > 0 ? price : null, changes }];
  });
}

/** ISO date field of a payload, or null. */
export function payloadDate(payload: unknown, key: string): Date | null {
  const s = str(obj(payload)[key]);
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** PARTNER_ALERTS_START (ISO); null = unset/invalid → the job does nothing. */
export function alertsStartFromEnv(env: Record<string, string | undefined>): Date | null {
  const s = env.PARTNER_ALERTS_START?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
}
