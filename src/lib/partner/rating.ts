// Partner rating seasons (partner portal phase 4b). Pure, no DB access.
// Points are an idempotent ledger: one event per claim, kind and season (refKey unique), derived from
// facts that already exist (claim accepted, lead status history). Other partners are only ever shown
// as "Partner #<pseudonym>", never by name.
import { createHash } from "node:crypto";
import { PARTNER_LOCALES, type PartnerLocale } from "./i18n";

export const POINT_KINDS = ["claim_accepted", "viewing", "reserved", "closed"] as const;
export type PointKind = (typeof POINT_KINDS)[number];
export type PointRules = Record<PointKind, number>;

export const DEFAULT_POINT_RULES: PointRules = { claim_accepted: 10, viewing: 20, reserved: 50, closed: 100 };

export const SEASON_NAME_MAX = 80;
export const SEASON_MAX_DAYS = 400;
export const POINTS_MAX = 1000;
export const PRIZES_MAX = 2000;
const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Prize text per partner locale: English required, the others optional (fall back to English). */
export type SeasonPrizes = { en: string } & Partial<Record<Exclude<PartnerLocale, "en">, string>>;
export type SeasonInput = { name: string; startsAt: Date; endsAt: Date; pointRules: PointRules; prizes: SeasonPrizes };
export type SeasonValidation = { ok: true; value: SeasonInput } | { ok: false; errors: string[] };

const toDate = (v: unknown): Date | null => {
  const dt = v instanceof Date ? v : typeof v === "string" || typeof v === "number" ? new Date(v) : null;
  return dt && Number.isFinite(dt.getTime()) ? dt : null;
};
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** CRM season form validation (English messages). Missing point rules fall back to the defaults. */
export function validateSeason(raw: unknown): SeasonValidation {
  const r = obj(raw);
  if (!r) return { ok: false, errors: ["Invalid season."] };
  const errors: string[] = [];

  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (name.length < 1 || name.length > SEASON_NAME_MAX) errors.push(`The name must be 1–${SEASON_NAME_MAX} characters.`);

  const startsAt = toDate(r.startsAt);
  const endsAt = toDate(r.endsAt);
  if (!startsAt) errors.push("The start date is invalid.");
  if (!endsAt) errors.push("The end date is invalid.");
  if (startsAt && endsAt) {
    if (startsAt.getTime() >= endsAt.getTime()) errors.push("The season must start before it ends.");
    else if (endsAt.getTime() - startsAt.getTime() > SEASON_MAX_DAYS * DAY) errors.push(`A season can last at most ${SEASON_MAX_DAYS} days.`);
  }

  const pointRules: PointRules = { ...DEFAULT_POINT_RULES };
  if (r.pointRules != null) {
    const pr = obj(r.pointRules);
    if (!pr) errors.push("The point rules are invalid.");
    else {
      for (const k of POINT_KINDS) {
        if (pr[k] === undefined) continue;
        const v = pr[k];
        if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > POINTS_MAX) errors.push(`Points for "${k}" must be a whole number from 0 to ${POINTS_MAX}.`);
        else pointRules[k] = v;
      }
    }
  }

  const prizes: SeasonPrizes = { en: "" };
  const pz = obj(r.prizes);
  if (!pz) errors.push("The English prize text is required.");
  else {
    for (const l of PARTNER_LOCALES) {
      const v = pz[l];
      if (v != null && typeof v !== "string") {
        errors.push(`The ${l.toUpperCase()} prize text is invalid.`);
        continue;
      }
      const s = (v ?? "").trim();
      if (s.length > PRIZES_MAX) errors.push(`The ${l.toUpperCase()} prize text can have at most ${PRIZES_MAX} characters.`);
      else if (s) prizes[l] = s;
    }
    if (!prizes.en) errors.push("The English prize text is required.");
  }

  if (errors.length || !startsAt || !endsAt) return { ok: false, errors };
  return { ok: true, value: { name, startsAt, endsAt, pointRules, prizes } };
}

/** The prize text in the partner's language, falling back to English. */
export function seasonPrizes(prizes: SeasonPrizes, locale: PartnerLocale): string {
  return (locale === "en" ? "" : prizes[locale]?.trim()) || prizes.en;
}

// ── Point events ────────────────────────────────────────────────────────────

/**
 * Facts of one claim. The caller passes only claims that are (or were) ACTIVE for the partner;
 * `acceptedAt` is when the client was accepted (null if never), `activeSince` from claimState.activeSince.
 * `statusChanges` are the lead's STATUS_CHANGE history entries, any order.
 */
export type ClaimPointFacts = {
  claimId: string;
  partnerId: string;
  acceptedAt: Date | null;
  activeSince: Date;
  statusChanges: { toStatus: string; at: Date }[];
};
export type SeasonForPoints = { id: string; startsAt: Date; endsAt: Date; pointRules: PointRules };
export type PointEvent = { seasonId: string; partnerId: string; kind: PointKind; refKey: string; points: number; at: Date };

/** Statuses that prove each milestone was reached (a later funnel stage implies the earlier ones). */
const MILESTONE_STATUSES: Record<Exclude<PointKind, "claim_accepted">, readonly string[]> = {
  viewing: ["VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED"],
  reserved: ["RESERVED", "CLOSED"],
  closed: ["CLOSED"],
};

export const pointRefKey = (kind: PointKind, claimId: string, seasonId: string) => `${kind}:${claimId}:${seasonId}`;

/**
 * The events a season owes for the given claims. Each milestone's date is its FIRST occurrence on or
 * after activeSince; it earns points only if that date lies in [startsAt, endsAt] (inclusive). A
 * milestone first reached before the season therefore never counts in it, and re-entering a stage
 * never counts twice. Zero-point rules emit nothing. Deterministic: same input, same refKeys.
 */
export function pointEventsFor(facts: ClaimPointFacts[], season: SeasonForPoints): PointEvent[] {
  const from = season.startsAt.getTime();
  const to = season.endsAt.getTime();
  const out: PointEvent[] = [];
  for (const f of facts) {
    const gate = f.activeSince.getTime();
    const changes = f.statusChanges.filter((c) => c.at.getTime() >= gate).sort((a, b) => a.at.getTime() - b.at.getTime());
    const firsts: [PointKind, Date | null][] = [
      ["claim_accepted", f.acceptedAt && f.acceptedAt.getTime() >= gate ? f.acceptedAt : null],
      ...(Object.keys(MILESTONE_STATUSES) as (keyof typeof MILESTONE_STATUSES)[]).map(
        (k): [PointKind, Date | null] => [k, changes.find((c) => MILESTONE_STATUSES[k].includes(c.toStatus))?.at ?? null],
      ),
    ];
    for (const [kind, at] of firsts) {
      if (!at || at.getTime() < from || at.getTime() > to) continue;
      const points = season.pointRules[kind] ?? 0;
      if (points <= 0) continue;
      out.push({ seasonId: season.id, partnerId: f.partnerId, kind, refKey: pointRefKey(kind, f.claimId, season.id), points, at });
    }
  }
  return out;
}

// ── Ranking ─────────────────────────────────────────────────────────────────

export type PartnerTotal = { partnerId: string; points: number; lastAt: Date | null };
export type RankedPartner = PartnerTotal & { rank: number };

/** Points desc; ties by the earlier last point (who got there first), then partnerId. Ranks are 1..n, never shared. */
export function rankPartners(totals: PartnerTotal[]): RankedPartner[] {
  const t = (d: Date | null) => (d ? d.getTime() : Number.POSITIVE_INFINITY);
  return [...totals]
    .sort((a, b) => b.points - a.points || t(a.lastAt) - t(b.lastAt) || (a.partnerId < b.partnerId ? -1 : a.partnerId > b.partnerId ? 1 : 0))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

const PSEUDO_MIN = 100;
const PSEUDO_SPAN = 900;

/**
 * A stable 3-digit number (100–999) for a partner within a season, from sha256(`${seasonId}:${partnerId}`).
 * With `taken`, a collision moves to the next free number (999 wraps to 100) and the result is added
 * to the set. Assign in a stable order (see pseudonyms) so the numbers stay stable.
 */
export function pseudonym(partnerId: string, seasonId: string, taken?: Set<number>): number {
  const h = createHash("sha256").update(`${seasonId}:${partnerId}`).digest("hex");
  let n = parseInt(h.slice(0, 8), 16) % PSEUDO_SPAN;
  if (!taken) return PSEUDO_MIN + n;
  for (let i = 0; i < PSEUDO_SPAN; i++, n = (n + 1) % PSEUDO_SPAN) {
    if (!taken.has(PSEUDO_MIN + n)) {
      taken.add(PSEUDO_MIN + n);
      return PSEUDO_MIN + n;
    }
  }
  throw new Error("pseudonym: no free number left in this season");
}

/** Collision-free pseudonyms for all partners of a season, assigned in partnerId order (input order does not matter). */
export function pseudonyms(partnerIds: string[], seasonId: string): Map<string, number> {
  const taken = new Set<number>();
  const out = new Map<string, number>();
  for (const id of Array.from(new Set(partnerIds)).sort()) out.set(id, pseudonym(id, seasonId, taken));
  return out;
}

/** Whole days and hours until the end; ended at or after endsAt. */
export function countdown(endsAt: Date, now: Date): { days: number; hours: number; ended: boolean } {
  const diff = endsAt.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, ended: true };
  return { days: Math.floor(diff / DAY), hours: Math.floor((diff % DAY) / HOUR), ended: false };
}
