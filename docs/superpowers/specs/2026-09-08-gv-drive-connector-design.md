# G&V Developers — Drive connector

**Date:** 2026-09-08
**Status:** approved, not yet implemented

## The shape of the problem

G&V ships **one PDF price list per project folder** in a shared Google Drive
folder, with the sold/reserved status printed as text inside the price column.

That combination is the one the Drive sync does not currently accept. The
per-project folder scan passes `spreadsheetsOnly` to `findPriceFile()` on
purpose — its comment says a PDF there "would be read as a plain spreadsheet and
lose every sold/reserved marker", so it reports "no price list" instead. Run
against G&V's folders today, that is exactly what happens.

So this is not a new connector. It is one missing capability in the existing
Drive connector, plus the table-engine work to read G&V's actual layouts.

## What already exists, and what fits

`src/lib/driveAvailabilitySync.ts` (883 lines) already does everything else G&V
needs: folder scanning, per-project price files, media, floor plans (rasterising
PDFs), amenities, a generated four-language description, a dry-run preview
(`previewDriveFolders`), and `syncAllDrives`, which honours `driveSyncInterval`.
No new sync module and no new cron route are required.

There are two PDF price-list readers in the codebase. Picking the right one
matters:

| Reader | Built for | Status from | Fits G&V? |
| --- | --- | --- | --- |
| `ai/pdfPricelistExtract.ts` | Motive Point: **one** PDF covering many projects, ALL-CAPS section headers | text **colour** — grey vs black; anything not unambiguously black is **dropped** | **No.** G&V prints prices *and* `SOLD`/`RESERVED` in red, so nearly every unit would be discarded — and G&V has one PDF per project, not per developer. |
| `ai/availabilityTable.ts` | Korantina and AGG | text in the price column — `readOutcome()` already returns `sold` / `reserved` / price | **Yes.** Same status-in-the-price-column shape G&V uses. |

## What the Drive folder holds

Root: `1VQEg9Nue9YiTErIb2zYYSnKbqWyd-qno`. Five project folders, plus two the
operator excluded: **`Custom Options`** and **`Drone Videos of SOLD projects`**.

| Folder | Units | Price-list file | Other content |
| --- | --- | --- | --- |
| Alta Mare Phase I | 8 | `Alta Mare (Phase I) Price List.pdf` | booklet, 2 brochures, `Floor Plans/` |
| Tsada Panorama Phase D | 7 | `Price List` | `Architectural Plans/`, `MASTER PLAN.pdf`, brochure, `Drone Videos /` |
| Georgia 12 (A&B) – Geroskipou | 9 | `PRICE LIST.pdf` | `Brochure.pdf` |
| Georgia Residences 2 – Peyia | 2 | `Price List GR2.pdf` | — |
| Tsada Panorama Superior Villa | 1 | `price list superior villa.pdf` | brochure (PDF + PPTX), `Renderings /`, `Interior Renderings/` |

`PRICE_NAME_RE` matches all five names — including the extensionless
`Price List` — and matches neither `Brochure.pdf` nor `MASTER PLAN.pdf`. Checked
against the real names, not assumed.

Two folder names carry a **trailing space** (`Renderings `, `Drone Videos `).

### Column sets vary per project; the vocabulary does not

| Project | Columns |
| --- | --- |
| Alta Mare, Tsada D | No., Bedrooms, Bathrooms, Land m², Covered Area m², Covered Veranda m², Price |
| Georgia 12 | + Internal Area, Storage (YES/NO), Covered parking (YES/NO) |
| Georgia Residences 2 | + Price (VAT 5%), printed on page 2 |
| Superior Villa | **no No. column**; + Lift, Swimming pool (`4*12`), Uncovered Veranda |

Headers are always English and always use the same words; only the selection
changes. That is what `mapTableColumns` is for.

## Measured: the engine does not read these files today

`extractPdfTables` run against the four real PDFs, 2026-09-08. Every engine
change below rests on one of these observations:

| File | Result |
| --- | --- |
| Georgia 12 | **0 tables** |
| Superior Villa | **0 tables** |
| Alta Mare | 1 table, **3 of 8 units** — the five priced rows were absorbed into the header (`"Price € 580,000.00"`) |
| Georgia Residences 2 | 1 table, header mixed with the page title and phantom columns; the `SWIMMING POOL EXTRA` line admitted as a unit |

```
parsePrice("580,000.00") → null      parsePrice("290,000.00") → null
parsePrice("1.95M")      → null      parsePrice("415,000")    → 415000
readOutcome("SHOW HOUSE")→ null
```

`parsePrice` refuses anything but Korantina's grouped form deliberately — its
comment says so. G&V writes `580,000.00`, so nearly every G&V price is lost.

## Decisions

1. **Extend the shared engine rather than write a second one.** The failures are
   not G&V quirks: a price split across two text runs, a single-row table, cents
   in a price. Two half-correct table parsers is the worse end state.
2. **The regression net goes in first.** `availabilityTable.ts` is load-bearing
   for **two live developers** — Korantina (18 projects, via
   `sharepointAvailabilitySync.ts`) and AGG (12, via `aggPricelist.ts`).
   `scripts/qa/availability-table-check.mjs` exists in the working tree with ~47
   assertions and **passes in full today**, but is not committed. Commit it
   unchanged first; re-run it after every engine change.
3. **`SHOW HOUSE` maps to `reserved`** — the unit exists but cannot be bought.
4. **The VAT column is ignored.** Georgia Residences 2 prints `Price (VAT 5%)`
   on page 2 at the same y coordinates as page 1's rows. Joining columns across
   pages is real risk for a value we do not need.
5. **Weekly sync**, honoured by `syncAllDrives` via `driveSyncInterval`.
6. **Column mapping stays with the model**, as for Korantina. It only ever
   labels columns; values are read geometrically and `validateMapping()`
   overrides it deterministically.
7. **Reader choice is explicit, not sniffed.** A code-level map keyed by
   developer slug picks the textual-status reader for G&V, the way `DEV_ACCOUNT`
   already keys per-developer behaviour in `feedSync.ts`. No schema change, and
   no run-time guess about which reader a document wants.

## Work items

**A. `findPriceFile()` / the per-project scan.** Allow a named PDF for
developers configured for the textual reader, instead of the blanket
`spreadsheetsOnly` refusal. Motive Point's and the spreadsheet developers'
behaviour must not change.

**B. New thin adapter** (`src/lib/ai/pdfTablePricelist.ts`): PDF buffer →
`extractPdfTables` → `mapTableColumns` → `unitsFromTable` → the same
`ExtractedPricelistProject` / `ExtractedUnit` shape the rest of
`driveAvailabilitySync` already consumes. This is the seam; it holds no table
logic of its own.

**C. Engine changes in `availabilityTable.ts`**, each tied to its evidence:

| Change | Fixes |
| --- | --- |
| `parsePrice` accepts a grouped amount with 2 decimals (`580,000.00`) and the `1.95M` shorthand | nearly every G&V price |
| `readOutcome` recognises `SHOW HOUSE` → `reserved` | Alta Mare unit 7 |
| Header/first-row separation: a priced first row must not be absorbed into the header band | Alta Mare losing 5 of 8 |
| Recognise single-row tables, and tables with no `No.` column | Superior Villa, Georgia 12 → 0 tables |
| Reject trailing non-unit rows (`SWIMMING POOL EXTRA`, `OPTIONAL EXTRAS`, `INCLUDED IN PRICE`) | GR2 admitting one |

Ambiguity that `parsePrice` refuses today stays refused: the new forms are
recognised by explicit shape, and anything still ambiguous returns `null`.

**Unit refs when there is no `No.` column.** Superior Villa is one villa with no
number. `validateMapping` currently forces *some* column to be the ref, which
would make the bedroom count the ref. For a single-row table with no numbering
column the ref must instead be derived from the project name, and this needs its
own fixture — it is the one case where the existing fallback produces a wrong
answer rather than no answer.

**D. `DeveloperAccount` row** — `G&V (drive)`, `driveFolderUrl` set to the root
folder, `driveSyncInterval: "weekly"`, and the two excluded folder names honoured
by the folder scan.

## Projects and media

Five folders become five `Development` rows. Four match existing published legacy
`Project` pages:

| Drive folder | Existing page |
| --- | --- |
| Alta Mare Phase I | `/alta-mare-gv` |
| Georgia Residences 2 | `/georgia-residences-2-gv` |
| Tsada Panorama Phase D | `/tsada-panorama-d-gv` |
| Tsada Panorama Superior Villa | `/tsada-panorama-superior-gv` |
| Georgia 12 (A&B) | **none — new** |

Linking is the operator's existing publish-then-supersede flow
(`/admin/content/projects/overlaps`); the connector does not automate it.

Name matching must run through `deGreek()`, which already exists: Alta Mare's own
price list spells its title with a Greek capital alpha (`Αlta`) and a Greek iota
(`Phase Ι`). A naive comparison fails on those.

Gallery from `Renderings` / `Interior Renderings`; plans from `Floor Plans` /
`Architectural Plans` / `MASTER PLAN.pdf`, through the existing `collectMedia`
path. Amenities come from the price list's own `INCLUDED IN PRICE` block, which
is already inside the parsed table. Per-project `Drone Videos` folders are
skipped — video is not ingested anywhere in the system.

## Guards

- **Completeness.** A price list that suddenly yields far fewer units than the
  stored count writes nothing and reports, mirroring `checkFeedCompleteness`. A
  re-uploaded PDF that parses badly must never look like a sell-out.
- **Unresolved cells stay unresolved.** `readOutcome` returning `null` already
  means "unknown", never "available". Preserve that and report the count.
- **An unmapped column is reported, not guessed** — `validateMapping`'s
  corrections surface in the run summary.
- Failures reach Telegram and email through the existing failure-streak throttle.

## Testing

1. Commit `scripts/qa/availability-table-check.mjs` unchanged as the baseline
   (green today, ~47 assertions).
2. Add the five G&V PDFs as fixtures (37–140 KB each) with expected unit counts,
   prices and statuses per project — including Superior Villa's ref fallback.
3. After **every** engine change, re-run the suite and confirm the Korantina and
   AGG assertions still pass — before and after, not once at the end.
4. Mutation-test each new assertion: revert the change it guards, confirm the
   test fails.
5. `previewDriveFolders` dry run against the live folder before anything is
   written, reporting per project: units found, statuses, prices, unmapped
   columns.

## Stage 2 — brochure descriptions

`driveAvailabilitySync` already generates a four-language description via
`generateProjectDescription` from documents it finds in a project folder. Whether
G&V's brochures (6–14 MB, mostly image pages) yield usable text through the
existing `extractTextFromPdf` path is unverified, so description quality is
explicitly out of stage 1. Amenities are covered in stage 1 from the price list.

## Risks

- **Two live developers ride on the engine being changed.** Mitigated by
  decision 2; if the net cannot be made to hold, fall back to a G&V-specific
  reader rather than shipping a risky engine change.
- **Georgia 12 has no legacy page** and is the one project that will appear as
  genuinely new and need a first publish.
- The model's column mapping can drift between runs. `validateMapping` bounds
  this, and the fixtures pin the expected mapping for all five layouts.
