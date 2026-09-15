#!/usr/bin/env node
// Counts Hebrew placeholder markers. Every `he:` copy entry that still equals
// English is tagged `TODO(he)`; Phase 4 drives this to zero and Phase 8's
// launch check refuses to pass while any remain.
import { execSync } from "node:child_process";
const out = execSync(`grep -rn "TODO(he)" src --include='*.ts' --include='*.tsx' || true`, { encoding: "utf8" }).trim();
const lines = out ? out.split("\n") : [];
const byFile = {};
for (const l of lines) { const f = l.split(":")[0]; byFile[f] = (byFile[f] ?? 0) + 1; }
for (const [f, n] of Object.entries(byFile).sort()) console.log(String(n).padStart(4), f);
console.log(`\nTODO(he) placeholders: ${lines.length}`);
if (process.argv.includes("--strict") && lines.length) process.exit(1);
