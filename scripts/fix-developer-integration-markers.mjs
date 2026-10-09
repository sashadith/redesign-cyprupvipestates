#!/usr/bin/env node
/* One-off repair: internal integration markers in the PUBLIC developer label.
   Companion to src/lib/developerPublicLabel.ts, which stops the write paths
   creating new ones.

   `DeveloperAccount.name` is an admin label whose trailing parenthetical names
   the integration method on purpose ("BBF (API)", "Korantina Homes
   (SharePoint)"). Six folder-based adapters and the admin's manual-create
   action copied it into `Development.developer`, which is public: the project
   page prints it as "Developer: …" and DevelopmentSchema emits it as the
   JSON-LD offers.seller.name. On 2026-10-09 that was live on 34 published
   pages.

   The target label comes from the SAME two layers as the runtime helper, so
   the repaired rows match what a future sync would write:
     1. the linked public developer page's own title (Developer.title, reached
        via DeveloperAccount.developerTranslationGroupId — a human-reviewed
        link), which is the brand as the public site already spells it;
     2. failing that, the account name with its recognised marker stripped.

   Dry run (prints the plan, writes nothing):
     node --env-file=.env.local scripts/fix-developer-integration-markers.mjs

   Apply:
     node --env-file=.env.local scripts/fix-developer-integration-markers.mjs --apply

   NOTE: .env.local points at PRODUCTION. Read the plan before applying. */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

// Kept in sync with INTEGRATION_MARKERS in src/lib/developerPublicLabel.ts.
const MARKERS = new Set(["api", "cc", "csv", "drive", "dropbox", "feed", "json",
                         "manual", "onedrive", "portal", "scrape", "sharepoint", "xml"]);

function strip(name) {
  const m = String(name).match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!m) return String(name).trim();
  if (!MARKERS.has(m[2].trim().toLowerCase())) return String(name).trim();
  return m[1].trim() || String(name).trim();
}

const rows = await prisma.development.findMany({
  select: {
    id: true, slug: true, publicName: true, developer: true, dev: true, publishStatus: true,
    developerAccount: { select: { name: true, developerTranslationGroupId: true } },
  },
  orderBy: [{ developer: "asc" }, { publicName: "asc" }],
});

const affected = rows.filter((r) => r.developer && strip(r.developer) !== r.developer);

// Resolve each distinct bad label once.
const titleCache = new Map();
async function target(r) {
  const gid = r.developerAccount?.developerTranslationGroupId ?? null;
  const fallback = strip(r.developer);
  if (!gid) return { label: fallback, via: "stripped (account not linked to a public page)" };
  if (!titleCache.has(gid)) {
    const t = await prisma.developer.findMany({
      where: { translationGroupId: gid }, select: { language: true, title: true },
    });
    titleCache.set(gid, (t.find((x) => x.language === "en") ?? t[0])?.title?.trim() || null);
  }
  const title = titleCache.get(gid);
  return title ? { label: title, via: "public developer page title" }
               : { label: fallback, via: "stripped (linked page has no title)" };
}

const plan = [];
for (const r of affected) plan.push({ r, ...(await target(r)) });

const byLabel = new Map();
for (const p of plan) {
  const k = `${p.r.developer} → ${p.label}`;
  if (!byLabel.has(k)) byLabel.set(k, { via: p.via, rows: [] });
  byLabel.get(k).rows.push(p);
}

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${affected.length} row(s) carry an integration marker\n`);
for (const [k, g] of [...byLabel].sort()) {
  const pub = g.rows.filter((p) => p.r.publishStatus === "published").length;
  console.log(`${k}`);
  console.log(`   source: ${g.via}`);
  console.log(`   ${g.rows.length} row(s), ${pub} published`);
  for (const p of g.rows) {
    console.log(`     [${p.r.publishStatus}] ${p.r.publicName}  (adapter=${p.r.dev}, /projects/${p.r.slug ?? "—"})`);
  }
  console.log();
}

if (!APPLY) {
  console.log("Nothing written. Re-run with --apply to write these labels.");
} else {
  let n = 0;
  for (const p of plan) {
    if (p.label === p.r.developer) continue;
    await prisma.development.update({ where: { id: p.r.id }, data: { developer: p.label } });
    n++;
  }
  console.log(`Updated ${n} row(s).`);
  const left = (await prisma.development.findMany({ select: { developer: true } }))
    .filter((r) => r.developer && strip(r.developer) !== r.developer).length;
  console.log(`Rows still carrying a marker: ${left}`);
  /* No revalidate or deploy needed: /[lang]/projects/[slug] is force-dynamic
     (see the comment above its `dynamic` export), so the corrected label and
     its JSON-LD are live on the next request. */
  console.log("\n/projects/<slug> is force-dynamic — the new label is live immediately.");
}
await prisma.$disconnect();
