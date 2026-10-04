# Plus Properties: 35 projects from hand-kept Excel price lists in Drive

Status: design approved 2026-09-25, not built.

## Problem

Plus Properties is a new developer in the portfolio: about 35 Cypriot projects,
several hundred units, and no feed, no API and no website data we can rely on for
units. What they do keep is a Google Drive folder, shared with us, holding one
price list per project, versioned by hand and updated roughly every two weeks
(the current files are dated 2026-09-09 and 2026-09-21).

The folder is named "Availabilities xml", which reads like a feed. It is not one.
The files are Excel workbooks saved in the old SpreadsheetML 2003 format, and they
carry the developer's own layout decisions — hidden sheets, stale snapshots left
in visible sheets, prices hidden by colouring them white — that a generic reader
turns into wrong data without any error. This connector exists to read them
correctly, join them to the media kept in a separate part of the same Drive, and
keep them in sync.

## What the source actually is

### Where things live

Root folder `1DOgqxKagV79t-9if8uHJi0woLLk6pTD8`, owner
`pluspropertiescyprus@gmail.com`, shared with us:

| Folder | Id | Contents |
|---|---|---|
| Availabilities xml - Cyprus | `1xeFHfoMUGpyAPMgUMe9qMHmyRvyOdnMu` | 32 price lists (SpreadsheetML) |
| Availabilities & Price Lists - Cyprus | `14Kg7ggLA10DIHqY-fQk2L-BGvN27g5JZ` | 34 PDFs of the same lists |
| Cyprus Projects | `1aXXbOSp_-10rLlHHixQzGR-RKnc342AN` | `<City> Projects/<Plus NN (area)>/` media |
| Availabilities & Price Lists - Greece, Greece Projects | — | out of scope |

Price lists and media live in **different trees**. The only join key is the
project number in the name: "Plus 33 Universal - Paphos - Price List 2.41.xml"
belongs to the folder "Paphos Projects/Plus 33 (Universal)".

A tooling warning that cost time during analysis: the Drive MCP `search_files`
tool listed ONE of the 32 price lists and reported the PDF folder empty. It only
surfaces files the operator has opened. Our own OAuth credentials
(`GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`, as used by `src/lib/googleDrive.ts`)
see everything, and they are what the connector uses.

### The 35 projects

| Source situation | Projects |
|---|---|
| XML + PDF + media folder | 28 (Plus 21, 33, 38, 39, 56, 57, 59, 60, 61, 62, 63, 65, 66, 67-68-69, 70-71, 73–82, 86, 87, 88) |
| XML + media, no PDF | Plus 85 |
| XML + PDF, no media folder | House Kiti, Plus 55, Plus 92 |
| PDF + media, no XML | Plus 4, Plus 29, Plus 72 |

Media folders with nothing in them today: Plus 85 (Images) and Plus 86 (images and
floor plans). The "Location" document in each folder holds nothing but the Google
Maps link that the price list already carries.

### Media per project folder

Subfolder names vary ("Unbranded Images", "Unbranded Pictures", "Unbranded
Perspectives", "REAL PICS", "Real pictures", "Floor Plans", "Floor plans",
"Architectural plans", "Drone shots", "VIDEO ANIMATION", "DEED"). Plus 39 keeps its
real photos two levels down, one folder per penthouse (56 images). Video (drone
mp4, animation) and deeds are not imported.

## Units: the price lists

### Which sheet: the active one

A workbook can hold several sheets, and only one of them is current:

- **Plus 57** has five sheets. Four are hidden; one of those is a stale launch
  price list with three prices per unit (5/30/55 % down-payment plans). The one
  visible sheet is the current list.
- **Plus 87** has three **visible** sheets: "Plus 87", "before TD" and "after TD".
  The last two are old snapshots in which all ten units are still Available. The
  current list has three available, one reserved, six sold.

"Read only visible sheets" would therefore still publish seven sold Plus 87 units
as available. The rule is: **read the active (selected) sheet** — the one Excel
prints, and so the one the PDF shows. Measured 2026-09-25: all 32 workbooks have
exactly one active sheet, and none of those is hidden.

### Ground truth: the PDFs

The PDFs are the developer's own printout of the active sheet, which makes them the
reference. Comparing every workbook against its PDF, unit by unit, on the active
sheet:

- 433 real units have a PDF. 428 match automatically on status, and on price for
  every available unit.
- 4 match on inspection; their PDF row wraps across lines.
- 1 differs: Plus 88 B103, Available at €195,000 in PDF v1.6, Reserved in XML v1.7
  (2026-09-21). The XML is newer. **The XML is the fresher source.**

For Plus 57, all 35 units match the PDF the operator sent on 2026-09-25.

### The traps the reader must handle

1. **Hidden prices.** Sold and reserved units often keep their price in the cell,
   coloured white so it does not print. 36 such prices, all on sold (21) or
   reserved (15) units, none on an available unit. A reader that ignores font
   colour publishes them.
2. **Active sheet.** As above.
3. **Header spellings.** Around 60 spellings for about 15 concepts: "Nbr of
   Bedrooms" / "Number of Bedrooms" / "Nbr. of Bedrooms"; "(sqm)" / "(SQM)"; a
   dozen names for outdoor space (uncovered veranda, roof terrace, garden,
   planter, roof garden …).
4. **Unit column name.** Usually "Unit"; Plus 60 uses "Villa No".
5. **An old-price column that must never be a fallback.** Plus 75 carries
   `Price €/OLD` beside `Price €`. For a sold villa the current price is often
   empty while the old one is filled (D-Villas, Villa 1: 370,000 under OLD,
   nothing under current). Reading OLD when current is empty publishes a stale
   price on a sold unit.
6. **Two-row header.** Plus 60 splits internal area into Gr.Floor / 1st Floor /
   2nd Floor / Total Area on a second header row under one heading; the unit's
   internal area is that sub-row's "Total Area" column, not the separate
   "Total Area (sqm)" of the whole villa.
7. **Two-storey villas with swapped columns.** Plus 75's villa blocks ("C-Villas",
   "D- Villas") put the villa's NAME ("Villa 1") in the Floor column and the
   STOREY ("Lower Floor") in the Unit column; the next row, "Upper Floor", has no
   name and continues the same villa. One villa, two rows. Villa names repeat
   across blocks, so the unit ref must carry the block. (The PDF prints the name
   on a line of its own between the two storeys; that is only vertical centring.)
8. **Merged cells.** Floor, block and project appear only on the first row of their
   group.
9. **Excel number noise.** `8.6999999999999993`, `76.599999999999994`.
10. **Bedroom text.** `4 ( 3+1)`, `3(2+1)`. Stored as `4 (3+1)`: every reader of
    `beds` takes the first number, so the total must lead.
11. **Escaped names.** A sheet is called "Plus 67-68 & 69"; anything that reads
    sheet names out of the raw XML without unescaping sees `&amp;`.
12. **A house, not a table.** House Kiti describes one house room by room, with a
    plot area, a single price (€880,000) and no status word.

Unit status vocabulary is closed and clean: `Available`, `Reserved`, `Sold`
(trailing spaces occur).

## Design

### Components

- **`src/lib/plusProperties.ts`** — pure parser, no database, no network. Input:
  the raw bytes of one workbook. Output: project metadata and units. Every trap
  above lives here, and so do the tests.
- **`src/lib/plusPropertiesSync.ts`** — lists and downloads from Drive through the
  existing `googleDrive.ts` helpers, joins price list to media folder, resolves
  the Maps link, reads Project Details from the website, writes Developments and
  units, mirrors media through `imageMirror`.
- **`src/app/api/cron/plus-sync/route.ts`** — nightly entry point, 02:30.
- Cron-health entry `plus-sync` in `src/lib/actionCenter/rules/system.ts` JOBS.

The parser reads the raw XML itself rather than going through SheetJS: SheetJS
does not surface font colour or the active-sheet flag, and those two carry the
correctness of the whole connector.

### Identity

- Developer account "Plus Properties", `dev = "plusproperties"`.
- Project key from the **number in the file name**, normalised: `33`, `67-68-69`
  (from "67_68_69"), `70-71`, `house-kiti`. `feedKey = "plusproperties:<key>"`.
  Not the Drive file id and not the file name — both change with every new
  version.
- Media folder found by the same number under `Cyprus Projects/<City> Projects/`.
- Unit ref: the unit label as written when it already starts with the block's
  token (the letter in "(X)" if the block has one, else the block itself:
  `Violet (A)` + `A01` → `A01`, `A` + `A101` → `A101`), otherwise `<block> <label>`
  (`Plus 67 101`, `C-Villas Villa 1`); no block, the label; a ref that still
  repeats in its project gets the unit's floor as written (`Office 1 (Second
  Floor)`, Plus 92; operator's decision 2026-09-26), or, if that cannot tell
  the units apart, stays as it is with a note. Stable across
  versions; it is what client presentations will pin.
- The connector sets **no slug**. `Development.slug` is minted on publish by
  `uniqueDevelopmentSlug()` from the public name ("Plus 33" → `plus-33`), as for
  Cybarco. The dry run reports whether that slug collides with a Development or a
  legacy Project (`uniqueDevelopmentSlug` only dedupes against Developments).

### Field mapping

| Target | Source |
|---|---|
| `publicName` | "Plus 33" — the number is the project's name (operator decision) |
| `town`, `district` | price-list footer "Location:" ("Universal - Paphos") |
| `latitude`, `longitude` | footer "Google Maps:" short link, resolved to its final URL |
| `stage` | footer "Project Status:", see below |
| `energy` | website Project Details ("Energy Efficiency Category: A") |
| `description`, `amenities`, `extraFacts` | website Project Details block (raw facts for the AI generator) |
| `gallery` | all images from the media folder (the hero, `mainImage`, lives in `DevelopmentOverride` and stays the admin's pick) |
| `plans` | Floor Plans images + Architectural plans PDFs rendered to pages |
| unit `beds`, `baths`, `floor`, `areaVeranda`, `areaVerandaOpen`, `areaPlot` | price-list columns |
| unit `areaBuilt` **and** `areaInternal` | covered internal area — `areaBuilt` is what the public unit table shows (Covered Area = areaBuilt + areaVeranda, as for Island Blue) |
| unit `storage` | "yes" when the list shows at least one storage room (the column is yes/no) |
| unit `attrs` `[{ name, value }]` | parking, storage count, roof terrace, garden, common area, total area |
| unit `price` | price column, available units only |
| `category` | **never written by the connector** |
| `DevelopmentOverride.*` | **never written** — admin space (vatApplies included) |

VAT needs no write: the project page already shows "+VAT" unless an admin sets
`vatApplies = false`, which matches Plus's net prices (31 of 32 lists say so). A
list that stops saying so is reported as a note for the operator.

`stage` is free text across the system with inconsistent spellings. Plus maps to
the most common existing form of each state: "Under-Construction" / "Under
construction" / "Under Construction" → `Under Construction`; "Understudy" → `Off
Plan`; "Ready to move in" → `Completed`.

### Unit status

| Price list | Unit status | Price stored |
|---|---|---|
| Available | `available` | yes |
| Reserved | `reserved` | no |
| Sold | `sold` | no |

A price is stored only for an available unit, and a white-font price is never read
at all. An unknown status value fails **that project only**.

The same applies to everything else the parser can meet for the first time: a
workbook with no active sheet or more than one, and a project status outside the
mapping below, each fail that one project and are reported by name.

### Types

The connector derives no unit types in this version and never writes `category`.
The operator supplies a type per project later; it is set as `category`, which the
connector leaves alone and which `resolveDevelopmentType` already falls back to.
Mixed projects take a composite category, as Limassol Greens does (`Apartment ·
Villa` for Plus 75; the shops in Plus 59 and 92 are `Commercial`).

Any unit type set by hand survives every run (the Cybarco lesson of 2026-09-24):
the writer carries over the columns it does not own, keyed on the unit ref.

### Media

All images are imported (standing policy). New projects land as drafts, so the
operator curates before publishing. Once a project is published, the feed-sync
freeze applies: `publicName`, `description`, `amenities`, `gallery`, `plans`
always, and `district`, `town`, `latitude`, `longitude` once set. Video and deeds are skipped.

### Project Details from the website

Each price list links to its project page (30 of 32; bit.ly short links to
pluspropertiescyprus.com). The connector reads only the "Project Details" block —
a bullet list such as "Common Swimming Pool · 6 minutes from the Beach · Energy
Efficiency Category: A · 2-Bedroom Penthouse with Large Terrace". No layout
scraping. If the page or block is missing, that project's facts are skipped and
the rest of the sync continues.

### Sync behaviour

- **Change detection** where it costs something: media. Each project's media
  signature (`collectMedia().sig`) is stored in the existing
  `Development.driveImagesModified`, and unchanged media is not re-downloaded.
  The 32 price lists are re-read every run — parsing them takes well under a
  second, and a per-file checksum would need a column that does not exist.
  `force` re-mirrors everything.
- **Isolation.** Each project runs in its own try/catch. A broken file skips one
  project and is reported; the other 34 continue. (Cybarco, 2026-09-24: one
  unrecognised status mark aborted the whole run and blocked nine projects for two
  nights.)
- **Published projects never lose units.** A unit missing from the list becomes
  `unlisted`; a sold unit stays sold. Drafts are rewritten (delete + recreate),
  with the hand-set columns carried over by unit ref as described under Types.
- **Completeness guard per project**, built on `completenessVerdict` and
  `countableFeedUnits` from `feedSync.ts`: the project's units are left untouched
  when its countable units drop by more than 15 % **and** by more than 3. The
  shared feed floor of 20 cannot be used here — Plus projects hold 4 to 63 units,
  so a floor of 20 would never fire for most of them; 3 is Mito's floor, chosen
  for the same reason. A block logs `plus-incomplete:<key>` ok=false. **Every clean run logs ok=true on the same
  key**, so the alarm switches itself off (the Domenica/Medousa lesson: an alarm
  that cannot clear is worse than none).
- **Run verdict.** If most Drive fetches fail (expired token), the run fails loudly
  and writes nothing rather than reading 35 projects as empty.
- **Dry run** reports what would be written, and writes nothing. The first
  production run is a dry run shown to the operator.
- Media mirroring holds the sync window; the restart afterwards is the rolling
  reload.
- Derived state (availability, price-from, sold-out) is recomputed through
  `recomputeDevelopmentDerivedState`, as for every developer.

### Acceptance

1. For every fixture, the parser's status for every unit, and price for every
   available unit, equals its PDF.
2. After a run, no `sold` or `reserved` Plus unit has a price.
3. Plus 87 yields 3 available, 1 reserved, 6 sold — from the active sheet only.
4. Plus 57 yields 35 units, 12 available, prices equal to the PDF of 2026-09-25.
5. Plus 75's villas are nine units (C: Villa 1–2, D: Villa 1–7), refs carry the
   block, bedrooms and bathrooms are summed over both storeys, and no villa takes
   its price from `Price €/OLD` (D-Villa 1 is sold with no price, not €370,000).
6. All 35 projects exist as drafts; the three PDF-only ones have no units.
7. A `category` set by hand survives a run; so does a hand-set unit type.
8. A workbook with an unknown unit status, an unknown project status, or not
   exactly one active sheet fails only its own project.
9. The completeness guard fires for a small project (e.g. 6 → 2 countable units),
   not only for large ones.
10. The completeness alarm clears on the next clean run.
11. A dry run writes nothing.
12. Every guard is mutation-tested, and each mutation is confirmed to have landed in
    the function under test.

Fixtures are real files: Plus 33 (plain), 57 (hidden sheets), 87 (stale visible
sheets), 60 (villa table, two-row header), 75 (two-storey villas, OLD price), 67-68-69 (`&` in the sheet name),
59 (shops), one file with white-font prices, House Kiti, and one website page.

## What this connector cannot provide

- **Unit type** — in no source; supplied by the operator per project.
- **Completion date** — the lists carry only a status word.
- **Orientation / view** — in no source.
- **Which image shows which unit** — media is per project.
- **Images** for Plus 85 and 86 (folders empty) and for House Kiti, Plus 55 and 92
  (no media folder).
- **Units** for Plus 4, 29 and 72 — PDF only; they become presentation pages.

## Out of scope

Greece (operator decision); video and deeds; payment plans; reading units out of
PDFs; normalising `stage` spellings system-wide.
