// Rating seasons glue (partner portal phase 4b, Task 4). Pure, no DB access.
// - CRM season form: Cyprus calendar days → UTC instants, point fields, prizes per locale → validateSeason.
// - Season status / overlap warning / the cron's window selection / the portal's current season.
// - Stored JSON → typed point rules and prizes (defensive).
// - Ranking rows: the CRM view (names, all partners) and the portal DTO (anonymised, ACTIVE partners only).
// - CRM CSV (semicolon, BOM, formula-injection guard).
// DB side: ratingStore.ts. Core rules: rating.ts.
import { cyprusWallTimeToUtc } from "@/lib/booking/timezone";
import { countryCodeToFlagEmoji } from "@/lib/countries";
import { cyprusDay } from "./commissions";
import { csvCell } from "./commissionsCsv";
import { PARTNER_LOCALES } from "./i18n";
import {
  DEFAULT_POINT_RULES, POINT_KINDS, pseudonyms, rankPartners, validateSeason,
  type PointKind, type PointRules, type SeasonPrizes, type SeasonValidation,
} from "./rating";

const DAY = 86_400_000;
/** The cron keeps scanning a season this long after its end (late status changes / reviews). */
export const LATE_DATA_DAYS = 3;
export const PORTAL_TOP = 20;
export const PAST_SEASONS = 4;

// ── Season form (CRM) ───────────────────────────────────────────────────────

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" → its parts when it is a real calendar day, else null. */
function dayParts(v: unknown): [number, number, number] | null {
  if (typeof v !== "string") return null;
  const m = DAY_RE.exec(v.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d ? [y, mo, d] : null;
}

/** 00:00 Cyprus time on that day, as a UTC instant. */
export function cyprusDayStart(v: unknown): Date | null {
  const p = dayParts(v);
  return p ? cyprusWallTimeToUtc(p[0], p[1], p[2], 0, 0) : null;
}

/** The last second of that Cyprus day (23:59:59), as a UTC instant: season ends are inclusive. */
export function cyprusDayEnd(v: unknown): Date | null {
  const p = dayParts(v);
  if (!p) return null;
  const next = new Date(Date.UTC(p[0], p[1] - 1, p[2]) + DAY);
  return new Date(cyprusWallTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0).getTime() - 1000);
}

export type SeasonFormInput = {
  name?: unknown;
  startsOn?: unknown;
  endsOn?: unknown;
  points?: Partial<Record<PointKind, unknown>>;
  prizes?: Partial<Record<string, unknown>>;
};

/**
 * The CRM form → validateSeason. Days are Cyprus calendar days (start 00:00, end 23:59:59 Cyprus).
 * A blank point field takes the default; anything that is not a whole number reaches validateSeason
 * unchanged so it reports the field.
 */
export function parseSeasonForm(input: unknown): SeasonValidation {
  const r = (input && typeof input === "object" ? input : {}) as SeasonFormInput;
  const pointRules: Record<string, unknown> = {};
  for (const k of POINT_KINDS) {
    const raw = r.points?.[k];
    const s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
    pointRules[k] = s === "" ? DEFAULT_POINT_RULES[k] : /^\d+$/.test(s) ? Number(s) : s;
  }
  const prizes: Record<string, unknown> = {};
  for (const l of PARTNER_LOCALES) {
    const v = r.prizes?.[l];
    if (typeof v === "string") prizes[l] = v;
  }
  // An unparseable day becomes an invalid date, which validateSeason reports as such.
  return validateSeason({
    name: r.name, startsAt: cyprusDayStart(r.startsOn) ?? "invalid", endsAt: cyprusDayEnd(r.endsOn) ?? "invalid", pointRules, prizes,
  });
}

/** The form's initial values for an existing season (Cyprus days, stored rules and prizes). */
export function seasonFormValues(s: { name: string; startsAt: Date; endsAt: Date; pointRules: unknown; prizes: unknown }) {
  const rules = pointRulesFromJson(s.pointRules);
  const prizes = prizesFromJson(s.prizes);
  return {
    name: s.name,
    startsOn: cyprusDay(s.startsAt),
    endsOn: cyprusDay(s.endsAt),
    points: Object.fromEntries(POINT_KINDS.map((k) => [k, String(rules[k])])) as Record<PointKind, string>,
    prizes: Object.fromEntries(PARTNER_LOCALES.map((l) => [l, prizes[l] ?? ""])) as Record<string, string>,
  };
}

// ── Stored JSON ─────────────────────────────────────────────────────────────

/** Stored point rules → whole numbers 0..; anything missing or broken falls back to the default. */
export function pointRulesFromJson(v: unknown): PointRules {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const out = { ...DEFAULT_POINT_RULES };
  for (const k of POINT_KINDS) {
    const n = o[k];
    if (typeof n === "number" && Number.isInteger(n) && n >= 0) out[k] = n;
  }
  return out;
}

/** Stored prizes → { en, de?, pl?, ru? } (strings only, trimmed; never Hebrew). */
export function prizesFromJson(v: unknown): SeasonPrizes {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const out: SeasonPrizes = { en: typeof o.en === "string" ? o.en.trim() : "" };
  for (const l of PARTNER_LOCALES) {
    if (l === "en") continue;
    const s = typeof o[l] === "string" ? (o[l] as string).trim() : "";
    if (s) out[l] = s;
  }
  return out;
}

// ── Season windows ──────────────────────────────────────────────────────────

type Window = { startsAt: Date; endsAt: Date };
export type SeasonStatus = "upcoming" | "active" | "ended";

export function seasonStatus(s: Window, now: Date): SeasonStatus {
  if (now.getTime() < s.startsAt.getTime()) return "upcoming";
  return now.getTime() > s.endsAt.getTime() ? "ended" : "active";
}

/** Other seasons whose window overlaps [startsAt, endsAt] (allowed, the CRM only warns). */
export function overlappingSeasons<T extends Window & { id: string }>(s: Window, others: T[], excludeId?: string | null): T[] {
  return others.filter((o) => o.id !== excludeId && o.startsAt.getTime() <= s.endsAt.getTime() && o.endsAt.getTime() >= s.startsAt.getTime());
}

/** The points cron's seasons: started, and not more than LATE_DATA_DAYS past their end. */
export function seasonsForPointsRun<T extends Window>(seasons: T[], now: Date): T[] {
  const t = now.getTime();
  return seasons.filter((s) => s.startsAt.getTime() <= t && t <= s.endsAt.getTime() + LATE_DATA_DAYS * DAY);
}

/** Prisma filter for seasonsForPointsRun (same bounds). */
export function pointsRunSeasonWhere(now: Date) {
  return { startsAt: { lte: now }, endsAt: { gte: new Date(now.getTime() - LATE_DATA_DAYS * DAY) } };
}

/** The portal's current season: active now; with several, the one ending soonest (then the earliest start, then id). */
export function currentSeason<T extends Window & { id: string }>(seasons: T[], now: Date): T | null {
  const active = seasons.filter((s) => seasonStatus(s, now) === "active");
  active.sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime() || a.startsAt.getTime() - b.startsAt.getTime() || (a.id < b.id ? -1 : 1));
  return active[0] ?? null;
}

/** The last `n` ended seasons, latest end first. */
export function pastSeasons<T extends Window & { id: string }>(seasons: T[], now: Date, n = PAST_SEASONS): T[] {
  return seasons
    .filter((s) => seasonStatus(s, now) === "ended")
    .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime() || (a.id < b.id ? -1 : 1))
    .slice(0, n);
}

export function pointsStartFromEnv(env: Record<string, string | undefined>): Date | null {
  const s = env.PARTNER_POINTS_START?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
}

// ── Claim facts for pointEventsFor ──────────────────────────────────────────

/** STATUS_CHANGE metadata → the target status, or null. */
export function toStatusOf(metadata: unknown): string | null {
  const m = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : null;
  return typeof m?.toStatus === "string" ? m.toStatus : null;
}

/**
 * Group STATUS_CHANGE rows by lead (any order). pointEventsFor applies the activeSince gate per claim;
 * rows without a toStatus are dropped.
 */
export function statusChangesByLead(rows: { leadId: string; occurredAt: Date; metadata: unknown }[]): Map<string, { toStatus: string; at: Date }[]> {
  const out = new Map<string, { toStatus: string; at: Date }[]>();
  for (const r of rows) {
    const toStatus = toStatusOf(r.metadata);
    if (!toStatus) continue;
    const list = out.get(r.leadId) ?? [];
    list.push({ toStatus, at: r.occurredAt });
    out.set(r.leadId, list);
  }
  return out;
}

// ── Ranking ─────────────────────────────────────────────────────────────────

/** One row of the per-season aggregate: (partner, kind) → sum of points, latest point time. */
export type KindAggregate = { partnerId: string; kind: string; points: number; lastAt: Date | null };
export type PartnerInfo = { id: string; status: string; country: string; firstName?: string; lastName?: string; company?: string | null };
export type PartnerSeasonTotal = { partnerId: string; points: number; lastAt: Date | null; byKind: Record<PointKind, number> };

const emptyKinds = (): Record<PointKind, number> => ({ claim_accepted: 0, viewing: 0, reserved: 0, closed: 0 });

/** Folds the (partner, kind) aggregate into per-partner totals with a breakdown by kind (unknown kinds count in the total only). */
export function seasonTotals(rows: KindAggregate[]): PartnerSeasonTotal[] {
  const by = new Map<string, PartnerSeasonTotal>();
  for (const r of rows) {
    const t = by.get(r.partnerId) ?? { partnerId: r.partnerId, points: 0, lastAt: null, byKind: emptyKinds() };
    t.points += r.points;
    if ((POINT_KINDS as readonly string[]).includes(r.kind)) t.byKind[r.kind as PointKind] += r.points;
    if (r.lastAt && (!t.lastAt || r.lastAt.getTime() > t.lastAt.getTime())) t.lastAt = r.lastAt;
    by.set(r.partnerId, t);
  }
  return Array.from(by.values());
}

export type CrmRankingRow = {
  rank: number; partnerId: string; name: string; company: string | null; country: string; status: string;
  points: number; byKind: Record<PointKind, number>; lastAt: Date | null;
};

/** The CRM's full ranking: every partner with points (any status), with names. */
export function crmRanking(totals: PartnerSeasonTotal[], partners: PartnerInfo[]): CrmRankingRow[] {
  const info = new Map(partners.map((p) => [p.id, p]));
  const byId = new Map(totals.map((t) => [t.partnerId, t]));
  return rankPartners(totals).map((r) => {
    const p = info.get(r.partnerId);
    return {
      rank: r.rank, partnerId: r.partnerId,
      name: p ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : "(deleted partner)",
      company: p?.company ?? null, country: p?.country ?? "", status: p?.status ?? "",
      points: r.points, byKind: byId.get(r.partnerId)!.byKind, lastAt: r.lastAt,
    };
  });
}

/**
 * A portal ranking row. Deliberately no partnerId, name, company or client: other partners are only
 * "Partner #n" + flag; the viewer's own row is marked `me`.
 */
export type PortalRankingRow = { rank: number | null; me: boolean; pseudonym: number | null; flag: string; points: number };
export type PortalRanking = {
  rows: PortalRankingRow[];
  total: number;
  /** The viewer's rank among ranked ACTIVE partners; null without points. */
  myRank: number | null;
  myPoints: number;
  myByKind: Record<PointKind, number>;
  /** True when the viewer's own row was appended below the top list (also when unranked, without points). */
  meOutsideTop: boolean;
};

/**
 * The portal ranking of one season for the viewer `meId`: only ACTIVE partners are ranked (ranks among
 * them), top `top` plus the viewer's own row always (rank null and 0 points without points). Pseudonyms are assigned over every partner with
 * points in the season (any status), so a suspension never renumbers the others.
 */
export function portalRanking(input: {
  seasonId: string; meId: string; meCountry?: string; totals: PartnerSeasonTotal[]; partners: Pick<PartnerInfo, "id" | "status" | "country">[];
  top?: number;
}): PortalRanking {
  const top = input.top ?? PORTAL_TOP;
  const info = new Map(input.partners.map((p) => [p.id, p]));
  const names = pseudonyms(input.totals.map((t) => t.partnerId), input.seasonId);
  const active = input.totals.filter((t) => info.get(t.partnerId)?.status === "ACTIVE");
  const ranked = rankPartners(active);
  const mine = input.totals.find((t) => t.partnerId === input.meId);
  const meRanked = ranked.find((r) => r.partnerId === input.meId) ?? null;
  const toRow = (r: { partnerId: string; points: number; rank: number }): PortalRankingRow => {
    const me = r.partnerId === input.meId;
    return { rank: r.rank, me, pseudonym: me ? null : names.get(r.partnerId) ?? null, flag: countryCodeToFlagEmoji(info.get(r.partnerId)?.country ?? ""), points: r.points };
  };
  const rows = ranked.slice(0, top).map(toRow);
  const meOutsideTop = !meRanked || meRanked.rank > top;
  if (meRanked && meRanked.rank > top) rows.push(toRow(meRanked));
  if (!meRanked) rows.push({ rank: null, me: true, pseudonym: null, flag: countryCodeToFlagEmoji(input.meCountry ?? ""), points: 0 });
  return {
    rows, total: ranked.length, myRank: meRanked?.rank ?? null, myPoints: mine?.points ?? 0,
    myByKind: mine?.byKind ?? emptyKinds(), meOutsideTop,
  };
}

// ── CRM CSV ─────────────────────────────────────────────────────────────────

const ISO = (d: Date | null) => (d ? d.toISOString().replace("T", " ").slice(0, 16) + " UTC" : null);

export function ratingCsvRows(rows: CrmRankingRow[]): (string | number | null)[][] {
  return rows.map((r) => [r.rank, r.name, r.company, r.country, r.status, ...POINT_KINDS.map((k) => r.byKind[k]), r.points, ISO(r.lastAt)]);
}

/** CRM ranking CSV (English): semicolon-separated, BOM for Excel, text cells guarded against formulas. */
export function ratingCsv(rows: CrmRankingRow[]): string {
  const header = ["Rank", "Partner", "Company", "Country", "Status", "Client accepted", "Viewing", "Reservation", "Closed deal", "Total points", "Last points"];
  return "﻿" + [header, ...ratingCsvRows(rows)].map((l) => l.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

/** A safe file name for the season CSV. */
export function ratingCsvFilename(name: string, startsAt: Date): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "season";
  return `rating-${slug}-${cyprusDay(startsAt)}.csv`;
}
