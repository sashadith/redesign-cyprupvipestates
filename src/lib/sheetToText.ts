import * as XLSX from "xlsx";

// Spreadsheet → text for the AI price-list extractors (Drive and Dropbox).
//
// The one thing this does beyond a plain sheet_to_csv: it FILLS MERGED CELLS.
// SheetJS stores a merged range's value only in its anchor cell and leaves the
// rest of the range empty, which is invisible in a CSV. Developer price lists
// lean on merged cells for exactly the column a unit cannot be identified
// without — the block label.
//
// Olias' "Arbeo Park_Sales.xlsx" is the case that surfaced it: one table per
// block, each with its own header row, and the block name ("Block A", "Block
// B", …) in a merged cell in column B spanning that block's rows. Flattened
// without filling, the model sees the block once and then a column of blanks,
// so every unit comes through as a bare "101"/"201" — and those numbers repeat
// in all four blocks. The result was 12 feed units that matched none of the 28
// curated ones ("0 of 28 manual units matched to the feed") and sat alongside
// them as duplicates.
//
// Filling is deterministic and costs nothing at read time, which is why it is
// done here rather than asked of the model in the prompt.
function fillMerges(sheet: XLSX.WorkSheet): void {
  const merges = sheet["!merges"];
  if (!merges?.length) return;
  for (const m of merges) {
    // DOWN the anchor's own column only — never sideways.
    //
    // Sideways filling was the first version and it backfired: a banner or a
    // "Notes: …" paragraph merged across ten columns got copied into all ten,
    // so Arbeo Park's four notes rows became forty copies of a 230-character
    // paragraph — roughly 9,000 of the sheet's 22,000 characters were pure
    // repetition, and the extraction got WORSE, not better (12 units before,
    // 6 after).
    //
    // Nothing is lost by leaving a horizontal span alone: the value already
    // sits on that row, in the anchor cell. Only a MULTI-ROW span hides
    // information, because the rows below the anchor have no value of their
    // own — which is exactly the case that matters here, a block label beside
    // its rows. Single-row merges are therefore skipped entirely.
    if (m.s.r === m.e.r) continue;
    const anchor = sheet[XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c })];
    if (!anchor) continue;
    for (let r = m.s.r + 1; r <= m.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: m.s.c });
      const cur = sheet[addr];
      // Fill a cell that is missing OR present-but-blank. Both occur: a real
      // .xlsx omits the covered cells, but sheets round-tripped through other
      // tools carry them as empty strings, and testing only for absence
      // silently skips those.
      const blank = !cur || cur.v === undefined || cur.v === null || String(cur.v).trim() === "";
      if (blank) sheet[addr] = { ...anchor };
    }
  }
}

/** Every sheet of a workbook as "### <name>" + CSV, with merged ranges filled. */
export function workbookToText(buf: Buffer): string {
  const wb = XLSX.read(buf, { type: "buffer" });
  return wb.SheetNames.map((n) => {
    const sheet = wb.Sheets[n];
    fillMerges(sheet);
    return `### ${n}\n${XLSX.utils.sheet_to_csv(sheet)}`;
  }).join("\n");
}
