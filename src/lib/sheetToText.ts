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
    const anchor = sheet[XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c })];
    if (!anchor) continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cur = sheet[addr];
        // Fill a cell that is missing OR present-but-blank. Both occur: a real
        // .xlsx usually omits the covered cells entirely, but a sheet built or
        // round-tripped by other tools can carry them as empty strings, and
        // testing only for absence silently skips those.
        const blank = !cur || cur.v === undefined || cur.v === null || String(cur.v).trim() === "";
        if (blank) sheet[addr] = { ...anchor };
      }
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
