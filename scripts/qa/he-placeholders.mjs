#!/usr/bin/env node
// Counts Hebrew placeholder markers. Every `he:` copy entry that still equals
// English is tagged `TODO(he)`; once a WP task translates it, the marker
// becomes `REVIEW(he)` until Pass C (native review) removes it entirely.
// Phase 4 drives TODO(he) to zero; Phase 8's launch check refuses to pass
// while either marker remains.
//
//   node scripts/qa/he-placeholders.mjs               prints the per-file table + totals
//   node scripts/qa/he-placeholders.mjs --strict       exit 1 if TODO(he) + REVIEW(he) > 0
//   node scripts/qa/he-placeholders.mjs --todo-only    exit 1 only if TODO(he) > 0 (REVIEW(he) is fine)
import { execSync } from "node:child_process";

function grepMarker(marker) {
  const out = execSync(`grep -rn "${marker}" src --include='*.ts' --include='*.tsx' || true`, { encoding: "utf8" }).trim();
  return out ? out.split("\n") : [];
}

function byFile(lines) {
  const counts = {};
  for (const l of lines) {
    const f = l.split(":")[0];
    counts[f] = (counts[f] ?? 0) + 1;
  }
  return counts;
}

const todoLines = grepMarker("TODO(he)");
const reviewLines = grepMarker("REVIEW(he)");
const todoByFile = byFile(todoLines);
const reviewByFile = byFile(reviewLines);
const files = Array.from(new Set([...Object.keys(todoByFile), ...Object.keys(reviewByFile)])).sort();

console.log("TODO REVIEW  file");
for (const f of files) {
  const t = todoByFile[f] ?? 0;
  const r = reviewByFile[f] ?? 0;
  console.log(`${String(t).padStart(4)} ${String(r).padStart(6)}  ${f}`);
}
console.log(`\nTODO(he): ${todoLines.length}  REVIEW(he): ${reviewLines.length}`);

const todoOnly = process.argv.includes("--todo-only");
const strict = process.argv.includes("--strict");
if (todoOnly) {
  if (todoLines.length > 0) process.exit(1);
} else if (strict) {
  if (todoLines.length + reviewLines.length > 0) process.exit(1);
}
