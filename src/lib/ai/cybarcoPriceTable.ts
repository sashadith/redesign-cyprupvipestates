import type { PdfRow, UnitStatus } from "./availabilityTable";

/* A price-list reader for Cybarco, self-contained on purpose.
   availabilityTable.ts (Korantina) and gvPriceTable.ts (G&V) read the same
   FAMILY of document — status printed as text inside the price column — but
   the one attempt to serve two developers from one engine, during the G&V
   build, produced three Korantina regressions that only a live dry-run caught:
   City Landmark 33 units to 1, Inner City 3 gaining a duplicate Development
   through a shifted table ordinal, Royal Bay 43 to 42. A third reader is
   cheaper than a fourth regression. Neither of the other two files is touched.

   Everything here was measured against five real Cybarco price lists captured
   on 2026-09-10 (scripts/qa/fixtures/cybarco/pl-*.json). */

/** All cells whose left edge falls in [x0, x1), joined left to right. */
export function joinColumn(row: PdfRow, x0: number, x1: number): string {
  return row.cells
    .filter((c) => c.x >= x0 && c.x < x1)
    .sort((a, b) => a.x - b.x)
    .map((c) => c.t.trim())
    .join("");
}

/* pdf.js splits a single printed price across several cells — "5", "60", ",",
   "0", "00" for 560,000 — so the input here is already the JOINED column, and
   the separators are whatever survived that join. Anything under four digits is
   refused: an area of 119 m² and a plot of 1035 m² sit in neighbouring columns,
   and reading one as a price is worse than reading nothing. */
export function cybarcoParsePrice(raw: string): number | null {
  const s = (raw || "").replace(/[€$£]/g, "").replace(/\s/g, "").trim();
  if (!s) return null;
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const digits = s.replace(/[.,]/g, "");
  if (!/^\d{4,9}$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Status vocabulary, English and Russian. Centro Limassol's linked list is
   Russian throughout; "ПЕРЕГОВОРЫ" (under negotiation) is treated as reserved
   because it is emphatically not a unit anyone can buy today, and reserved is
   its own status by operator decision (2026-09-10). */
const SOLD_RE = /^(SOLD(\s*OUT)?|ПРОДАНО)$/i;
const RESERVED_RE = /^(RESERVED|RESERVE|РЕЗЕРВ|ПЕРЕГОВОРЫ)$/i;

export function cybarcoReadOutcome(raw: string): { status: UnitStatus; price: number | null } | null {
  const s = (raw || "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (SOLD_RE.test(s)) return { status: "sold", price: null };
  if (RESERVED_RE.test(s)) return { status: "reserved", price: null };
  const price = cybarcoParsePrice(s);
  return price === null ? null : { status: "available", price };
}
