#!/usr/bin/env node
/* Attach extra links (project video / 360° tour / virtual walkthrough / project
 * camera) to developments — the buttons that render under the description.
 *
 *   node --import tsx --env-file=.env.local scripts/development-extra-links.mjs <file.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/development-extra-links.mjs <file.json> --apply  # write
 *
 * Input: { "feedKeyPrefix": "manual:dta-", "projects": { "<slug>": [{ kind, url }, … ] } }
 * where <slug> is the part after the prefix. A project listed with an empty
 * array has its links cleared; a project NOT listed is left alone, so this file
 * never has to enumerate a developer's whole portfolio to change one project.
 *
 * Writes only `extraLinks` on DevelopmentOverride. Everything else on that row —
 * descriptions, promo blocks, gallery, SEO — is untouched, so this can run
 * against a project whose copy is already live.
 *
 * Every URL goes through the same parseExtraLinks the page uses, and the script
 * REFUSES to write if the parser drops anything: a silently-dropped row would
 * look identical to a typo that nobody notices. It also HEAD-checks each URL and
 * refuses on a non-2xx, because a dead link behind a button is worse than no
 * button — pass --skip-reachability to write anyway (a camera stream behind auth,
 * say). */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { parseExtraLinks, EXTRA_LINK_KINDS } from "../src/lib/developmentExtraLinks.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
const SKIP_REACH = process.argv.includes("--skip-reachability");
if (!file) {
  console.error("usage: development-extra-links.mjs <file.json> [--apply] [--skip-reachability]");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const prefix = data.feedKeyPrefix;
if (!prefix) throw new Error("feedKeyPrefix is required");

const problems = [];

async function reachable(url) {
  // HEAD first; some hosts answer 405 to HEAD but serve a GET fine (YouTube
  // does), so fall back rather than calling a working link dead.
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(20000) });
      if (r.ok) return { ok: true, status: r.status };
      if (method === "GET") return { ok: false, status: r.status };
    } catch (e) {
      if (method === "GET") return { ok: false, status: String(e?.message ?? e).slice(0, 60) };
    }
  }
  return { ok: false, status: "?" };
}

console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}\n`);

for (const [slug, links] of Object.entries(data.projects)) {
  const feedKey = `${prefix}${slug}`;
  const d = await prisma.development.findFirst({
    where: { feedKey },
    select: { id: true, publicName: true, publishStatus: true, override: { select: { extraLinks: true } } },
  });
  if (!d) {
    problems.push(`${feedKey}: no development with that feedKey`);
    continue;
  }

  // The page's own parser decides what survives. Anything it drops is a bug in
  // the input, not something to write and hope about.
  const parsed = parseExtraLinks(links);
  if (parsed.length !== links.length) {
    const kept = new Set(parsed.map((l) => l.kind));
    const lost = links.filter((l) => !kept.has(l.kind)).map((l) => `${l.kind}=${l.url}`);
    problems.push(`${d.publicName}: parser dropped ${lost.length} of ${links.length} — ${lost.join(", ")}`);
    continue;
  }
  for (const l of parsed) {
    if (!EXTRA_LINK_KINDS.includes(l.kind)) problems.push(`${d.publicName}: unknown kind ${l.kind}`);
  }

  const before = parseExtraLinks(d.override?.extraLinks);
  const checks = [];
  for (const l of parsed) {
    if (SKIP_REACH) { checks.push(`${l.kind} (unchecked)`); continue; }
    const r = await reachable(l.url);
    if (!r.ok) problems.push(`${d.publicName}: ${l.kind} → ${l.url} answered ${r.status}`);
    checks.push(`${l.kind} ${r.ok ? `${r.status} ok` : `${r.status} DEAD`}`);
  }

  const same = JSON.stringify(before) === JSON.stringify(parsed);
  console.log(
    `${d.publicName} (${d.publishStatus}) — ${before.length} → ${parsed.length} link(s)` +
      `${same ? " (unchanged)" : ""}`
  );
  for (const l of parsed) console.log(`    ${l.kind.padEnd(12)} ${l.url}`);
  if (checks.length) console.log(`    reachability: ${checks.join(" · ")}`);

  if (APPLY && !same) {
    await prisma.developmentOverride.upsert({
      where: { developmentId: d.id },
      update: { extraLinks: parsed.length ? parsed : null },
      create: { developmentId: d.id, extraLinks: parsed.length ? parsed : null },
    });
    console.log(`    written → /admin/developments/${d.id}`);
  }
  console.log();
}

if (problems.length) {
  console.error("REFUSING — fix these first:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  await prisma.$disconnect();
  process.exit(1);
}
console.log(APPLY ? "done" : "dry run clean — re-run with --apply");
await prisma.$disconnect();
