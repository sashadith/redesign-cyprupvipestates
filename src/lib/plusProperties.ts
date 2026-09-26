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
