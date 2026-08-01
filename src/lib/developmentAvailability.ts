// Single source of truth for "is this Development sold out" — computed from
// live DevelopmentUnit rows, never from the manually-set stage/status string.
//
// Bug this exists to prevent: Development.status/stage are feed-derived or
// admin-set strings (e.g. "Sold") that are never reconciled against actual
// unit availability once units are manually corrected (source: "manual") or
// a later sync re-asserts a stale feed value. Celestia (2026-07-17) showed a
// "SOLD OUT" badge while 2 of its 16 units were genuinely available, because
// the badge trusted `stage || status` instead of counting units. See
// resolveAvailabilityStatusLabel/resolveStageLabel/availabilityContradiction
// below for the fix.

import { developmentCopy } from "@/lib/developmentCopy";

export type UnitStatusLike = { status?: string | null };

export type AvailabilityState = { total: number; available: number; soldOut: boolean };

export function computeAvailability(units: UnitStatusLike[]): AvailabilityState {
  const total = units.length;
  const available = units.filter((u) => u.status === "available").length;
  return { total, available, soldOut: total > 0 && available === 0 };
}

// Same rule, for the card surfaces (listing card, presentation card) that
// already carry pre-counted available/total numbers rather than raw units.
export function soldOutFromCounts(available: number, total: number): boolean {
  return total > 0 && available <= 0;
}

// Pure availability — "Sold out" or "Available", never blended with
// construction stage. In Cyprus a project routinely sells out off-plan, long
// before construction even starts, so availability and stage are always
// shown as two independent facts (see resolveStageLabel below) — never one
// collapsed string. 2026-07-31: split out of the old resolveAvailabilityLabel,
// which returned a single string and silently dropped the stage entirely
// once a project sold out.
export function resolveAvailabilityStatusLabel(soldOut: boolean, lang: string = "en"): string {
  const t = developmentCopy(lang);
  return soldOut ? t.soldOut : t.unitStatus.available;
}

// Pure construction stage (Off-plan / Under Construction / Key-Ready / …) —
// resolved independently of soldOut, so it stays visible on a sold-out page
// (a project can be fully sold out and still mid-construction). Returns null
// only when there's genuinely no stage data to show, never because of
// availability.
export function resolveStageLabel(
  stage: string | null | undefined,
  status: string | null | undefined,
  lang: string = "en",
): string | null {
  const t = developmentCopy(lang);
  const raw = stage || status || "";
  if (!raw || raw.toLowerCase().includes("sold")) return null;
  // Canonical stage/status values (the admin dropdown + feed adapters only ever
  // produce these — see feeds.ts's STAGE_LABEL and the admin page's <select>)
  // map to a localized label; anything else (a free-typed custom value) is
  // shown as-is rather than guessed at.
  const key = raw.toLowerCase() as keyof typeof t.stage;
  return t.stage[key] ?? raw;
}

// Admin-facing warning: the stored stage/status claims sold-out, but live unit
// data proves units are still available. Only this direction warns — the
// reverse (all units sold but stage says something else) is handled silently
// by soldOut always winning on the public page, so there's nothing urgent
// for an admin to fix there.
export function availabilityContradiction(
  stage: string | null | undefined,
  status: string | null | undefined,
  soldOut: boolean,
  available: number,
): string | null {
  const stageClaimsSold = (stage || status || "").toLowerCase().includes("sold");
  if (stageClaimsSold && !soldOut) {
    return `Status says Sold Out but ${available} unit${available === 1 ? "" : "s"} available — check the data.`;
  }
  return null;
}
