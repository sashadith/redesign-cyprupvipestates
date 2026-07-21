// Single source of truth for "is this Development sold out" — computed from
// live DevelopmentUnit rows, never from the manually-set stage/status string.
//
// Bug this exists to prevent: Development.status/stage are feed-derived or
// admin-set strings (e.g. "Sold") that are never reconciled against actual
// unit availability once units are manually corrected (source: "manual") or
// a later sync re-asserts a stale feed value. Celestia (2026-07-17) showed a
// "SOLD OUT" badge while 2 of its 16 units were genuinely available, because
// the badge trusted `stage || status` instead of counting units. See
// resolveAvailabilityLabel/availabilityContradiction below for the fix.

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

// The manual stage/status field still controls the construction-stage label
// (Off-plan / Under Construction / Key-Ready / …) when the development is NOT
// sold out — but it never gets to claim "sold out" on its own, and if it does
// claim sold-out while units say otherwise, we fall back to a neutral label
// rather than surface the contradiction to visitors.
export function resolveAvailabilityLabel(
  stage: string | null | undefined,
  status: string | null | undefined,
  soldOut: boolean,
  lang: string = "en",
): string {
  const t = developmentCopy(lang);
  if (soldOut) return t.soldOut;
  const raw = stage || status || "";
  if (!raw || raw.toLowerCase().includes("sold")) return t.unitStatus.available;
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
// by resolveAvailabilityLabel/soldOut always winning on the public page, so
// there's nothing urgent for an admin to fix there.
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
