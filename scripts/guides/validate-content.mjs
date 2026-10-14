// Usage: node scripts/guides/validate-content.mjs src/lib/guides/content/<id>.<lang>.json ...
// Structural check of guide content files. Exit code 1 on any problem.
import fs from "fs";
import path from "path";

const LANGS = ["en", "de", "pl", "ru"];
const BLOCK_TYPES = new Set(["p", "bullets", "steps", "table", "callout", "example", "checklist"]);
const errs = [];
const err = (f, m) => errs.push(`${path.basename(f)}: ${m}`);
const str = (v) => typeof v === "string" && v.trim().length > 0;

export function wordsOf(c) {
  const parts = [];
  const walk = (v) => { if (typeof v === "string") parts.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk({ ...c, id: undefined, lang: undefined });
  return parts.join(" ").split(/\s+/).filter(Boolean).length;
}

export function validateFile(f) {
  let c;
  try { c = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return err(f, "not valid JSON: " + e.message); }
  const m = path.basename(f).match(/^([a-z0-9-]+)\.(en|de|pl|ru)\.json$/);
  if (!m) return err(f, "file name must be <id>.<lang>.json");
  if (c.id !== m[1]) err(f, `id "${c.id}" does not match file name`);
  if (c.lang !== m[2]) err(f, `lang "${c.lang}" does not match file name`);
  for (const k of ["title", "subtitle", "edition", "intro", "disclaimer"]) if (!str(c[k])) err(f, `missing ${k}`);
  if (!Array.isArray(c.keyNumbers) || c.keyNumbers.length < 3 || c.keyNumbers.length > 4) err(f, "keyNumbers must have 3-4 entries");
  else c.keyNumbers.forEach((k, i) => { if (!str(k.value) || !str(k.label)) err(f, `keyNumbers[${i}] needs value and label`); else if (k.value.length > 18) err(f, `keyNumbers[${i}].value too long (${k.value.length}); keep it short`); });
  if (!Array.isArray(c.sections) || c.sections.length < 4 || c.sections.length > 7) err(f, "sections must have 4-7 entries");
  else c.sections.forEach((s, si) => {
    if (!str(s.heading)) err(f, `sections[${si}] missing heading`);
    if (!Array.isArray(s.blocks) || !s.blocks.length) return err(f, `sections[${si}] has no blocks`);
    s.blocks.forEach((b, bi) => {
      const at = `sections[${si}].blocks[${bi}]`;
      if (!BLOCK_TYPES.has(b.type)) return err(f, `${at} unknown type "${b.type}"`);
      if (b.type === "p" && !str(b.text)) err(f, `${at} empty paragraph`);
      if (b.type === "bullets" && !(Array.isArray(b.items) && b.items.length >= 2 && b.items.every(str))) err(f, `${at} bullets need >=2 non-empty items`);
      if (b.type === "steps" && !(Array.isArray(b.items) && b.items.length >= 2 && b.items.every((x) => str(x.title) && str(x.text)))) err(f, `${at} steps need >=2 items with title and text`);
      if (b.type === "table") {
        if (!(Array.isArray(b.head) && b.head.length >= 2 && b.head.length <= 5 && b.head.every(str))) err(f, `${at} table head needs 2-5 columns`);
        else if (!(Array.isArray(b.rows) && b.rows.length >= 1 && b.rows.every((r) => Array.isArray(r) && r.length === b.head.length && r.every(str)))) err(f, `${at} table rows must match head width and be non-empty`);
      }
      if (b.type === "callout" && !str(b.text)) err(f, `${at} callout needs text`);
      if (b.type === "example") {
        if (!str(b.title)) err(f, `${at} example needs title`);
        if (!(Array.isArray(b.rows) && b.rows.length >= 2 && b.rows.every((r) => Array.isArray(r) && r.length === 2 && r.every(str)))) err(f, `${at} example rows must be [label, value] pairs (>=2)`);
        if (b.total && !(Array.isArray(b.total) && b.total.length === 2 && b.total.every(str))) err(f, `${at} example total must be [label, value]`);
      }
      if (b.type === "checklist" && !(Array.isArray(b.items) && b.items.length >= 3 && b.items.every(str))) err(f, `${at} checklist needs >=3 items`);
    });
  });
  if (!(c.nextSteps && str(c.nextSteps.heading) && str(c.nextSteps.text))) err(f, "nextSteps needs heading and text");
  const w = wordsOf(c);
  if (w < 800 || w > 2100) err(f, `word count ${w} outside 800-2100`);
  return c;
}

if (process.argv[1] && process.argv[1].endsWith("validate-content.mjs")) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("no files given"); process.exit(2); }
  const parsed = files.map(validateFile);
  if (errs.length) { console.error(errs.join("\n")); console.error(`\n${errs.length} problem(s)`); process.exit(1); }
  console.log(`OK: ${files.length} file(s) valid`, parsed.map((c, i) => `${path.basename(files[i])}=${wordsOf(c)}w`).join(" "));
}
