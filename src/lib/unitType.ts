// One vocabulary for DevelopmentUnit.type (operator, 2026-10-20). The feeds
// spoke 30 dialects — "Villas", "villa", "Villas / Houses", "apartment",
// "Apartments / Penthouses", empty strings, a block letter ("B") — so the same
// home was filed under several words and some under none. Every unit write goes
// through canonicalUnitType() (see the middleware in ./prisma.ts), whichever
// sync or admin screen it comes from, so a feed cannot bring the old spellings
// back on its next run.
//
// The canonical words. The /projects filter and the admin matcher are built on
// these; see matchesPropertyTypeFilter (developmentCard.ts) and normalizeType
// (crm/matching.ts).
export const UNIT_TYPES = ["Apartment", "Penthouse", "Studio", "Maisonette", "Duplex", "Villa", "Townhouse", "Office", "Shop", "Commercial", "Hotel"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export type UnitTypeVerdict =
  /** A real type: write it. */
  | { kind: "type"; type: string }
  /** Nothing usable (empty, a block letter, "Building"): never overwrite a stored type with it. */
  | { kind: "none" }
  /** A feed category that does not say which of two types this unit is
      ("Apartments / Penthouses"): keep a stored type (an admin may have marked
      the penthouses), and fall back to `fallback` for a new unit. */
  | { kind: "ambiguous"; fallback: string };

const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w));

/** The canonical type for a raw feed/admin value. `label`/`name` are the
    unit's own display names: a unit called "Penthouse 301" is a penthouse
    whatever its feed category says (Medousa files those as "apartment"). */
export function canonicalUnitType(raw: string | null | undefined, unit: { label?: string | null; name?: string | null } = {}): UnitTypeVerdict {
  const s = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const names = `${unit.label ?? ""} ${unit.name ?? ""}`.toLowerCase();
  const namedPenthouse = /\bpenthouse\b/.test(names);

  if (s === "apartments / penthouses") return namedPenthouse ? { kind: "type", type: "Penthouse" } : { kind: "ambiguous", fallback: "Apartment" };
  if (!s || /^[a-z]$/.test(s) || s === "building") return namedPenthouse ? { kind: "type", type: "Penthouse" } : { kind: "none" };

  if (has(s, "penthouse")) return { kind: "type", type: "Penthouse" };
  // Commercial before shop/office: "Shops / Commercial Buildings" and
  // "Commercial and Residential Building" are mixed commercial stock.
  if (has(s, "commercial")) return { kind: "type", type: "Commercial" };
  if (has(s, "hotel")) return { kind: "type", type: "Hotel" };
  if (has(s, "office")) return { kind: "type", type: "Office" };
  if (has(s, "shop", "retail")) return { kind: "type", type: "Shop" };
  if (has(s, "studio", "suite")) return { kind: "type", type: "Studio" };
  // Townhouse family before villa: "Terraced House" contains "house".
  if (has(s, "townhouse", "town house", "semi-detached", "semi detached", "terraced")) return { kind: "type", type: "Townhouse" };
  if (has(s, "maisonette")) return { kind: "type", type: "Maisonette" };
  if (has(s, "duplex")) return { kind: "type", type: "Duplex" };
  if (has(s, "apartment", "flat")) return { kind: "type", type: namedPenthouse ? "Penthouse" : "Apartment" };
  if (has(s, "villa", "bungalow", "house")) return { kind: "type", type: "Villa" };

  // A word we have not met yet: keep the developer's word, tidied, so it shows
  // up in the type list (and in tests) instead of being guessed into another.
  const t = (raw ?? "").trim().replace(/\s+/g, " ");
  return { kind: "type", type: t.charAt(0).toUpperCase() + t.slice(1) };
}

/** The most common canonical type among a project's other units — the fallback
    for a NEW unit whose feed row carries no usable type. Null when there is none. */
export function dominantType(types: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const t of types) {
    const v = canonicalUnitType(t);
    if (v.kind === "type") counts.set(v.type, (counts.get(v.type) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [t, c] of Array.from(counts.entries())) if (c > n) { best = t; n = c; }
  return best;
}

type Row = Record<string, unknown>;

/** Applies the vocabulary to one create payload. `fallbackFor` is asked only
    when the row's own type is unusable. */
export async function normalizeCreateRow(row: Row, fallbackFor: (developmentId: string) => Promise<string | null>): Promise<void> {
  if (!("type" in row)) return;
  const v = canonicalUnitType(row.type as string | null, { label: row.label as string | null, name: row.name as string | null });
  if (v.kind === "type") { row.type = v.type; return; }
  const dev = typeof row.developmentId === "string" ? row.developmentId : null;
  const fallback = dev ? await fallbackFor(dev) : null;
  row.type = fallback ?? (v.kind === "ambiguous" ? v.fallback : null);
}

/** Applies the vocabulary to one update payload: an unusable or ambiguous value
    is dropped, so the stored type stays. */
export function normalizeUpdateRow(row: Row): void {
  if (!("type" in row)) return;
  const raw = row.type;
  const value = raw && typeof raw === "object" && "set" in (raw as Row) ? (raw as Row).set : raw;
  const v = canonicalUnitType(value as string | null, { label: row.label as string | null, name: row.name as string | null });
  if (v.kind === "type") row.type = v.type;
  else delete row.type;
}
