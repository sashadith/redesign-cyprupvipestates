#!/usr/bin/env node
/* Guard for the Plus Properties parser (src/lib/plusProperties.ts).
   Spec: docs/superpowers/specs/2026-09-25-plus-properties-connector-design.md.
   Every fixture is a real workbook from the developer's Drive; each one exists
   for one trap the spec lists. Run: node scripts/qa/plus-parse-check.mjs */
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild"); process.exit(2); }

const scratch = join(process.cwd(), "node_modules", ".plus-parse-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
async function bundle(entry, name) {
  const out = await build({
    entryPoints: [entry], bundle: true, platform: "node", format: "esm", write: false,
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  const f = join(scratch, `${name}.mjs`);
  writeFileSync(f, out.outputFiles[0].text);
  return f;
}
const P = await import(await bundle("src/lib/plusProperties.ts", "parser"));
const fx = (name) => readFileSync(join("scripts/qa/fixtures/plus", name), "utf8");

let failures = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

/* ── the active sheet ──────────────────────────────────────────────────────
   The PDF is Excel's printout of the ACTIVE sheet, so that is the current list.
   Plus 57 hides four stale sheets; Plus 87 keeps two stale snapshots VISIBLE, in
   which all ten units are still available — "read only visible sheets" would
   publish seven sold flats as on sale. */
const active = async (key) => P.activeSheet(await P.readWorkbook(fx(`plus-${key}.xml`))).name;
check("Plus 57: the one visible sheet out of five", await active("57"), "PLUS 57");
check("Plus 87: the active sheet, not a visible stale snapshot", await active("87"), "Plus 87");
check("Plus 21: the visible price sheet, not the hidden 'avail' one", await active("21"), "PLUS 21 price");
check("Plus 33: a plain workbook", await active("33"), "Plus 33");
/* The sheet is literally named "Plus 67-68 & 69". A reader that pulls names out
   of the raw XML with a regex sees "&amp;" — that is how the analysis run first
   lost this whole project. */
check("an '&' in a sheet name is decoded", await active("67-68-69"), "Plus 67-68 & 69");

const s57 = await P.readWorkbook(fx("plus-57.xml"));
check("Plus 57 has five sheets", s57.length, 5);
check("…four of them hidden", s57.filter((s) => s.hidden).length, 4);
const s87 = await P.readWorkbook(fx("plus-87.xml"));
check("Plus 87: all three sheets visible", s87.filter((s) => !s.hidden).length, 3);
check("…exactly one active", s87.filter((s) => s.active).length, 1);

/* Font colour survives the read — the hidden-price rule depends on it.
   Plus 75, D-Villas, Villa 4 is sold with 335,000 written in white. */
const s75 = P.activeSheet(await P.readWorkbook(fx("plus-75.xml")));
const white = s75.rows.flat().find((c) => c.value === "335000");
check("a white price keeps its colour", white?.colour, "#FFFFFF");

/* The contract for anything the parser meets for the first time. */
const bare = (sheets) => sheets.map((s, i) => ({ name: `S${i}`, hidden: false, active: false, rows: [], ...s }));
let threw = "";
try { P.activeSheet(bare([{ active: true }, { active: true }])); } catch (e) { threw = String(e.message); }
check("two active sheets fail loudly", /exactly one active sheet/.test(threw), true);
threw = "";
try { P.activeSheet(bare([{}, {}])); } catch (e) { threw = String(e.message); }
check("no active sheet among several fails loudly", /exactly one active sheet/.test(threw), true);
check("a single-sheet workbook without the flag uses its only sheet", P.activeSheet(bare([{ name: "Only" }])).name, "Only");
threw = "";
try { P.activeSheet(bare([{ active: true, hidden: true }, {}, {}])); } catch (e) { threw = String(e.message); }
check("a hidden sheet never counts as active", /exactly one active sheet/.test(threw), true);

/* ── header spellings ──────────────────────────────────────────────────────
   Every left-hand string below is a real header measured across the 32 lists
   on 2026-09-25 (about 60 spellings for about 15 concepts). */
const F = (h) => P.columnField(h);
const HEADERS = [
  ["Unit", "unit"], ["Villa No", "unit"], ["Floor", "floor"],
  ["Block", "block"], ["BLOCKS", "block"], ["Project", "block"],
  ["Nbr of Bedrooms", "beds"], ["Number of Bedrooms", "beds"], ["Nbr. of Bedrooms", "beds"],
  ["Nbr of Bathrooms", "baths"], ["Number of Bathrooms", "baths"], ["Nbr. of Bathrooms", "baths"],
  ["Parking", "parking"], ["Parking Spaces", "parking"], ["Covered Parking (sqm)", "parking"],
  ["Storage", "storage"], ["Storage Rooms", "storage"], ["Storages", "storage"], ["Stores", "storage"],
  ["Storage Room", "storage"], ["Storage / Area (sqm)", "storage"],
  ["Covered Internal Area (sqm)", "internal"], ["Covered Internal Area (SQM)", "internal"],
  ["Internal Area (sqm)", "internal"], ["Covered / Closed Area (sqm)", "internal"],
  ["Covered Veranda (sqm)", "veranda"], ["Covered Veranda (SQM)", "veranda"], ["Covered Veranda / Terrace (sqm)", "veranda"],
  ["Uncovered Veranda (sqm)", "verandaOpen"], ["Uncovered Terrace (sqm)", "verandaOpen"],
  ["Uncovered Veranda & Terraces (sqm)", "verandaOpen"], ["Uncovered Balcony (sqm)", "verandaOpen"],
  ["Uncovered veranda/ Terrace (sqm)", "verandaOpen"], ["Uncovered Veranda / Roof Terrace", "verandaOpen"],
  ["Uncovered Roof Terrace (sqm)", "roof"], ["Covered Roof Terrace", "roof"], ["Internal covered Roof (sqm)", "roof"],
  ["Roof Garden (SQM)", "roof"], ["Roof Storage and Bathroom (sqm)", "roof"],
  ["Garden (sqm)", "garden"], ["Gardens", "garden"], ["Planter (sqm)", "garden"],
  ["Common Area (sqm)", "common"], ["Total Area (sqm)", "total"], ["Plot Area (sqm)", "plot"],
  ["Price €", "price"], ["Price", "price"], ["Availability", "status"],
  /* The two a naive mapping gets wrong in the dangerous direction. */
  ["Price €/OLD", "priceOld"],
  ["OPTIONAL Roof Garden / Subject to Extra Cost (sqm)", "ignore"],
  ["Storage Optional at Extra Cost", "ignore"],
  ["(5% downpayment)", "ignore"], ["Kitchenette", "ignore"], ["Nbr of Units", "ignore"],
];
for (const [h, want] of HEADERS) check(`header "${h}" → ${want}`, F(h), want);
check("an unknown header is null, not a guess", F("Sea View Rating"), null);
check("whitespace and line breaks inside a header are ignored", F("Covered Internal Area\n  (sqm)"), "internal");
check("an empty header is null", F("   "), null);

/* ── small rules ───────────────────────────────────────────────────────── */
check("status: Available", P.parseStatus("Available"), "available");
check("status: trailing space tolerated", P.parseStatus("Available "), "available");
check("status: Reserved", P.parseStatus("Reserved"), "reserved");
check("status: Sold, any case", P.parseStatus("SOLD"), "sold");
threw = "";
try { P.parseStatus("Under Offer"); } catch (e) { threw = String(e.message); }
check("an unknown unit status fails loudly and names itself", /unknown unit status "Under Offer"/.test(threw), true);

check("stage: three spellings of under construction",
  ["Under-Construction", "Under construction", "Under Construction"].map(P.projectStage),
  ["Under Construction", "Under Construction", "Under Construction"]);
check("stage: Understudy is pre-construction", P.projectStage("Understudy"), "Off Plan");
check("stage: Ready to move in", P.projectStage("Ready to move in"), "Completed");
check("stage: absent is null, not an error", [P.projectStage(null), P.projectStage("  ")], [null, null]);
threw = "";
try { P.projectStage("Launching Soon"); } catch (e) { threw = String(e.message); }
check("an unknown project status fails loudly", /unknown project status "Launching Soon"/.test(threw), true);

check("Excel noise is rounded", P.cleanNumber("76.599999999999994"), 76.6);
check("a unit suffix is dropped", P.cleanNumber("883 SQM"), 883);
check("thousand separators and currency", P.cleanNumber("€ 410,000"), 410000);
check("no number is null", [P.cleanNumber(""), P.cleanNumber(null), P.cleanNumber("n/a")], [null, null, null]);
/* The total leads: every reader of `beds` takes the FIRST number, so "3+1"
   would count Plus 60's four-bedroom villas as three. */
check("beds: '4 ( 3+1)' → total first, split kept", P.cleanBeds("4 ( 3+1)"), "4 (3+1)");
check("beds: '3(2+1)' (Plus 87)", P.cleanBeds("3(2+1)"), "3 (2+1)");
check("beds: plain", [P.cleanBeds("2"), P.cleanBeds("2.0"), P.cleanBeds(""), P.cleanBeds(null)], ["2", "2", null, null]);
check("text: Excel noise on a number", P.cleanText("17.600000000000001"), "17.6");
check("text: words are kept", [P.cleanText(" semi covered "), P.cleanText("1 Roof"), P.cleanText("")], ["semi covered", "1 Roof", null]);

/* A villa's upper storey adds its counts to the villa. A split count such as
   "3 (2+1)" counts as its leading total, like every other reader of beds. */
check("sumCount: plain counts add", P.sumCount("2", "1"), "3");
check("sumCount: a split count adds as its leading total", P.sumCount("3 (2+1)", "1"), "4");
check("sumCount: nothing numeric keeps what is there", [P.sumCount(null, null), P.sumCount("Yes", null)], [null, "Yes"]);

/* ── the unit ref ─────────────────────────────────────────────────────────
   Public, and pinned by client presentations from the first real run. The
   block is added only when the label does not already carry it: the block's
   token is the letter in "(X)" when it has one, else the block itself. */
check("ref: a label that starts with the block's (X) letter is the ref (Plus 57)", P.unitRef("Violet (A)", "A01"), "A01");
check("ref: a label that starts with the block is the ref (Plus 21)", P.unitRef("A", "A101"), "A101");
check("ref: …compared without case", P.unitRef("a", "A101"), "A101");
check("ref: a bare number carries its block (Plus 67-68-69)", P.unitRef("Plus 67", "101"), "Plus 67 101");
check("ref: a villa name carries its block (Plus 75)", P.unitRef("C-Villas", "Villa 1"), "C-Villas Villa 1");
check("ref: no block, the label", P.unitRef(null, "Villa 1"), "Villa 1");
const refsOf = async (key) => (await P.parsePriceList(fx(`plus-${key}.xml`))).units.map((u) => u.ref);
check("Plus 57 end to end: 'Violet (A)' + 'A01' is 'A01'", (await refsOf("57"))[0], "A01");
check("Plus 21 end to end: 'A' + 'A101' is 'A101'", (await refsOf("21")).includes("A101"), true);
check("Plus 67-68-69 end to end: 'Plus 67' + '101' is 'Plus 67 101'", (await refsOf("67-68-69"))[0], "Plus 67 101");
check("Plus 75 end to end: an apartment ref is its label", (await refsOf("75"))[0], "A01");

/* ── Plus 33, the plain case ─────────────────────────────────────────────
   Values from the developer's PDF of version 2.41 (2026-09-01). */
const p33 = await P.parsePriceList(fx("plus-33.xml"));
const byRef = (p) => Object.fromEntries(p.units.map((u) => [u.ref, u]));
const u33 = byRef(p33);
check("Plus 33: seven units", p33.units.length, 7);
check("Plus 33: statuses", ["101", "102", "201", "202", "301", "302", "401"].map((r) => u33[r]?.status),
  ["available", "available", "sold", "sold", "sold", "available", "available"]);
check("Plus 33: prices on available units", ["101", "102", "302", "401"].map((r) => u33[r].price), [350000, 350000, 370000, 500000]);
/* 201 is sold with 360,000 still in its cell, coloured white so it does not
   print. The developer chose not to show it; neither do we. */
check("Plus 33: a sold unit's hidden price is not read", u33["201"].price, null);
check("Plus 33: floor carried down a merged cell", u33["102"].floor, "First Floor");
check("Plus 33: interior area goes to areaBuilt", u33["101"].areaBuilt, 78);
check("Plus 33: covered veranda", u33["101"].areaVeranda, 35);
check("Plus 33: penthouse's uncovered terrace", u33["401"].areaVerandaOpen, 87);
check("Plus 33: footer", [p33.stage, p33.location, p33.mapsUrl, p33.websiteUrl, p33.version, p33.vatExcluded],
  ["Under Construction", "Universal - Paphos", "https://goo.gl/maps/eNuotzX4Enz2M9GC6", "https://bit.ly/3ogneqP", "2.41", true]);

/* ── the active-sheet rule, end to end ───────────────────────────────── */
const p87 = await P.parsePriceList(fx("plus-87.xml"));
const st = (p) => p.units.reduce((a, u) => (a[u.status] = (a[u.status] || 0) + 1, a), {});
check("Plus 87: 3 available, 1 reserved, 6 sold", st(p87), { sold: 6, reserved: 1, available: 3 });
check("Plus 87: its three prices", p87.units.filter((u) => u.price).map((u) => u.price), [315000, 360000, 370000]);
const u87 = byRef(p87);
check("Plus 87: '88 (78+10)' is 88 m² inside", u87["302"].areaBuilt, 88);
check("Plus 87: '3(2+1)' bedrooms keep their total first", u87["302"].beds, "3 (2+1)");
check("Plus 87: storage text is kept as written", u87["401"].storage, "1 Roof");
const p57 = await P.parsePriceList(fx("plus-57.xml"));
check("Plus 57: 35 units, 12 available", [p57.units.length, p57.units.filter((u) => u.status === "available").length], [35, 12]);
check("Plus 57: no three-price payment plan leaks in", p57.units.every((u) => u.price == null || u.price >= 245000), true);

/* ── the invariant, across every fixture ─────────────────────────────── */
for (const key of ["33", "57", "87", "63", "59", "67-68-69", "21", "60", "75", "77", "92"]) {
  const p = await P.parsePriceList(fx(`plus-${key}.xml`));
  check(`Plus ${key}: no sold or reserved unit carries a price`, p.units.filter((u) => u.status !== "available" && u.price != null).map((u) => u.ref), []);
}
/* A ref names one unit. Two units with the same ref in one project means a
   row was read as a unit that is not one (Plus 75's "Lower Floor" storeys). */
for (const key of ["33", "57", "87", "60", "75", "67-68-69", "59", "63", "21", "77", "92"]) {
  const refs = (await P.parsePriceList(fx(`plus-${key}.xml`))).units.map((u) => u.ref);
  check(`Plus ${key}: refs are unique`, new Set(refs).size === refs.length, true);
}
const p67 = await P.parsePriceList(fx("plus-67-68-69.xml"));
check("Plus 67-68-69: the Project column qualifies refs, so 101 does not collide",
  new Set(p67.units.map((u) => u.ref)).size, p67.units.length);

/* Plus 60 writes its "NB: Prices mentioned above…" notes in the unit column. */
check("Plus 60's NB notes are not units", (await P.parsePriceList(fx("plus-60.xml"))).notes.some((n) => /NB:/.test(n)), false);

/* Two columns, one area: Plus 63 has "Uncovered Veranda (sqm)" and "Uncovered
   Terrace (sqm)", both open-air. Unit 301 fills both — 7.7 (Uncovered Veranda)
   + 50 (Uncovered Terrace) = 57.7, which is what its Total Area of 193.2 adds up
   with (99 + 27.2 + 7.7 + 50 + 9.3). Reading only the first would drop 50 m². */
const u63 = byRef(await P.parsePriceList(fx("plus-63.xml")));
check("Plus 63: 301's two uncovered columns are summed", u63["301"].areaVerandaOpen, 57.7);

/* White means hidden even on an AVAILABLE unit. No real list has that case —
   every white price measured sits on a sold or reserved unit, where the status
   rule already drops it — so this one is a two-row workbook written here. */
/* A one-sheet workbook written here: rows of cells, a cell is a string or
   { v, s } with s a style — "w" white font, "k" black. */
const workbook = (rows) => `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles><Style ss:ID="w"><Font ss:Color="#FFFFFF"/></Style><Style ss:ID="k"><Font ss:Color="#000000"/></Style></Styles>
 <Worksheet ss:Name="T"><Table>
${rows.map((r) => `  <Row>${r.map((c) => {
    const { v, s } = typeof c === "string" ? { v: c, s: null } : c;
    return `<Cell${s ? ` ss:StyleID="${s}"` : ""}><Data ss:Type="String">${v}</Data></Cell>`;
  }).join("")}</Row>`).join("\n")}
 </Table></Worksheet>
</Workbook>`;
const oneUnit = (style) => workbook([["Unit", "Price €", "Availability"], ["101", { v: "300000", s: style }, "Available"]]);
check("a white price is hidden even on an available unit, a black one is read",
  [(await P.parsePriceList(oneUnit("w"))).units[0]?.price, (await P.parsePriceList(oneUnit("k"))).units[0]?.price], [null, 300000]);

/* ── Plus 60: "Villa No" and a two-row header ─────────────────────────── */
const p60 = await P.parsePriceList(fx("plus-60.xml"));
const u60 = byRef(p60);
check("Plus 60: five villas", p60.units.map((u) => u.ref), ["Villa 1", "Villa 2", "Villa 3", "Villa 4", "Villa 5"]);
check("Plus 60: statuses", p60.units.map((u) => u.status), ["available", "sold", "sold", "available", "sold"]);
check("Plus 60: prices", [u60["Villa 1"].price, u60["Villa 4"].price], [1030000, 715000]);
/* The sub-header splits "Internal Area" into Gr.Floor / 1st / 2nd / Total;
   the unit's interior is that Total, not the villa's overall total area. */
check("Plus 60: interior is the sub-header's total", u60["Villa 1"].areaBuilt, 176.3);
check("Plus 60: …not the villa's overall total", u60["Villa 1"].areaTotal, 280);
check("Plus 60: plot area", u60["Villa 1"].areaPlot, 350.1);
check("Plus 60: '4 ( 3+1)' bedrooms, total first", u60["Villa 1"].beds, "4 (3+1)");
check("Plus 60: parking area loses Excel noise", u60["Villa 1"].parking, "17.6");

/* ── Plus 75: villas over two rows with swapped columns ──────────────── */
const p75 = await P.parsePriceList(fx("plus-75.xml"));
const villas = p75.units.filter((u) => /Villa \d/.test(u.label));
check("Plus 75: nine villas", villas.map((u) => u.ref), [
  "C-Villas Villa 1", "C-Villas Villa 2",
  "D-Villas Villa 1", "D-Villas Villa 2", "D-Villas Villa 3", "D-Villas Villa 4",
  "D-Villas Villa 5", "D-Villas Villa 6", "D-Villas Villa 7"]);
const v = byRef(p75);
check("Plus 75: a storey is never a unit", p75.units.some((u) => /floor$/i.test(u.label)), false);
check("Plus 75: C-Villa 1 beds summed over both storeys", v["C-Villas Villa 1"].beds, "3");
check("Plus 75: …baths summed", v["C-Villas Villa 1"].baths, "3");
check("Plus 75: …interior summed", v["C-Villas Villa 1"].areaBuilt, 127);
check("Plus 75: C-Villa 1 price from 'Price €', not OLD", v["C-Villas Villa 1"].price, 410000);
/* D-Villa 1 is sold and only its OLD price (370,000) is filled. Reading OLD as
   a fallback would publish a stale price on a sold villa. */
check("Plus 75: a sold villa with only an OLD price has no price", v["D-Villas Villa 1"].price, null);
/* D-Villa 4 is sold with 335,000 in white. The status rule already drops it,
   so this proves nothing about the white guard (oneUnit below does). */
check("Plus 75: a sold villa with a hidden price has none", v["D-Villas Villa 4"].price, null);
check("Plus 75: available D-villas", ["2", "6", "7"].map((n) => v[`D-Villas Villa ${n}`].price), [310000, 310000, 310000]);
check("Plus 75: no villa floor is 'Villa N'", villas.every((u) => !/villa/i.test(u.floor ?? "")), true);
/* An available apartment has both columns filled: "Price €/OLD" 220,000 and
   "Price €" 255,000. The current one is the price. */
check("Plus 75: A01 takes 'Price €' (255,000), not its OLD 220,000", v["A01"].price, 255000);

/* ── House Kiti: a house, not a table ─────────────────────────────────── */
const kiti = await P.parsePriceList(fx("plus-house-kiti.xml"));
check("House Kiti: one unit", kiti.units.length, 1);
const h = kiti.units[0];
check("House Kiti: the house", [h.ref, h.beds, h.baths, h.areaBuilt, h.areaVeranda, h.areaVerandaOpen, h.areaGarden, h.areaPlot, h.price],
  ["House", "5 (3+2)", "5 (3+2)", 345.5, 41.6, 118, 401, 883, 880000]);
check("House Kiti: status is an assumption, and says so", [h.status, kiti.notes.some((n) => /status assumed/.test(n))], ["available", true]);
check("House Kiti: footer", [kiti.stage, kiti.location], ["Completed", "Kiti - Larnaca"]);

/* ── Plus 59: a shop's mezzanine row continues the shop ──────────────────
   "Shop 1" (internal 95) is followed by "Shop 1 Mezzanine" (internal 47.5, no
   status). The PDF's total 188.75 = 95 + 47.5 + 34 basement storage + 12.25
   common: the mezzanine is part of the shop, not a unit and not a skipped row. */
const p59 = await P.parsePriceList(fx("plus-59.xml"));
const u59 = byRef(p59);
check("Plus 59: shop interiors include the mezzanine", [u59["Shop 1"]?.areaBuilt, u59["Shop 2"]?.areaBuilt], [142.5, 142.5]);
check("Plus 59: a mezzanine is neither a unit nor a note",
  [p59.units.some((u) => /mezzanine/i.test(u.label)), p59.notes.some((n) => /mezzanine/i.test(n))], [false, false]);
check("Plus 59: Shop 1 keeps its status and price", [u59["Shop 1"]?.status, u59["Shop 1"]?.price], ["available", 480000]);

/* ── sub-area rows continue the unit above them ─────────────────────────
   Dry run 2026-09-26. A status-less row whose unit cell is only a sub-area
   word belongs to the open unit directly above it.
   Plus 77: "Roof Garden" under penthouse 501, cells in Covered Internal (14),
   Covered Veranda (18.1) and "Uncovered roof terrace" (27.6, a roof column).
   501 then reads internal 124 + 14 = 138, covered veranda 83.5 + 18.1 = 101.6,
   uncovered veranda 28, roof 27.6, common 15.4, and its own Total 310.6 is
   unchanged: 138 + 101.6 + 28 + 27.6 + 15.4 = 310.6 — the sheet's total
   already counted the roof garden.
   Plus 92: "Mezzanine" under "Shop", one cell, Internal Area (45). The shop
   reads internal 92.4 + 45 = 137.4, and 137.4 + 0 veranda + 30.6 common =
   168, its Total. */
const p77 = await P.parsePriceList(fx("plus-77.xml"));
const u501 = byRef(p77)["501"];
check("Plus 77: 501's roof garden is part of 501",
  [u501?.areaBuilt, u501?.areaVeranda, u501?.areaVerandaOpen, u501?.areaRoof, u501?.areaCommon, u501?.areaTotal],
  [138, 101.6, 28, 27.6, 15.4, 310.6]);
check("Plus 77: …its status and price are its own", [u501?.status, u501?.price, u501?.beds, u501?.baths], ["available", 990000, "3", "4"]);
check("Plus 77: nine units, the roof garden is not one", [p77.units.length, p77.units.some((u) => /roof/i.test(u.label))], [9, false]);
check("Plus 77: no 'has no status' note", p77.notes.filter((n) => /has no status/.test(n)), []);
const p92 = await P.parsePriceList(fx("plus-92.xml"));
const shop92 = p92.units.find((u) => u.label === "Shop");
check("Plus 92: the shop's interior includes the mezzanine", [shop92?.areaBuilt, shop92?.areaVeranda, shop92?.areaCommon, shop92?.areaTotal], [137.4, 0, 30.6, 168]);
check("Plus 92: …its status and price are its own", [shop92?.status, shop92?.price], ["available", 504000]);
check("Plus 92: sixteen units, the mezzanine is not one", [p92.units.length, p92.units.some((u) => /mezzanine/i.test(u.label))], [16, false]);
check("Plus 92: no 'has no status' note", p92.notes.filter((n) => /has no status/.test(n)), []);
check("Plus 92: the next unit is untouched", p92.units.find((u) => u.label === "Office 1")?.areaBuilt, 79);
/* The rule is narrow: the whole cell must be the word, the row must follow
   an open unit directly, and any other status-less row is still skipped. */
const subHdr = ["Floor", "Unit", "Covered Internal Area (sqm)", "Price €", "Availability"];
const sub = await P.parsePriceList(workbook([
  subHdr,
  ["1st", "A1", "80", "300000", "Available"],
  ["", "Basement", "20", "", ""],
  ["", "Storage", "5", "", ""],
  ["", "A2", "70", "", "Sold"],
  ["", "Attic", "10", "", ""],
  ["", "roof TERRACE", "3", "", ""],
  ["", "Roof", "2", "", ""],
  ["", "Garage", "15", "", ""],
  ["", "Roof", "4", "", ""],
  ["", "A3", "60", "250000", "Available"],
  ["", "Mezzanine level", "9", "", ""],
  ["", "A4", "50", "200000", "Available"],
  ["", "Shared Storage", "7", "", ""],
]));
check("sub-area words continue the open unit; each word; case-insensitive",
  sub.units.map((u) => [u.ref, u.areaBuilt]), [["A1", 105], ["A2", 85], ["A3", 60], ["A4", 50]]);
check("…a non-sub-area word, the row after it, and a longer or prefixed cell are still skipped with a note",
  sub.notes.filter((n) => /has no status/.test(n)),
  ["unit Garage has no status — skipped", "unit Roof has no status — skipped", "unit Mezzanine level has no status — skipped",
   "unit Shared Storage has no status — skipped"]);
const subAfterBlank = await P.parsePriceList(workbook([
  subHdr,
  ["1st", "A1", "80", "300000", "Available"],
  ["", "", "", "", ""],
  ["", "Mezzanine", "20", "", ""],
]));
check("a blank row closes the unit: a sub-area after it is skipped, not added",
  [subAfterBlank.units.map((u) => u.areaBuilt), subAfterBlank.notes.some((n) => /Mezzanine has no status/.test(n))], [[80], true]);

/* Review M2: a continuation row's common area and plot add to its unit like
   every other area — and are counted once, not copied from the unit. */
const commonRows = await P.parsePriceList(workbook([
  ["Floor", "Unit", "Covered Internal Area (sqm)", "Common Area (sqm)", "Plot Area (sqm)", "Price €", "Availability"],
  ["Ground", "Shop", "80", "10", "", "300000", "Available"],
  ["", "Mezzanine", "20", "5", "", "", ""],
  ["", "B1", "70", "8", "150", "250000", "Available"],
  ["", "Roof Garden", "", "", "12", "", ""],
  ["", "C1", "60", "6", "100", "", "Sold"],
  ["", "Storage", "4", "", "", "", ""],
]));
check("a continuation row's common area and plot are added, once",
  commonRows.units.map((u) => [u.ref, u.areaBuilt, u.areaCommon, u.areaPlot]),
  [["Shop", 100, 15, null], ["B1", 70, 8, 162], ["C1", 64, 6, 100]]);
const villaCommon = await P.parsePriceList(workbook([
  ["Block", "Floor", "Unit", "Covered Internal Area (sqm)", "Common Area (sqm)", "Plot Area (sqm)", "Price €", "Availability"],
  ["D-Villas", "Villa 1", "Lower Floor", "60", "4", "300", "400000", "Available"],
  ["", "", "Upper Floor", "50", "2", "", "", ""],
]));
check("a villa's upper storey adds its common area; the plot is not doubled",
  villaCommon.units.map((u) => [u.ref, u.areaBuilt, u.areaCommon, u.areaPlot]), [["D-Villas Villa 1", 110, 6, 300]]);

/* ── a ref that repeats in a project carries its floor ───────────────────
   Operator's decision, 2026-09-26 ("Etage anhängen"). Plus 92 has no block
   and five floors of "Office 1/2/3", so the bare label repeats. Each
   duplicated unit becomes "<ref> (<floor>)", the floor exactly as written —
   including the sheet's own typo "Firstl Floor". The label is unchanged, and
   the Shop, whose ref is unique, keeps it as it is. */
check("Plus 92: Office 1 on all five floors",
  p92.units.filter((u) => u.label === "Office 1").map((u) => u.ref),
  ["Office 1 (Firstl Floor)", "Office 1 (Second Floor)", "Office 1 (Third Floor)", "Office 1 (Fourth Floor)", "Office 1 (Fifth Floor)"]);
check("Plus 92: every ref is unique", new Set(p92.units.map((u) => u.ref)).size, 16);
check("Plus 92: labels are unchanged, the unique Shop ref too",
  [p92.units.filter((u) => u.label === "Office 3").length, shop92?.ref, shop92?.label], [5, "Shop", "Shop"]);
check("Plus 92: no 'cannot be told apart' note", p92.notes.filter((n) => /cannot be told apart/.test(n)), []);
const refHdr = ["Floor", "Unit", "Price €", "Availability"];
const noFloor = await P.parsePriceList(workbook([
  refHdr,
  ["", "Flat 1", "200000", "Available"],
  ["1st", "Flat 1", "210000", "Available"],
  ["", "Flat 2", "220000", "Available"],
]));
check("a duplicated ref whose floor is missing is kept, with a note",
  [noFloor.units.map((u) => u.ref), noFloor.notes.filter((n) => /repeats/.test(n))],
  [["Flat 1", "Flat 1", "Flat 2"], ['ref "Flat 1" repeats and cannot be told apart by floor']]);
const sameFloor = await P.parsePriceList(workbook([
  refHdr,
  ["1st", "Flat 1", "200000", "Available"],
  ["", "Flat 1", "210000", "Available"],
  ["2nd", "Flat 1", "220000", "Available"],
]));
check("floor-qualified refs that still collide are kept, with a note",
  [sameFloor.units.map((u) => u.ref), sameFloor.notes.filter((n) => /repeats/.test(n))],
  [["Flat 1", "Flat 1", "Flat 1"], ['ref "Flat 1" repeats and cannot be told apart by floor']]);
const clash = await P.parsePriceList(workbook([
  refHdr,
  ["1st", "Flat 1", "200000", "Available"],
  ["2nd", "Flat 1", "210000", "Available"],
  ["", "Flat 1 (1st)", "220000", "Available"],
]));
check("a floor-qualified ref that would take another unit's ref is not used",
  [clash.units.map((u) => u.ref), clash.notes.filter((n) => /repeats/.test(n))],
  [["Flat 1", "Flat 1", "Flat 1 (1st)"], ['ref "Flat 1" repeats and cannot be told apart by floor']]);
const spaced = await P.parsePriceList(workbook([
  refHdr,
  ["First  Floor", "Flat 1", "200000", "Available"],
  ["Second Floor", "Flat 1", "210000", "Available"],
  ["", "Flat 2", "220000", "Available"],
]));
check("the floor is used as written, whitespace collapsed; a unique ref is untouched",
  [spaced.units.map((u) => [u.ref, u.label]), spaced.notes.filter((n) => /repeats/.test(n))],
  [[["Flat 1 (First Floor)", "Flat 1"], ["Flat 1 (Second Floor)", "Flat 1"], ["Flat 2", "Flat 2"]], []]);

/* A villa whose opening row has no status is skipped — and so is its upper
   storey. Without an explicit "open unit", the storey row finds the villa
   before it and adds its bedrooms and bathrooms there. */
const skipped = await P.parsePriceList(workbook([
  ["Block", "Floor", "Unit", "Number of Bedrooms", "Number of Bathrooms", "Covered Internal Area (sqm)", "Price €", "Availability"],
  ["D-Villas", "Villa 1", "Lower Floor", "", "1", "60", "", "Sold"],
  ["", "", "Upper Floor", "2", "2", "50", "", ""],
  ["", "Villa 2", "Lower Floor", "", "1", "55", "310000", ""],
  ["", "", "Upper Floor", "2", "2", "51", "", ""],
]));
check("a skipped villa's upper storey does not land on the villa before it",
  skipped.units.map((u) => [u.ref, u.beds, u.baths, u.areaBuilt]), [["D-Villas Villa 1", "2", "3", 110]]);
check("…and the skip is reported", skipped.notes.some((n) => /Villa 2 has no status — skipped/.test(n)), true);
/* The villa path follows the same ref rule: a villa name that already starts
   with its block's token is the ref as written. */
const villaRef = await P.parsePriceList(workbook([
  ["Block", "Floor", "Unit", "Number of Bedrooms", "Price €", "Availability"],
  ["V", "V1", "Lower Floor", "1", "300000", "Available"],
  ["", "", "Upper Floor", "2", "", ""],
]));
check("a villa name that starts with its block is the ref", villaRef.units.map((u) => u.ref), ["V1"]);

/* House Kiti's only price is the footer "Price:". Written in white it is
   hidden: the house is not read, and the project fails instead of publishing
   a sold house as available at its hidden price. */
const house = (style) => workbook([
  ["Plot Area", "883 SQM"], ["Internal Area", "200 SQM"],
  ["Price:", { v: "880000", s: style }], ["Project Status:", "Ready to move in"],
]);
threw = "";
try { await P.parsePriceList(house("w")); } catch (e) { threw = e instanceof P.PlusParseError ? String(e.message) : `other: ${e}`; }
check("a white house price is absent: the project fails loudly", /no unit table/.test(threw), true);
check("…the same sheet with a black price is read", (await P.parsePriceList(house("k"))).units.map((u) => u.price), [880000]);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
