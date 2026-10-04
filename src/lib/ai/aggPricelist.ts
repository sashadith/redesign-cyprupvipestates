import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* AGG Luxury Homes price-list PDF → units (2026-08-28).

   AGG's price list is a PowerPoint export, NOT a table: each slide carries one-to-
   six unit "cards" laid out as side-by-side columns, one project per slide. There
   is no header row and no status column — a card names its own status ("Available",
   "Reserved", "Sold", "Under offer", "On hold") and, when for sale, a "Price:
   €NNN,NNN + VAT". So Korantina's table reconstruction (ai/availabilityTable.ts)
   does not apply; this parser rebuilds each CARD from pdf.js text positions.

   THE SAME DIVISION OF LABOUR AS availabilityTable.ts HOLDS: no unit VALUE comes
   from a model. Everything below — the price, the status, every area — is read in
   code from the text layer. The only fuzzy input is the list of project NAMES, and
   that comes from the REST API (aggSync passes it in), not from a model and not
   from a hard-coded page map, so a re-ordered or extended price list still keys
   every unit to the right project.

   Four layout facts drove the geometry, each measured against the real 53-page
   list before this was written:
     1. Units on a slide are a single horizontal row of columns; a value is
        assigned to the column whose [midpoint,midpoint) band contains its x — NOT
        the nearest unit id — because a right-aligned price sits closer to the next
        card's centre than to its own id (verified: Vasileon's 6-up slides).
     2. A label and its value share a baseline on most slides, but Vasileon wraps
        labels ("Covered" / "internal:") with the value drawn BETWEEN the two label
        lines — so a value finds its label by scanning left within a label-block
        height, not by reading order.
     3. A price amount, its "Price:" tag and "+ VAT" are three separate items in an
        unstable order; the price is the €-amount nearest the "Price:" tag, floored
        at €100k so an on-card "Furniture €25,000" extra can never be read as it.
     4. A unit id can be split across two items ("Penthouse" + "A401"); those are
        re-joined when a bare number sits just right of a kind word on one baseline.
     5. (2026-10-04) A single word can itself arrive as several runs that TOUCH —
        Vasileon C305's price on page 47 of "Projects Pricelist 021026 AF.pdf" is
        "€6" + "10" + ",000", each ending exactly where the next starts. No run is an
        amount on its own, so the card read as Available with no price. Runs on one
        baseline with no gap between them are glued back together before anything
        else looks at the page (mergeTouchingRuns). Measured over the whole list:
        every touching pair is within ±0.15pt, the narrowest real inter-word gap
        is 1.8pt. The same glue also fixed Kalamos Duo House 2's total area, drawn
        "11" + "0" and silently read as 11 m² instead of 110. */

export type AggUnit = {
  project: string; // price-list project name, e.g. "VASILEON SIGNATURE RESIDENCES"
  block: string; // "Block A" | "Plot 2" | ""
  floor: string; // "First Floor" | ""
  unit: string; // "APARTMENT A101" | "VILLA 2"
  ref: string; // stable per-project key: `${block} ${unit}`.trim() — the sync's feedRef
  label: string; // display label, e.g. "Block A · First Floor · APARTMENT A101"
  type: string; // "Apartment" | "Penthouse" | "Villa" | "House" | "Townhouse"
  beds: string; // "Studio" | "1" | "2" | …
  baths: string;
  guestWc: string; // "yes" | ""
  areaInternal: string; // m²
  areaBuilt: string; // total m²
  areaVeranda: string; // covered veranda m²
  areaVerandaOpen: string; // uncovered veranda m²
  areaPlot: string; // m²
  price: number | null; // EUR, +VAT
  status: "available" | "reserved" | "sold"; // normalised (see STATUS_MAP)
  rawStatus: string; // "Available" | "Reserved" | "Under offer" | "On hold" | "Sold" | ""
};

type Item = { x: number; y: number; w: number; t: string };
export type AggPage = { page: number; width: number; height: number; items: Item[] };
type Page = AggPage;

/* Two runs are one word when they share a baseline and the second starts where
   the first ends. Touching pairs measure within ±0.15pt, real word gaps ≥ 1.8pt
   ("12" / "of 31 Units)"), so 0.75pt sits well clear of both. */
const TOUCH_TOL = 0.75;
const BASELINE_TOL = 0.5;

/** Glue runs that touch on one baseline ("€6" + "10" + ",000" → "€610,000"). */
export function mergeTouchingRuns(items: Item[]): Item[] {
  const sorted = items.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  const out: Item[] = [];
  for (const it of sorted) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.y - it.y) <= BASELINE_TOL && it.w > 0 && prev.w > 0 && Math.abs(it.x - (prev.x + prev.w)) <= TOUCH_TOL) {
      out[out.length - 1] = { x: prev.x, y: prev.y, w: it.x + it.w - prev.x, t: prev.t + it.t };
    } else {
      out.push({ ...it });
    }
  }
  return out;
}

const WORKER_PATH = join(process.cwd(), "scripts", "agg-pricelist-worker.mjs");

/** Runs the isolated pdf.js worker (see scripts/agg-pricelist-worker.mjs). */
export async function readAggPages(buf: Buffer): Promise<Page[]> {
  const dir = await mkdtemp(join(tmpdir(), "aggpl-"));
  try {
    const src = join(dir, "in.pdf");
    await writeFile(src, buf);
    const json = await new Promise<string>((resolve, reject) => {
      const p = spawn(process.execPath, [WORKER_PATH, src]);
      let out = "", err = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (err += d));
      p.on("error", reject);
      p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`agg-pricelist-worker exit ${code}: ${err.slice(0, 500)}`))));
    });
    return JSON.parse(json) as Page[];
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const UNIT_RE = /^(APARTMENT|PENTHOUSE|VILLA|HOUSE|TOWNHOUSE)\s+([A-Z]?\d+)\b/i;
const KIND_RE = /^(APARTMENT|PENTHOUSE|VILLA|HOUSE|TOWNHOUSE)$/i;
const NUM_RE = /^([A-Z]?\d+)$/;
const PLOTVILLA_RE = /PLOT\s*(\d+)\s*\|\s*VILLA\s*(\d+)/i;
const FLOOR_RE = /\b(GROUND|FIRST|SECOND|THIRD|FOURTH)\s+FLOOR\b/i;
const AMT_RE = /€?\s?(\d{1,3}(?:,\d{3})+)/;
const STATUS_WORDS = ["Available", "Reserved", "Under offer", "On hold", "Sold"];
// Anything not for sale is hidden from the public availability count. AGG's four
// non-available words all fold to "reserved" except a firm "Sold".
const STATUS_MAP: Record<string, "available" | "reserved" | "sold"> = {
  available: "available",
  reserved: "reserved",
  "under offer": "reserved",
  "on hold": "reserved",
  sold: "sold",
};

const norm = (s: string) => (s || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isM2 = (t: string) => /^m2?²?$/i.test(t.trim());

/**
 * Pair each measurement value ("37 m2", or a bare "88" beside a label, or a split
 * "88" + "m2") with the label text to its left within a label-block height. Handles
 * both the side-by-side and the wrapped-label ("Covered" / "internal:") layouts.
 */
function labelledMeasures(fields: Item[]): { label: string; val: string }[] {
  const measures: { x: number; y: number; val: string }[] = [];
  for (const f of fields) {
    const m = /^(\d[\d.,]*)\s*m2?²?$/i.exec(f.t.trim());
    if (m) { measures.push({ x: f.x, y: f.y, val: m[1] }); continue; }
    if (/^\d[\d.,]*$/.test(f.t.trim())) {
      // A bare number is a measurement when a text label sits to its left on the
      // same baseline ("Total areas: … 88" with no "m2" item drawn).
      const hasLabelLeft = fields.some((o) => o !== f && Math.abs(o.y - f.y) < 5 && o.x < f.x && !/^\d/.test(o.t) && !isM2(o.t));
      if (hasLabelLeft) measures.push({ x: f.x, y: f.y, val: f.t.trim() });
    }
  }
  const labelText = (vx: number, vy: number) =>
    fields
      .filter((o) => o.x < vx - 2 && Math.abs(o.y - vy) <= 12 && !/^\d/.test(o.t) && !isM2(o.t))
      .sort((a, b) => b.y - a.y)
      .map((o) => o.t)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  return measures.map((me) => ({ label: labelText(me.x, me.y), val: me.val }));
}

/**
 * Parse the AGG price-list PDF into units.
 *
 * @param buf                 the raw PDF (from downloadAggPricelist)
 * @param knownProjectNames   project names to anchor detection on — pass the REST
 *                            titles (aggSync does). Case/spacing-insensitive; the
 *                            longest match on a slide wins, and a slide with no name
 *                            carries the previous one forward (continuation slides).
 */
export async function extractAggUnits(buf: Buffer, knownProjectNames: string[]): Promise<AggUnit[]> {
  return aggUnitsFromPages(await readAggPages(buf), knownProjectNames);
}

/** The pure half of extractAggUnits: worker page data → units. No PDF, no I/O —
 *  the QA check (scripts/qa/agg-pricelist-check.mjs) feeds it captured pages. */
export function aggUnitsFromPages(pages: Page[], knownProjectNames: string[]): AggUnit[] {
  // Longest first so "VASILEON SIGNATURE RESIDENCES" wins over a bare "VASILEON",
  // and an exact "KALAMOS DUO" is never shadowed by a portfolio "KALAMOS".
  const known = Array.from(new Set(knownProjectNames.map((n) => norm(n)).filter(Boolean))).sort((a, b) => b.length - a.length);
  const canonical = new Map(knownProjectNames.map((n) => [norm(n), n] as const));

  let carry: string | null = null;
  const rows: AggUnit[] = [];

  for (const raw of pages) {
    if (raw.page === 1) continue; // slide 1 is the index table, not unit cards
    const pg = { ...raw, items: mergeTouchingRuns(raw.items) };
    const pageText = " " + norm(pg.items.map((i) => i.t).join(" ")) + " ";
    let projN = known.find((k) => new RegExp("\\b" + escapeRe(k) + "\\b").test(pageText)) || null;
    if (projN) carry = projN; else projN = carry;
    if (!projN) continue;
    const project = canonical.get(projN) || projN;

    let pageBlock = "";
    for (const it of pg.items) {
      const m = /^Block\s+([A-Z])$/.exec(it.t) || /\(BLOCK\s+([A-Z])\)/i.exec(it.t);
      if (m) { pageBlock = `Block ${m[1].toUpperCase()}`; break; }
    }

    type U = { x: number; y: number; id: string; kind: string; plot: string; fields: Item[]; floor: string | null; status: string | null; price: number | null };
    const units: U[] = [];
    const pushUnit = (x: number, y: number, id: string, kind: string, plot = "") => {
      if (!units.some((u) => u.id === id && Math.abs(u.x - x) < 5))
        units.push({ x, y, id, kind, plot, fields: [], floor: null, status: null, price: null });
    };
    for (const it of pg.items) {
      const m = UNIT_RE.exec(it.t), pv = PLOTVILLA_RE.exec(it.t);
      if (m) pushUnit(it.x, it.y, `${m[1].toUpperCase()} ${m[2].toUpperCase()}`, m[1].toUpperCase());
      else if (pv) pushUnit(it.x, it.y, `VILLA ${pv[2]}`, "VILLA", `Plot ${pv[1]}`);
      else if (/^House\s+\d+/i.test(it.t)) { const mm = /^House\s+(\d+)/i.exec(it.t)!; pushUnit(it.x, it.y, `HOUSE ${mm[1]}`, "HOUSE"); }
      else if (KIND_RE.test(it.t)) {
        // split id: a kind word ("Penthouse") with its number ("A401") just to its right
        const numItem = pg.items.find((o) => Math.abs(o.y - it.y) < 4 && o.x > it.x && o.x - it.x < 70 && NUM_RE.test(o.t));
        if (numItem) pushUnit(it.x, it.y, `${it.t.toUpperCase()} ${numItem.t.toUpperCase()}`, it.t.toUpperCase());
      }
    }
    if (!units.length) continue;

    units.sort((a, b) => a.x - b.x);
    // column band = midpoints between adjacent unit-id x centres
    const bnd = units.map((u, i) => ({
      lo: i === 0 ? -1e9 : (units[i - 1].x + u.x) / 2,
      hi: i === units.length - 1 ? 1e9 : (u.x + units[i + 1].x) / 2,
    }));
    const colOf = (x: number) => bnd.findIndex((b) => x >= b.lo && x < b.hi);

    for (const it of pg.items) {
      const t = it.t;
      if (UNIT_RE.test(t) || PLOTVILLA_RE.test(t) || /^House\s+\d+/i.test(t)) continue;
      if (/^\(Available \d+ of \d+ Units\)$/.test(t) || /^Location/i.test(t) || /^Build Status/i.test(t) || /^The company reserves/i.test(t)) continue;
      const c = colOf(it.x);
      if (c < 0) continue;
      units[c].fields.push(it);
    }

    for (const u of units) {
      const ordered = u.fields.slice().sort((a, b) => b.y - a.y || a.x - b.x);
      const f = ordered.map((x) => x.t).join(" ");

      const fl = FLOOR_RE.exec(f);
      if (fl) u.floor = fl[0].replace(/\b\w/g, (c) => c.toUpperCase());

      for (const fld of u.fields) {
        const s = STATUS_WORDS.find((w) => w.toLowerCase() === fld.t.trim().toLowerCase());
        if (s) u.status = s;
      }

      // price: €-amount nearest the "Price:" tag, ≥ €100k (excludes on-card extras)
      const priceLabel = u.fields.find((x) => /^Price\b/i.test(x.t.trim()));
      const amts = u.fields
        .map((x) => { const m = AMT_RE.exec(x.t); return m ? { x: x.x, y: x.y, amt: parseInt(m[1].replace(/,/g, ""), 10) } : null; })
        .filter((a): a is { x: number; y: number; amt: number } => !!a && a.amt >= 100000);
      if (priceLabel && amts.length) {
        amts.sort((a, b) => Math.hypot(a.x - priceLabel.x, a.y - priceLabel.y) - Math.hypot(b.x - priceLabel.x, b.y - priceLabel.y));
        u.price = amts[0].amt;
      }

      const lm = labelledMeasures(u.fields);
      const pick = (re: RegExp) => lm.find((x) => re.test(x.label))?.val || "";
      const beds = /\bStudio\b/i.test(f) ? "Studio" : (/(\d+)\s*bedroom/i.exec(f)?.[1] || "");
      const baths = /(\d+)\s*bathroom/i.exec(f)?.[1] || "";

      let block = u.plot || "";
      const pref = /^[A-Z]+\s+([A-Z])\d/.exec(u.id); // Vasileon A101 / C301 → Block A / C
      if (pref) block = `Block ${pref[1]}`;
      else if (pageBlock) block = pageBlock;

      const rawStatus = u.status || "";
      // A card with an explicit word uses it. A card with a PRICE but no word is
      // implicitly for sale → "available". A card with NEITHER (AGG's not-yet-
      // released units, e.g. Vasileon Block C's upper floors — areas only, no price,
      // no status) is NOT defaulted to available, which would advertise an unreleased
      // home as buyable; it is held as "reserved" (hidden from the availability count,
      // never deleted) for a human to resolve on the draft.
      const status = STATUS_MAP[rawStatus.toLowerCase()] || (u.price ? "available" : "reserved");
      const ref = `${block} ${u.id}`.trim();
      const label = [block, u.floor, u.id].filter(Boolean).join(" · ");

      rows.push({
        project, block, floor: u.floor || "", unit: u.id, ref, label,
        type: u.kind.charAt(0) + u.kind.slice(1).toLowerCase(),
        beds, baths, guestWc: /guest\s*wc/i.test(f) ? "yes" : "",
        areaInternal: pick(/covered internal|living area/i),
        areaBuilt: pick(/total\s*(covered\s*)?area/i),
        areaVeranda: pick(/covered veranda/i),
        areaVerandaOpen: pick(/uncovered\s*(veranda|area)/i),
        areaPlot: pick(/^plot/i),
        price: u.price, status, rawStatus,
      });
    }
  }

  // Dedupe on the identity key (project + block + unit); a repeated unit number
  // across two blocks (Thea/Seasons) stays distinct because block is part of it.
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.project}|${r.block}|${r.unit}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * One note per project that has "available" units with NO price. That combination
 * is never legitimate in AGG's list (an unreleased card carries neither word nor
 * price and is held as "reserved" above), so it means the parser lost a price — as
 * it did for Vasileon C305 — and the sync is about to write price=null over a home
 * that is for sale. Surfaced in the sync result instead of passing silently.
 */
export function unpricedAvailableNotes(units: AggUnit[]): string[] {
  const byProject = new Map<string, string[]>();
  for (const u of units) {
    if (u.status !== "available" || typeof u.price === "number") continue;
    byProject.set(u.project, [...(byProject.get(u.project) ?? []), u.ref]);
  }
  return Array.from(byProject.entries()).map(
    ([project, refs]) =>
      `${project}: ${refs.length} unit(s) marked Available but no price read from the price list — written with price=null, check the PDF (${refs.join(", ")})`,
  );
}
