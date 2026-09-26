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

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
