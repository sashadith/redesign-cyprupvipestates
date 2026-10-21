// Match alerts — pure glue between the DB side (matchSend.ts) and the planner (matchAlerts.ts).
// No DB access: event → planner change mapping, claim project ids, cross-day dedupe, the payload,
// public project links and the owner digest (grouping + English e-mail). Partner phase 3e, Decision 6.
import type { ChangeEvent } from "@/lib/crm/inventoryChanges";
import { escapeHtml } from "./mail";
import { MATCH_CHANGE_TYPES, type MatchChange, type MatchChangeType, type PlannedMatchAlert } from "./matchAlerts";

/** Event types the cron asks inventoryChanges for. */
export const MATCH_EVENT_TYPES: MatchChangeType[] = [...MATCH_CHANGE_TYPES];
/** Upper bounds per run (Task 4). */
export const MATCH_CLAIM_CAP = 2000;
export const MATCH_CHANGE_CAP = 500;
/** A MATCH row for the same claim + development with the same change and price inside this window is not repeated. */
export const MATCH_DEDUPE_DAYS = 14;
/** Projects per claim considered (the submit form allows far fewer). */
export const MATCH_PROJECTS_PER_CLAIM = 20;
/** Lead statuses that never get alerts. */
export const MATCH_EXCLUDED_LEAD_STATUSES = ["CLOSED", "LOST"] as const;
/** SYSTEM LeadInteraction marking that the lead's owner got today's match e-mail. */
export const OWNER_MARK_BODY = "Partner match alert sent to owner";

const SITE = "https://cyprusvipestates.com";
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** PARTNER_MATCH_START (ISO); null = unset/invalid → the job does nothing. */
export function matchStartFromEnv(env: Record<string, string | undefined>): Date | null {
  const s = env.PARTNER_MATCH_START?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
}

// ── Links ───────────────────────────────────────────────────────────────────

/** Absolute English project URL from inventoryChanges' publicUrl (relative per locale); null when unpublished. */
export function absoluteProjectUrl(publicUrl: unknown): string | null {
  const en = obj(publicUrl).en;
  return typeof en === "string" && en.startsWith("/projects/") ? `${SITE}${en}` : null;
}

/** The stored English project URL in the partner's language (en has no prefix); anything else is returned unchanged. */
export function localizedProjectUrl(url: string, locale: string): string {
  const enPrefix = `${SITE}/projects/`;
  if (locale === "en" || !url.startsWith(enPrefix) || !/^[a-z]{2}$/.test(locale)) return url;
  return `${SITE}/${locale}/projects/${url.slice(enPrefix.length)}`;
}

/** Only our own public project pages may be linked from a partner alert. */
export function isOwnProjectUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith(`${SITE}/`) && !/[\s"<>]/.test(url) && url.length <= 500;
}

// ── Event → planner change ──────────────────────────────────────────────────

/**
 * Maps one inventoryChanges event to the planner's change shape(s).
 *  - published / back_on_market: the development's priceFrom (looked up by the caller);
 *  - new_units: the cheapest new unit's price;
 *  - price_from_changed: new priceFrom, previous one kept (the planner keeps decreases only);
 *  - unit_price_changed: one change per unit whose price went DOWN (new price, previous price).
 * Anything without a public URL or a usable price yields nothing.
 */
export function eventToChanges(ev: ChangeEvent, priceFromById: Map<string, number | null>): MatchChange[] {
  const url = absoluteProjectUrl(ev.publicUrl);
  if (!url) return [];
  const base = { developmentId: ev.developmentId, name: ev.name, location: ev.location, url };
  const positive = (n: number | null) => n != null && n > 0;
  switch (ev.type) {
    case "published":
    case "back_on_market": {
      const price = priceFromById.get(ev.developmentId) ?? null;
      return positive(price) ? [{ ...base, type: ev.type, price }] : [];
    }
    case "new_units": {
      const min = num(obj(ev.priceRange).min);
      return positive(min) ? [{ ...base, type: "new_units", price: min }] : [];
    }
    case "price_from_changed": {
      const from = num(ev.from);
      const to = num(ev.to);
      return positive(to) && positive(from) && to! < from! ? [{ ...base, type: "price_from_changed", price: to, previousPrice: from }] : [];
    }
    case "unit_price_changed": {
      const units = Array.isArray(ev.units) ? ev.units : [];
      const out: MatchChange[] = [];
      for (const u of units) {
        const from = num(obj(u).from);
        const to = num(obj(u).to);
        if (positive(to) && positive(from) && to! < from!) out.push({ ...base, type: "unit_price_changed", price: to, previousPrice: from });
      }
      return out;
    }
    default:
      return [];
  }
}

/** Development ids whose priceFrom the mapping needs (published / back_on_market events). */
export function priceFromIdsNeeded(events: ChangeEvent[]): string[] {
  return Array.from(new Set(events.filter((e) => e.type === "published" || e.type === "back_on_market").map((e) => e.developmentId)));
}

// ── Claims ──────────────────────────────────────────────────────────────────

/** Submitted project (development) ids of a claim: `projects[].id`, else `projectIds`; de-duplicated, capped. */
export function claimProjectIds(submission: unknown): string[] {
  const o = obj(submission);
  const fromProjects = Array.isArray(o.projects) ? o.projects.map((p) => obj(p).id) : [];
  const raw = fromProjects.length ? fromProjects : Array.isArray(o.projectIds) ? o.projectIds : [];
  const ids = raw.filter((x): x is string => typeof x === "string" && x.trim() !== "" && x.length <= 64).map((x) => x.trim());
  return Array.from(new Set(ids)).slice(0, MATCH_PROJECTS_PER_CLAIM);
}

/** The name the partner submitted (never the CRM lead's stored name). */
export function submittedName(submission: unknown): string {
  const o = obj(submission);
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return `${s(o.firstName)} ${s(o.lastName)}`.trim();
}

// ── Outbox payload and cross-day dedupe ─────────────────────────────────────

export type MatchRowPayload = { projectName: string; changeType: MatchChangeType; priceFrom: number; url: string; clientName: string };

export function matchRowPayload(alert: PlannedMatchAlert, clientName: string): MatchRowPayload {
  return { ...alert.payload, clientName };
}

/** Development id from a `match:<claimId>:<developmentId>:<YYYY-MM-DD>` refKey; null when it is not one. */
export function developmentIdFromMatchRefKey(refKey: string): string | null {
  const parts = refKey.split(":");
  return parts.length === 4 && parts[0] === "match" && parts[2] ? parts[2] : null;
}

/**
 * Snapshot diffs compare the last snapshot before the window with LIVE state, so the same change shows up
 * again on the following days. Drops a planned alert when a MATCH row for the same claim and development
 * with the same change type and price already exists (the caller loads the last MATCH_DEDUPE_DAYS days).
 */
export function dropRepeatedAlerts<T extends PlannedMatchAlert>(
  planned: T[],
  recent: { claimId: string | null; refKey: string; payload: unknown }[],
): { keep: T[]; repeated: number } {
  const seen = new Set<string>();
  for (const r of recent) {
    const dev = developmentIdFromMatchRefKey(r.refKey);
    const p = obj(r.payload);
    if (!r.claimId || !dev || typeof p.changeType !== "string" || num(p.priceFrom) == null) continue;
    seen.add(`${r.claimId}|${dev}|${p.changeType}|${num(p.priceFrom)}`);
  }
  const keep = planned.filter((a) => !seen.has(`${a.claimId}|${a.developmentId}|${a.payload.changeType}|${a.payload.priceFrom}`));
  return { keep, repeated: planned.length - keep.length };
}

// ── Owner digest (staff, English) ───────────────────────────────────────────

/** Whether a SYSTEM interaction's metadata marks the owner mail for `today`. */
export function ownerMarkedFor(metadata: unknown, today: string): boolean {
  return obj(metadata).partnerMatch === today;
}

export type OwnerAlertRow = { leadId: string; partnerId: string; developmentId: string; payload: unknown };
export type OwnerLead = {
  id: string;
  name: string;
  owner: { id: string; name: string; email: string | null; isActive: boolean } | null;
  markedToday: boolean;
};
export type OwnerDigestItem = {
  leadId: string; leadName: string; partner: string; project: string; changeType: string; priceFrom: number | null;
};
export type OwnerDigest = { ownerId: string; ownerName: string; email: string; items: OwnerDigestItem[]; leadIds: string[]; developmentIdsByLead: Record<string, string[]> };

/**
 * Groups today's MATCH rows by the lead's owner: one digest per active owner with an e-mail. Leads
 * already marked for today, without an owner, or with an inactive / mail-less owner are counted, not mailed.
 */
export function groupOwnerDigests(input: {
  rows: OwnerAlertRow[];
  leads: Map<string, OwnerLead>;
  partnerLabels: Map<string, string>;
}): { digests: OwnerDigest[]; skipped: Record<string, number> } {
  const skipped: Record<string, number> = {};
  const skip = (k: string) => (skipped[k] = (skipped[k] ?? 0) + 1);
  const byOwner = new Map<string, OwnerDigest>();
  const counted = new Set<string>();
  for (const r of input.rows) {
    const lead = input.leads.get(r.leadId);
    const reason = !lead ? "lead missing"
      : lead.markedToday ? "already sent"
      : !lead.owner ? "no owner"
      : !lead.owner.isActive ? "owner inactive"
      : !(lead.owner.email ?? "").trim() ? "owner without email"
      : null;
    if (reason || !lead || !lead.owner) {
      if (!counted.has(r.leadId)) skip(reason ?? "lead missing");
      counted.add(r.leadId);
      continue;
    }
    const o = lead.owner;
    let d = byOwner.get(o.id);
    if (!d) {
      d = { ownerId: o.id, ownerName: o.name, email: o.email!.trim(), items: [], leadIds: [], developmentIdsByLead: {} };
      byOwner.set(o.id, d);
    }
    const p = obj(r.payload);
    d.items.push({
      leadId: lead.id,
      leadName: lead.name || "—",
      partner: input.partnerLabels.get(r.partnerId) ?? "—",
      project: typeof p.projectName === "string" && p.projectName.trim() ? p.projectName.trim() : "—",
      changeType: typeof p.changeType === "string" ? p.changeType : "—",
      priceFrom: num(p.priceFrom),
    });
    if (!d.leadIds.includes(lead.id)) d.leadIds.push(lead.id);
    const devs = (d.developmentIdsByLead[lead.id] ??= []);
    if (!devs.includes(r.developmentId)) devs.push(r.developmentId);
  }
  const digests = Array.from(byOwner.values());
  for (const d of digests) d.items.sort((a, b) => a.leadName.localeCompare(b.leadName) || a.project.localeCompare(b.project));
  return { digests, skipped };
}

const CHANGE_LABEL_EN: Record<string, string> = {
  published: "new project",
  new_units: "new units",
  price_from_changed: "price reduced",
  unit_price_changed: "unit price reduced",
  back_on_market: "back on the market",
};
const euro = (n: number | null) => (n == null ? "—" : `€${Math.round(n).toLocaleString("en-US")}`);

/** Internal English mail to a lead owner listing today's partner match alerts on their leads. */
export function buildOwnerMatchEmail(d: { ownerName: string; items: OwnerDigestItem[] }, base: string, today: string): { subject: string; text: string; html: string } {
  const root = base.replace(/\/+$/, "");
  const leadUrl = (id: string) => `${root}/crm/leads/${encodeURIComponent(id)}`;
  const first = d.ownerName.trim().split(/\s+/)[0] || "there";
  const n = d.items.length;
  const subject = `Partner match alerts on your leads (${n}) — ${today}`;
  // "Queued", not "told": the outbox delivers them later and may still skip a row (gate, opt-out, failure).
  const intro = "Match alerts queued for the partners of these clients today.";
  const line = (i: OwnerDigestItem) =>
    `${i.leadName} (partner: ${i.partner}) — ${i.project}, ${CHANGE_LABEL_EN[i.changeType] ?? i.changeType}, from ${euro(i.priceFrom)}`;
  const text = [`Hi ${first},`, intro, ...d.items.map((i) => `- ${line(i)}\n  ${leadUrl(i.leadId)}`), "This is an automatic notice from the partner portal."].join("\n\n");
  const html =
    `<p>Hi ${escapeHtml(first)},</p><p>${escapeHtml(intro)}</p><ul>` +
    d.items.map((i) => `<li>${escapeHtml(line(i))} — <a href="${escapeHtml(leadUrl(i.leadId))}">open lead</a></li>`).join("") +
    `</ul><p style="color:#666;font-size:12px">This is an automatic notice from the partner portal.</p>`;
  return { subject, text, html };
}
