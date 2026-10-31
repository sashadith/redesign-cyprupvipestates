#!/usr/bin/env node
/* Set the construction stage on developments.
 *
 *   node --import tsx --env-file=.env.local scripts/development-stage.mjs <file.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/development-stage.mjs <file.json> --apply  # write
 *
 * Input: { "feedKeyPrefix": "manual:marinakis-", "source": "…", "projects": { "<slug>": "Off Plan", … } }
 * A project mapped to null has its stage CLEARED (the page falls back to
 * Development.stage); a project not listed is left alone.
 *
 * Writes only `stage` on DevelopmentOverride. Never on Development: feedSync.ts
 * rewrites that column on every run and silently reverted an admin's choice
 * once already (Celestia, 2026-07-17/18) — the move to the override table is
 * what fixed it, and writing the feed column here would undo that.
 *
 * The value must be one the admin dropdown offers, and it is checked by running
 * resolveStageLabel in all five languages: a free-typed value is NOT translated,
 * it is printed raw, so a German visitor would read an English word. */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { resolveStageLabel } from "../src/lib/developmentAvailability.ts";
import { LOCALES } from "../src/lib/locale.ts";

// Exactly the admin dropdown's options (developments/[id]/page.tsx).
const STAGES = ["Available", "Off Plan", "Under Construction", "Key-Ready", "Sold"];

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) {
  console.error("usage: development-stage.mjs <file.json> [--apply]");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const prefix = data.feedKeyPrefix;
if (!prefix) throw new Error("feedKeyPrefix is required");

const problems = [];
console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}`);
if (data.source) console.log(`source: ${data.source}`);
console.log();

for (const [slug, raw] of Object.entries(data.projects)) {
  const feedKey = `${prefix}${slug}`;
  const d = await prisma.development.findFirst({
    where: { feedKey },
    select: { id: true, publicName: true, publishStatus: true, stage: true, status: true, override: { select: { stage: true } } },
  });
  if (!d) {
    problems.push(`${feedKey}: no development with that feedKey`);
    continue;
  }

  const before = d.override?.stage ?? null;
  const value = raw == null ? null : String(raw).trim();

  if (value) {
    if (!STAGES.includes(value)) {
      problems.push(`${d.publicName}: "${value}" is not one of ${STAGES.join(" / ")} — a free-typed value is printed raw, untranslated`);
      continue;
    }
    // Prove it localizes rather than falling through to the raw English.
    const labels = LOCALES.map((l) => `${l}:${resolveStageLabel(value, d.status, l)}`);
    const untranslated = LOCALES.filter((l) => l !== "en" && resolveStageLabel(value, d.status, l) === value);
    if (untranslated.length) {
      problems.push(`${d.publicName}: "${value}" is not localized for ${untranslated.join(", ")} — it would print in English`);
      continue;
    }
    console.log(`${d.publicName.padEnd(18)} ${d.publishStatus.padEnd(9)} ${before ?? "—"} → ${value}   (feed column says ${d.stage ?? "—"})`);
    console.log(`${" ".repeat(18)} ${labels.join("  ")}`);
  } else {
    console.log(`${d.publicName.padEnd(18)} ${d.publishStatus.padEnd(9)} ${before ?? "—"} → — (cleared, falls back to feed "${d.stage ?? "—"}")`);
  }

  if (APPLY && before !== value) {
    await prisma.developmentOverride.upsert({
      where: { developmentId: d.id },
      update: { stage: value },
      create: { developmentId: d.id, stage: value },
    });
    console.log(`${" ".repeat(18)} written → /admin/developments/${d.id}${d.publishStatus === "published" ? "  (LIVE page)" : ""}`);
  }
}

console.log();
if (problems.length) {
  console.error("REFUSING — fix these first:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  await prisma.$disconnect();
  process.exit(1);
}
console.log(APPLY ? "done" : "dry run clean — re-run with --apply");
await prisma.$disconnect();
