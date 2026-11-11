// Partner presentation builder (2026-11-11): the pure partner layer around the
// CRM matcher. Everything a partner sends is untrusted: filters are parsed with
// bounds, matches are reduced to the partner's published projects with the
// internal fields blanked, and items are re-resolved against the project's own
// available units. No prisma import — the server actions load the rows.
import type { DevelopmentMatch, MatchFilters } from "@/lib/crm/matching";
import type { PresentationItemInput } from "@/lib/crm/presentations/core";
import { PROPERTY_VALUES } from "@/app/components/qualifierFields";
import { normalizeRef } from "@/lib/unitRef";
import { MAX_PRESENTATION_PROJECTS } from "./presentationDraft";

export const ITEM_NOTE_MAX = 300;
export const ITEM_ALIAS_MAX = 120;
export const EXPIRY_MAX_DAYS = 90;
const PLACE_MAX = 30;
const PLACE_LEN = 80;
const BUDGET_MAX = 1_000_000_000;

// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

const budget = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= BUDGET_MAX ? v : null;
const places = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "" && x.length <= PLACE_LEN && !CONTROL_RE.test(x)).map((x) => x.trim()).slice(0, PLACE_MAX)
    : [];

/** Bounded MatchFilters from anything (form state, localStorage, a saved criteria snapshot). Never includes unpublished projects. */
export function parsePartnerFilters(raw: unknown): MatchFilters {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const types = new Set<string>(PROPERTY_VALUES);
  const bedrooms = Array.isArray(r.bedrooms)
    ? Array.from(new Set(r.bedrooms.filter((b): b is number => typeof b === "number" && Number.isInteger(b) && b >= 0 && b <= 5)))
    : [];
  return {
    budgetMin: budget(r.budgetMin),
    budgetMax: budget(r.budgetMax),
    bedrooms,
    propertyTypes: Array.isArray(r.propertyTypes) ? Array.from(new Set(r.propertyTypes.filter((t): t is string => typeof t === "string" && types.has(t)))) : [],
    districts: places(r.districts),
    areas: places(r.areas),
    includeReady: false,
    onlyAvailable: typeof r.onlyAvailable === "boolean" ? r.onlyAvailable : true,
  };
}

/** A match as a partner may see it: only their published projects, no developer, no commission. */
/** The public site; images live there. */
export const PUBLIC_SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://cyprusvipestates.com").replace(/\/+$/, "");

/**
 * Project images are stored as site-relative paths ("/uploads/..."), and the partner host's nginx
 * blocks /uploads, so a relative path breaks there. Point it at the public site instead; absolute
 * URLs and empty values pass through unchanged.
 */
export function partnerImageUrl(src: string | null, origin: string = PUBLIC_SITE_ORIGIN): string | null {
  if (!src) return null;
  return src.startsWith("/") && !src.startsWith("//") ? `${origin}${src}` : src;
}

export function toPartnerMatch(m: DevelopmentMatch, allowed: ReadonlySet<string>, origin: string = PUBLIC_SITE_ORIGIN): DevelopmentMatch | null {
  if (!allowed.has(m.development.id) || m.development.publishStatus !== "published") return null;
  return {
    ...m,
    development: {
      ...m.development, developer: null, commission: { ratePercent: null, source: "MISSING" },
      mainImage: partnerImageUrl(m.development.mainImage, origin),
    },
  };
}

export type DevUnits = { name: string; units: { id: string; ref: string | null; status: string | null }[] };

export type PartnerItemsResult =
  | { ok: true; items: PresentationItemInput[] }
  | { ok: false; code: "err.presentationProjects" | "err.presentationUnits" | "err.presentationText"; developmentId?: string };

const strList = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 200).slice(0, 500) : null;

function cleanText(v: unknown, max: number): string | null | undefined {
  if (v == null) return "";
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t.length > max || CONTROL_RE.test(t)) return undefined;
  return t;
}

/**
 * Items from the builder, checked against the partner's own projects and each project's own units.
 * Refs/ids that are not a unit of that project are dropped; a project whose named picks all dropped is
 * refused (forged or stale input). null/null = whole project (all available units).
 */
export function validatePartnerItems(raw: unknown, ctx: { allowed: ReadonlySet<string>; devs: ReadonlyMap<string, DevUnits> }): PartnerItemsResult {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_PRESENTATION_PROJECTS) return { ok: false, code: "err.presentationProjects" };
  const seen = new Set<string>();
  const items: PresentationItemInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const it: unknown = raw[i];
    const r = it && typeof it === "object" ? (it as Record<string, unknown>) : {};
    const developmentId = typeof r.developmentId === "string" ? r.developmentId : "";
    const dev = ctx.devs.get(developmentId);
    if (!developmentId || seen.has(developmentId) || !ctx.allowed.has(developmentId) || !dev) {
      return { ok: false, code: "err.presentationProjects", developmentId: developmentId || undefined };
    }
    seen.add(developmentId);
    const aliasName = cleanText(r.aliasName, ITEM_ALIAS_MAX);
    const advisorComment = cleanText(r.advisorComment, ITEM_NOTE_MAX);
    if (aliasName === undefined || advisorComment === undefined) return { ok: false, code: "err.presentationText", developmentId };

    const wantRefs = strList(r.unitRefs);
    const wantIds = strList(r.unitIds);
    const named = (wantRefs?.length ?? 0) + (wantIds?.length ?? 0) > 0;
    let unitRefs: string[] | null = null;
    let unitIds: string[] | null = null;
    if (named) {
      // Any unit of THIS project counts, sold ones included: a saved pick whose units sold since stays
      // as it is (the client page shows them as sold, as the CRM editor keeps them). Refs/ids of other
      // projects are dropped; the builder only lets partners tick available units.
      const refs = new Set(wantRefs ?? []);
      const ids = new Set(wantIds ?? []);
      const keptRefs: string[] = [];
      const keptIds: string[] = [];
      for (const u of dev.units) {
        if (u.ref && u.ref.trim()) {
          const key = normalizeRef(u.ref, dev.name);
          if (refs.has(key) && !keptRefs.includes(key)) keptRefs.push(key);
        } else if (ids.has(u.id)) keptIds.push(u.id);
      }
      if (!keptRefs.length && !keptIds.length) return { ok: false, code: "err.presentationUnits", developmentId };
      unitRefs = keptRefs.length ? keptRefs : null;
      unitIds = keptIds.length ? keptIds : null;
    }
    items.push({ developmentId, unitRefs, unitIds, sortIndex: i, aliasName: aliasName || null, advisorComment: advisorComment || null });
  }
  return { ok: true, items };
}

/** A partner may edit only their own, not revoked presentation of a client they still actively hold. */
export function canEditPartnerPresentation(
  p: { partnerId: string | null; status: string; leadId: string },
  me: { partnerId: string; activeLeadIds: ReadonlySet<string> },
): boolean {
  return p.partnerId === me.partnerId && p.status !== "revoked" && me.activeLeadIds.has(p.leadId);
}

const nicosiaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia", year: "numeric", month: "2-digit", day: "2-digit" });
const nicosiaOffset = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Nicosia", timeZoneName: "shortOffset" });

/** Cyprus UTC offset in minutes at that instant (120 in winter, 180 in summer). */
function offsetMinutes(at: Date): number {
  const name = nicosiaOffset.formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 120;
}

/** "YYYY-MM-DD" in [tomorrow, today + 90] (Cyprus calendar) → 23:59:59 that day in Cyprus; else null. */
export function expiryFromInput(s: string, now: Date): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const day = Date.UTC(y, mo - 1, d);
  const check = new Date(day);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  const [ty, tm, td] = nicosiaDay.format(now).split("-").map(Number);
  const today = Date.UTC(ty, tm - 1, td);
  const diff = Math.round((day - today) / 86_400_000);
  if (diff < 1 || diff > EXPIRY_MAX_DAYS) return null;
  // 23:59:59 Cyprus time on that day, summer or winter.
  const local = Date.UTC(y, mo - 1, d, 23, 59, 59);
  return new Date(local - offsetMinutes(new Date(local - 120 * 60_000)) * 60_000);
}
