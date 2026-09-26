#!/usr/bin/env node
/* Ground truth for the Plus Properties parser: the developer's own PDF.
   Their PDF is Excel's printout of the active sheet, so for every unit the
   parser returns, the PDF must show the same status — and, for an available
   unit, the same price. Measured on 2026-09-25 across all projects: 428 of 433
   units matched automatically, 4 more by hand (a PDF row wraps onto the next
   line), and the single difference was a unit the XML already knew had been
   reserved. Run: node scripts/qa/plus-pdf-check.mjs */
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (it is only a transitive dependency)."); process.exit(2); }
const scratch = join(process.cwd(), "node_modules", ".plus-pdf-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const out = await build({ entryPoints: ["src/lib/plusProperties.ts"], bundle: true, platform: "node", format: "esm", write: false,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });
writeFileSync(join(scratch, "p.mjs"), out.outputFiles[0].text);
const P = await import(join(scratch, "p.mjs"));

const DIR = "scripts/qa/fixtures/plus";
const STATUS = /\b(Available|Reserved|Sold)\b/i;
const prices = (s) => Array.from(s.matchAll(/\b\d{1,3}(?:,\d{3})+\b/g)).map((m) => Number(m[0].replace(/,/g, ""))).filter((n) => n >= 20000);
let failures = 0, matched = 0, total = 0;
for (const key of ["33", "57", "87", "63", "59", "67-68-69", "21", "60", "75"]) {
  const pdfPath = join(DIR, `plus-${key}.pdf.txt`);
  if (!existsSync(pdfPath)) { console.log(`  skip Plus ${key}: no PDF fixture`); continue; }
  const lines = readFileSync(pdfPath, "utf8").split("\n");
  const p = await P.parsePriceList(readFileSync(join(DIR, `plus-${key}.xml`), "utf8"));
  const used = new Set();
  const bad = [];
  for (const u of p.units) {
    total++;
    const pat = new RegExp(`(?<![\\w.])${u.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.])`);
    const i = lines.findIndex((l, n) => !used.has(n) && pat.test(l));
    if (i < 0) { bad.push(`${u.ref}: not in PDF`); continue; }
    used.add(i);
    /* A row can wrap: status and price may sit on the next line or two. */
    const window = [lines[i], lines[i + 1] ?? "", lines[i + 2] ?? ""];
    const hitLine = window.find((l) => STATUS.test(l)) ?? "";
    const pdfStatus = (hitLine.match(STATUS)?.[1] ?? "").toLowerCase();
    if (pdfStatus !== u.status) { bad.push(`${u.ref}: status parser=${u.status} pdf=${pdfStatus || "none"}`); continue; }
    if (u.status === "available" && !prices(window.join(" ")).includes(u.price)) {
      bad.push(`${u.ref}: price parser=${u.price} pdf=${prices(window.join(" ")).join("/") || "none"}`); continue;
    }
    matched++;
  }
  console.log(`  ${bad.length ? "FAIL" : "ok  "} Plus ${key}: ${p.units.length - bad.length} of ${p.units.length} units match the PDF`);
  for (const b of bad) console.log(`         ${b}`);
  if (bad.length) failures++;
}
console.log(`\n${matched} of ${total} units match their PDF`);
console.log(failures ? `${failures} project(s) failed` : "all passed");
process.exit(failures ? 1 : 0);
