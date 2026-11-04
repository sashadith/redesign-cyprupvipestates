#!/usr/bin/env node
/* Set the delivery/completion date on developments, from what a developer has
 * actually told us.
 *
 *   node --import tsx --env-file=.env.local scripts/development-completion.mjs <file.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/development-completion.mjs <file.json> --apply  # write
 *
 * Input: { "feedKeyPrefix": "manual:marinakis-", "source": "…", "projects": { "<slug>": "Q2 2027", … } }
 * A project mapped to null has its completion CLEARED; a project not listed is
 * left alone.
 *
 * Writes only `completion` on DevelopmentOverride — the admin-owned side, which
 * sync never touches (Development.completion is feed territory and gets
 * rewritten; the same reason `stage` lives here, see schema.prisma).
 *
 * The value must be a form src/lib/completionDate.ts can actually read, which
 * the script checks by running it: a quarter ("Q2 2027"), a month and year
 * ("October 2027"), a bare year, or a relative phrase ("18 months from
 * signing", which renders as a quarter counted from today and rolls forward).
 * Anything else is refused rather than stored — an unparseable string sorts
 * behind every real date in "completion: soonest" and silently loses the
 * project its place.
 *
 * It also refuses a date already in the past, because that is almost always a
 * typo'd year, and prints which projects go live with the change. */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { resolveRelativeCompletion, completionSortKey, isCompletionPast } from "../src/lib/completionDate.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
const ALLOW_PAST = process.argv.includes("--allow-past");
if (!file) {
  console.error("usage: development-completion.mjs <file.json> [--apply] [--allow-past]");
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
    select: { id: true, publicName: true, publishStatus: true, completion: true, override: { select: { completion: true } } },
  });
  if (!d) {
    problems.push(`${feedKey}: no development with that feedKey`);
    continue;
  }

  const before = d.override?.completion ?? null;
  const value = raw == null ? null : String(raw).trim();

  if (value) {
    // Run the real reader. If it cannot turn this into a sort key, the page can
    // show it but every ordering and "is it past" check downstream gives up.
    const shown = resolveRelativeCompletion(value);
    const key = completionSortKey(value);
    if (key == null) {
      problems.push(`${d.publicName}: "${value}" is not a form completionDate.ts can read (quarter, month+year, year, or "N months from signing")`);
      continue;
    }
    if (!ALLOW_PAST && isCompletionPast(value)) {
      problems.push(`${d.publicName}: "${value}" is already past — a typo'd year? (--allow-past to store it anyway)`);
      continue;
    }
    const rolls = shown !== value;
    console.log(
      `${d.publicName.padEnd(20)} ${d.publishStatus.padEnd(9)} ${before ?? "—"} → ${value}` +
        (rolls ? `   (renders as ${shown}, recomputed from today on every request)` : "")
    );
  } else {
    console.log(`${d.publicName.padEnd(20)} ${d.publishStatus.padEnd(9)} ${before ?? "—"} → — (cleared)`);
  }

  if (APPLY && before !== value) {
    await prisma.developmentOverride.upsert({
      where: { developmentId: d.id },
      update: { completion: value },
      create: { developmentId: d.id, completion: value },
    });
    console.log(`${" ".repeat(20)} written → /admin/developments/${d.id}${d.publishStatus === "published" ? "  (LIVE page)" : ""}`);
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
