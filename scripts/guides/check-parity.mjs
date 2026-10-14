// Usage: node scripts/guides/check-parity.mjs <id>   (reads src/lib/guides/content/<id>.{en,de,pl,ru}.json)
// All four languages must have the same structure and the same numbers, block by block.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../src/lib/guides/content");
const id = process.argv[2];
if (!id) { console.error("usage: check-parity.mjs <id>"); process.exit(2); }
const L = ["en", "de", "pl", "ru"];
const docs = Object.fromEntries(L.map((l) => [l, JSON.parse(fs.readFileSync(path.join(dir, `${id}.${l}.json`), "utf8"))]));

/** Numbers in a string, normalised so "300,000", "300.000" and "300 000" compare equal; "2,5" == "2.5". */
export function numbers(s) {
  const out = [];
  for (const m of String(s).matchAll(/\d+(?:[.,   ]\d{3})*(?:[.,]\d+)?/g)) {
    let t = m[0].replace(/[   ]/g, "");
    if (/^\d{1,3}([.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, "");
    else t = t.replace(",", ".");
    out.push(String(Number(t)));
  }
  return out.sort();
}
const flat = (b) => {
  const parts = [];
  const walk = (v) => { if (typeof v === "string") parts.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(b); return parts.join(" ");
};
const shape = (c) => c.sections.map((s) => s.blocks.map((b) => {
  const n = b.type === "table" ? `${b.head.length}x${b.rows.length}` : b.type === "example" ? `${b.rows.length}${b.total ? "+t" : ""}` : (b.items ? b.items.length : "");
  return `${b.type}:${n}`;
}).join(","));
const errs = [];
const en = docs.en;
for (const l of L.slice(1)) {
  const d = docs[l];
  if (d.sections.length !== en.sections.length) { errs.push(`${l}: ${d.sections.length} sections vs en ${en.sections.length}`); continue; }
  const se = shape(en), sl = shape(d);
  se.forEach((x, i) => { if (x !== sl[i]) errs.push(`${l}: section ${i + 1} structure "${sl[i]}" vs en "${x}"`); });
  if (d.keyNumbers.length !== en.keyNumbers.length) errs.push(`${l}: keyNumbers count differs`);
  const cmp = (label, a, b) => { const na = numbers(flat(a)).join(" "), nb = numbers(flat(b)).join(" "); if (na !== nb) errs.push(`${l}: numbers differ in ${label}\n    en: ${na}\n    ${l}: ${nb}`); };
  cmp("keyNumbers", en.keyNumbers.map((k) => k.value), d.keyNumbers.map((k) => k.value));
  cmp("intro", en.intro, d.intro);
  en.sections.forEach((s, i) => d.sections[i] && s.blocks.forEach((b, j) => d.sections[i].blocks[j] && cmp(`section ${i + 1} block ${j + 1} (${b.type})`, b, d.sections[i].blocks[j])));
  cmp("nextSteps", en.nextSteps, d.nextSteps);
}
if (errs.length) { console.error(errs.join("\n")); console.error(`\n${errs.length} parity problem(s) for ${id}`); process.exit(1); }
console.log(`OK: ${id} has identical structure and numbers in en/de/pl/ru`);
