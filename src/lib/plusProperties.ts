import { parseStringPromise } from "xml2js";

/* Plus Properties price lists. The developer keeps one Excel workbook per
   project, saved as SpreadsheetML 2003 ("<?mso-application progid="Excel.Sheet"?>"),
   in a shared Drive folder. It reads like a feed and is not one: the layout is
   whatever a person made it that week. Everything that can silently turn it
   into wrong data is handled in this file, and each rule is argued in
   docs/superpowers/specs/2026-09-25-plus-properties-connector-design.md.

   This module is pure: bytes in, data out. No database, no network. */

export class PlusParseError extends Error {}

export type Cell = { col: number; value: string; colour: string | null; href: string | null };
export type Sheet = { name: string; hidden: boolean; active: boolean; rows: Cell[][] };

/* xml2js gives text as a string, an array, or an object with the text under
   "_" and child elements (rich-text runs) beside it. Flatten all of it. */
function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    let s = typeof o._ === "string" ? o._ : "";
    for (const k of Object.keys(o)) if (k !== "_" && k !== "$") s += textOf(o[k]);
    return s;
  }
  return String(node);
}

/* Raw SpreadsheetML, read through a real XML parser so entities are decoded
   ("Plus 67-68 &amp; 69" is the sheet "Plus 67-68 & 69"). Two things a generic
   spreadsheet library drops are kept on purpose: which sheet is active, and
   each cell's font colour — the developer hides the prices of sold units by
   colouring them white. */
export async function readWorkbook(xml: string): Promise<Sheet[]> {
  const doc = await parseStringPromise(xml, { explicitArray: true, trim: false });
  const wb = doc?.Workbook;
  if (!wb) throw new PlusParseError("not a SpreadsheetML workbook");
  const colour = new Map<string, string | null>();
  for (const st of wb.Styles?.[0]?.Style ?? []) {
    const id = st.$?.["ss:ID"];
    const c = st.Font?.[0]?.$?.["ss:Color"];
    if (id) colour.set(id, c ? String(c).toUpperCase() : null);
  }
  return (wb.Worksheet ?? []).map((ws: any): Sheet => {
    const opts = ws.WorksheetOptions?.[0] ?? {};
    const rows: Cell[][] = [];
    for (const r of ws.Table?.[0]?.Row ?? []) {
      const cells: Cell[] = [];
      let col = 0;
      for (const c of r.Cell ?? []) {
        const a = c.$ ?? {};
        if (a["ss:Index"]) col = Number(a["ss:Index"]) - 1;
        cells.push({
          col,
          value: textOf(c.Data).replace(/\s+/g, " ").trim(),
          colour: colour.get(a["ss:StyleID"]) ?? null,
          href: a["ss:HRef"] ?? null,
        });
        col += 1 + Number(a["ss:MergeAcross"] ?? 0);
      }
      rows.push(cells);
    }
    return {
      name: ws.$?.["ss:Name"] ?? "",
      hidden: /hidden/i.test(textOf(opts.Visible)),
      active: opts.Selected !== undefined,
      rows,
    };
  });
}

/* The current list is the ACTIVE sheet — the one Excel prints, and so the one
   the developer's PDF shows. Measured 2026-09-25: all 32 workbooks have exactly
   one, never hidden. Visibility alone is not enough: Plus 87 keeps two stale
   snapshots visible, with every unit still "Available". A workbook with a
   single sheet and no flag uses that sheet; anything else ambiguous fails this
   one project, loudly, rather than guessing which list is true. */
export function activeSheet(sheets: Sheet[]): Sheet {
  const visible = sheets.filter((s) => !s.hidden);
  const active = visible.filter((s) => s.active);
  if (active.length === 1) return active[0];
  if (active.length === 0 && sheets.length === 1 && visible.length === 1) return visible[0];
  throw new PlusParseError(`expected exactly one active sheet, found ${active.length} of ${sheets.length}`);
}

export type Field =
  | "block" | "floor" | "unit" | "beds" | "baths" | "parking" | "storage"
  | "internal" | "veranda" | "verandaOpen" | "roof" | "garden" | "common" | "total" | "plot"
  | "price" | "priceOld" | "status" | "ignore";

/* About 60 header spellings for about 15 concepts, measured across all 32
   workbooks. ORDER MATTERS: "Price €/OLD" must be caught before plain price
   (a sold villa often has only its OLD price filled), optional extras before
   the area they name, roof before garden/storage ("Roof Garden", "Roof Storage
   and Bathroom"), and "uncovered" before "covered". null means unknown: the
   caller reports it and ignores the column — a new header is never guessed.

   The bedroom/bathroom count rules are anchored to the start of the header
   ("Nbr of Bedrooms", "Number of Bathrooms", "Nbr. of Bedrooms") rather than
   reordered ahead of the /roof/ rule below: an unanchored /bedroom/ or
   /bathroom/ test would match before /roof/ ever runs, so "Roof Storage and
   Bathroom (sqm)" would wrongly map to "baths" instead of "roof". Anchoring
   keeps every other rule, and its order, exactly as measured. */
export function columnField(header: string): Field | null {
  const h = header.replace(/\s+/g, " ").trim().toLowerCase();
  if (!h) return null;
  if (/optional|extra cost/.test(h)) return "ignore";
  if (/^price/.test(h)) return /old/.test(h) ? "priceOld" : "price";
  if (/^availab/.test(h)) return "status";
  if (/^(unit|villa no\.?)$/.test(h)) return "unit";
  if (h === "floor") return "floor";
  if (/^(block|blocks|project)$/.test(h)) return "block";
  if (/^(nbr\.?|number) of bedrooms/.test(h)) return "beds";
  if (/^(nbr\.?|number) of bathrooms/.test(h)) return "baths";
  if (/downpayment|kitch|nbr of units|number of units/.test(h)) return "ignore";
  if (/plot/.test(h)) return "plot";
  if (/total area/.test(h)) return "total";
  if (/common area/.test(h)) return "common";
  if (/^uncovered veranda/.test(h)) return "verandaOpen";
  if (/roof/.test(h)) return "roof";
  if (/parking/.test(h)) return "parking";
  if (/storage|^stores?$/.test(h)) return "storage";
  if (/garden|planter/.test(h)) return "garden";
  if (/uncovered|balcony/.test(h)) return "verandaOpen";
  if (/veranda|terrace/.test(h)) return "veranda";
  if (/internal|closed area/.test(h)) return "internal";
  return null;
}

export type PlusStatus = "available" | "reserved" | "sold";
export type PlusStage = "Under Construction" | "Off Plan" | "Completed";

export type PlusUnit = {
  ref: string; label: string; block: string | null; floor: string | null;
  beds: string | null; baths: string | null; parking: string | null; storage: string | null;
  areaBuilt: number | null; areaVeranda: number | null; areaVerandaOpen: number | null;
  areaRoof: number | null; areaGarden: number | null; areaCommon: number | null;
  areaTotal: number | null; areaPlot: number | null;
  status: PlusStatus; price: number | null;
};

export type PlusProject = {
  sheetName: string; title: string | null; version: string | null; listDate: string | null;
  stage: PlusStage | null; location: string | null; mapsUrl: string | null; websiteUrl: string | null;
  vatExcluded: boolean; units: PlusUnit[]; notes: string[];
};

/* The unit vocabulary is closed — measured: Available, Reserved, Sold, with
   trailing spaces. Anything else fails the project it appears in rather than
   being mapped to a guess (Cybarco, 2026-09-24: one new mark was the only
   thing between a sold-out project and "on sale" again). */
export function parseStatus(raw: string): PlusStatus {
  const s = raw.trim().toLowerCase();
  if (s === "available") return "available";
  if (s === "reserved") return "reserved";
  if (s === "sold") return "sold";
  throw new PlusParseError(`unknown unit status "${raw}"`);
}

/* `stage` is free text across the system; each state maps to its most common
   existing spelling (measured 2026-09-25). "Understudy" is how this developer
   says a project is not yet under construction. */
export function projectStage(raw: string | null): PlusStage | null {
  if (raw == null || !raw.trim()) return null;
  const s = raw.toLowerCase().replace(/[-\s]+/g, " ").trim();
  if (s === "under construction") return "Under Construction";
  if (s === "understudy" || s === "under study") return "Off Plan";
  if (s === "ready to move in") return "Completed";
  throw new PlusParseError(`unknown project status "${raw}"`);
}

export function cleanNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const m = String(raw).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Math.round(Number(m[0]) * 100) / 100;
  return Number.isFinite(n) ? n : null;
}

/* "4 ( 3+1)", "3(2+1)", "2 (1+1)": the total, then how it splits (main floor +
   roof room, main house + guest house). Every reader of `beds` takes the FIRST
   number, so the total leads and the split is kept only for the eye. */
export function cleanBeds(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).replace(/\s+/g, "");
  const split = s.match(/^(\d+)\((\d+(?:\+\d+)+)\)$/);
  if (split) return `${split[1]} (${split[2]})`;
  const n = s.match(/^(\d+)(?:\.0+)?$/);
  if (n) return n[1];
  return String(raw).trim();
}

export function cleanText(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).replace(/\s+/g, " ").trim();
  if (!s) return null;
  return /^-?\d+(?:\.\d+)?$/.test(s) ? String(cleanNumber(s)) : s;
}

const WHITE = "#FFFFFF";
const FOOTER_LABEL = /:\s*$/;
/* A styled but empty cell is still a <Cell>; the first cell that says
   something is what a row "starts with". */
const firstFilled = (r: Cell[]) => r.find((c) => c.value) ?? null;

/* Title, version, list date and the "Label:" rows under the table. Read from
   the whole sheet: House Kiti has no table, the same footer. The value sits in
   the next filled cell — column 1 in most lists, column 2 in Plus 57/60/75. */
function readMeta(rows: Cell[][]) {
  const cells = rows.flat();
  const footer = new Map<string, string>();
  for (const r of rows) {
    const first = firstFilled(r);
    if (!first || !FOOTER_LABEL.test(first.value)) continue;
    const next = r.find((c) => c.col > first.col && (c.value || c.href));
    footer.set(first.value.replace(/\s+/g, " ").trim().toLowerCase(), (next?.href || next?.value || "").trim());
  }
  const version = cells.map((c) => c.value.match(/Version:\s*([\d.]+)/i)?.[1]).find(Boolean) ?? null;
  const listDate = cells.map((c) => c.value.match(/^(\d{4}-\d\d-\d\d)T/)?.[1]).find(Boolean) ?? null;
  return {
    version, listDate,
    stage: projectStage(footer.get("project status:") ?? null),
    location: footer.get("location:") || null,
    mapsUrl: footer.get("google maps:") || null,
    websiteUrl: footer.get("link on website:") || null,
    price: cleanNumber(footer.get("price:") ?? null),
    vatExcluded: cells.some((c) => /do not include the vat|excluding vat|\+\s?vat/i.test(c.value)),
  };
}

function headerIndex(rows: Cell[][]): number {
  return rows.findIndex((r) => {
    const f = r.map((c) => columnField(c.value));
    return f.includes("unit") && (f.includes("status") || f.includes("price"));
  });
}

const normBlock = (s: string) => s.replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").trim();

/* An area is the SUM of every column mapped to it, not the first one: Plus 63
   has both "Uncovered Veranda (sqm)" and "Uncovered Terrace (sqm)", and both
   are open-air area of the same unit. Text fields (floor, block, beds, …) still
   read the first matching cell. null when no mapped cell has a number. */
function sumArea(row: Cell[], field: Map<number, Field>, f: Field): number | null {
  let sum: number | null = null;
  for (const c of row) {
    if (field.get(c.col) !== f || !c.value) continue;
    const n = cleanNumber(c.value);
    if (n != null) sum = Math.round(((sum ?? 0) + n) * 100) / 100;
  }
  return sum;
}

/* A price is read only for an available unit, only from the "price" column
   (never "Price €/OLD"), and never when the cell is white — that is how the
   developer hides the price of a unit that has sold. Measured: 36 white prices,
   all on sold (21) or reserved (15) units. */
function priceOf(cell: Cell | null, status: PlusStatus): number | null {
  if (status !== "available" || !cell || cell.colour === WHITE) return null;
  const n = cleanNumber(cell.value);
  return n != null && n >= 1000 ? n : null;
}

const STOREY = /^(lower|upper|ground|first|second|1st|2nd)\s+floor$/i;

const sumNum = (a: number | null, b: number | null) => (a == null ? b : b == null ? a : Math.round((a + b) * 100) / 100);
const sumCount = (a: string | null, b: string | null) => {
  const n = (s: string | null) => (s && /^\d+$/.test(s) ? Number(s) : null);
  if (n(a) == null && n(b) == null) return a ?? b;
  return String((n(a) ?? 0) + (n(b) ?? 0));
};

/* A villa's second storey continues the unit the first storey opened: counts
   and areas add up, nothing else changes (status and price live on the first
   row). Measured on Plus 75, 2026-09-25. Plus 59's "Shop 1 Mezzanine" row
   continues "Shop 1" the same way. */
function addStorey(u: PlusUnit, s: PlusUnit): void {
  u.beds = sumCount(u.beds, s.beds);
  u.baths = sumCount(u.baths, s.baths);
  u.areaBuilt = sumNum(u.areaBuilt, s.areaBuilt);
  u.areaVeranda = sumNum(u.areaVeranda, s.areaVeranda);
  u.areaVerandaOpen = sumNum(u.areaVerandaOpen, s.areaVerandaOpen);
  u.areaRoof = sumNum(u.areaRoof, s.areaRoof);
  u.areaGarden = sumNum(u.areaGarden, s.areaGarden);
  u.areaTotal = sumNum(u.areaTotal, s.areaTotal);
}

/* House Kiti: label/value pairs laid out in column pairs (0/1, 3/4, 6/7, 9/10)
   for the main house, guest house and services. Areas carry "SQM"; a bare
   number beside an area label is a count and is not read as an area. Bedrooms
   and bathrooms are totalled over both buildings with the split kept, main house
   first ("5 (3+2)"), the same shape cleanBeds gives a table row. */
function parseHouse(rows: Cell[][], price: number | null): PlusUnit | null {
  if (price == null) return null;
  const pairs: { col: number; label: string; value: string }[] = [];
  for (const r of rows) for (const c of r) {
    const next = r.find((d) => d.col === c.col + 1);
    if (next && c.value && !FOOTER_LABEL.test(c.value)) pairs.push({ col: c.col, label: c.value.toLowerCase(), value: next.value });
  }
  const area = (re: RegExp) => pairs.filter((p) => re.test(p.label) && /sqm/i.test(p.value))
    .reduce<number | null>((s, p) => sumNum(s, cleanNumber(p.value)), null);
  const perBuilding = (re: RegExp) => {
    const parts = pairs.filter((p) => re.test(p.label)).sort((a, b) => a.col - b.col)
      .map((p) => cleanNumber(p.value)).filter((n): n is number => n != null);
    if (!parts.length) return null;
    const total = parts.reduce((a, b) => a + b, 0);
    return parts.length > 1 ? `${total} (${parts.join("+")})` : String(total);
  };
  return {
    ref: "House", label: "House", block: null, floor: null,
    beds: perBuilding(/number of bedrooms/), baths: perBuilding(/number of bathrooms/),
    parking: pairs.find((p) => /parking/.test(p.label))?.value ?? null,
    storage: pairs.find((p) => /storage/.test(p.label))?.value ?? null,
    areaBuilt: area(/^internal area$/), areaVeranda: area(/^covered veranda$/),
    areaVerandaOpen: area(/^uncovered (terrace|veranda)$/), areaRoof: null,
    areaGarden: area(/garden/), areaCommon: null, areaTotal: null, areaPlot: area(/^plot area$/),
    status: "available", price,
  };
}

export async function parsePriceList(xml: string): Promise<PlusProject> {
  const sheet = activeSheet(await readWorkbook(xml));
  const rows = sheet.rows;
  const meta = readMeta(rows);
  const notes: string[] = [];
  if (!meta.vatExcluded) notes.push("the list does not say prices exclude VAT");
  const title = rows.slice(0, 6).flat().map((c) => c.value)
    .find((v) => v && !/version:/i.test(v) && !/^\d{4}-\d\d-\d\d/.test(v)) ?? null;
  const base = { sheetName: sheet.name, title, version: meta.version, listDate: meta.listDate, stage: meta.stage,
    location: meta.location, mapsUrl: meta.mapsUrl, websiteUrl: meta.websiteUrl, vatExcluded: meta.vatExcluded };

  const hi = headerIndex(rows);
  if (hi < 0) {
    const house = parseHouse(rows, meta.price);
    if (!house) throw new PlusParseError(`no unit table on sheet "${sheet.name}"`);
    return { ...base, units: [house], notes: [...notes, "single-house layout; status assumed available (the sheet has no status word)"] };
  }
  const field = new Map<number, Field>();
  for (const c of rows[hi]) {
    const f = columnField(c.value);
    if (f) field.set(c.col, f);
    else if (c.value) notes.push(`unknown column "${c.value}" ignored`);
  }
  /* Plus 60: a second header row labels sub-columns under one heading
     (Gr.Floor / 1st Floor / 2nd Floor / Total Area under "Internal Area").
     The unit's interior is that sub-row's Total; the storey columns are not
     read. */
  let start = hi + 1;
  const sub = (rows[start] ?? []).filter((c) => c.value);
  if (sub.length >= 2 && sub.every((c) => /floor|total area/i.test(c.value))) {
    for (const c of sub) field.set(c.col, "ignore");
    const total = sub.find((c) => /total area/i.test(c.value));
    if (total) field.set(total.col, "internal");
    start++;
  }

  const units: PlusUnit[] = [];
  let block: string | null = null;
  let floor: string | null = null;
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    const lead = firstFilled(r);
    if (!lead) continue;
    if (FOOTER_LABEL.test(lead.value)) break;
    /* "NB: Prices mentioned above…" — Plus 60 writes its notes in the unit
       column; they are not units. */
    if (/^NB\s*:/i.test(lead.value)) continue;
    const cell = (f: Field) => r.find((c) => field.get(c.col) === f) ?? null;
    const val = (f: Field) => cell(f)?.value || null;
    const area = (f: Field) => sumArea(r, field, f);
    if (val("block")) block = normBlock(val("block")!);
    /* This row's counts and areas, laid over unit `u` — what addStorey adds
       when the row continues a unit instead of opening one. */
    const storey = (u: PlusUnit): PlusUnit => ({
      ...u, beds: cleanBeds(val("beds")), baths: cleanBeds(val("baths")),
      areaBuilt: area("internal"), areaVeranda: area("veranda"),
      areaVerandaOpen: area("verandaOpen"), areaRoof: area("roof"),
      areaGarden: area("garden"), areaTotal: area("total"),
    });
    const unitVal = val("unit");
    /* Plus 75's villas swap two columns: the villa's NAME sits in the Floor
       column and the STOREY in the Unit column. The first storey opens the
       villa (name, status, price live there); a following storey row with no
       name continues it. */
    if (unitVal && STOREY.test(unitVal)) {
      const villaName = val("floor");
      const last = units[units.length - 1];
      if (villaName) {
        const statusRaw = val("status");
        if (!statusRaw) { notes.push(`villa ${villaName} has no status — skipped`); continue; }
        const status = parseStatus(statusRaw);
        units.push({
          ref: block ? `${block} ${villaName}` : villaName, label: villaName, block, floor: null,
          beds: cleanBeds(val("beds")), baths: cleanBeds(val("baths")),
          parking: cleanText(val("parking")), storage: cleanText(val("storage")),
          areaBuilt: area("internal"), areaVeranda: area("veranda"),
          areaVerandaOpen: area("verandaOpen"), areaRoof: area("roof"),
          areaGarden: area("garden"), areaCommon: area("common"),
          areaTotal: area("total"), areaPlot: area("plot"),
          status, price: priceOf(cell("price"), status),
        });
      } else if (last && last.floor === null) {
        addStorey(last, storey(last));
      }
      continue;
    }
    if (val("floor")) floor = val("floor");
    const name = unitVal;
    if (!name) continue;
    const statusRaw = val("status");
    if (!statusRaw) {
      /* Plus 59: "Shop 1 Mezzanine", with no status, right after "Shop 1" is
         the shop's upper level, not a unit — its areas belong to the shop
         (the PDF's total of 188.75 counts both). */
      const last = units[units.length - 1];
      if (last && name.startsWith(`${last.label} `)) { addStorey(last, storey(last)); continue; }
      notes.push(`unit ${name} has no status — skipped`);
      continue;
    }
    const status = parseStatus(statusRaw);
    units.push({
      ref: block ? `${block} ${name}` : name, label: name, block, floor,
      beds: cleanBeds(val("beds")), baths: cleanBeds(val("baths")),
      parking: cleanText(val("parking")), storage: cleanText(val("storage")),
      areaBuilt: area("internal"), areaVeranda: area("veranda"),
      areaVerandaOpen: area("verandaOpen"), areaRoof: area("roof"),
      areaGarden: area("garden"), areaCommon: area("common"),
      areaTotal: area("total"), areaPlot: area("plot"),
      status, price: priceOf(cell("price"), status),
    });
  }
  return { ...base, units, notes };
}
