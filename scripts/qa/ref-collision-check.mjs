#!/usr/bin/env node
/* Finds units inside one development whose refs collapse to the SAME
   reconciliation key — the key every ref-matching writer uses to decide which
   existing row an incoming price-list row belongs to.

   Written after Georgia 12 (A&B), 2026-10-05. That project has two blocks of
   nine flats; the block lived only in `label`, so both "Block A · 101" and
   "Block B · 101" carried ref "101". driveAvailabilitySync builds
   `existingByKey` as a Map, so the second row silently overwrote the first and
   only ONE of the two was ever reachable: every weekly sync wrote Block A's
   price onto Block B's row, and Block B's nine flats were advertised
   €15,000–20,000 above their real price for three weeks. The nine orphaned rows
   escaped the sync's pruning only because they happened to be source:"manual".
   Nothing in the system said a word — the collision is invisible by
   construction, which is exactly why it needs a sweep rather than a guard at
   the write site.

   The writers that reconcile on this key:
     ref              — driveAvailabilitySync, dropboxAvailabilitySync,
                        cybarcoSync, and ClientPresentationItem.unitRefs
                        (src/app/c/[token]/page.tsx), where a collision instead
                        drops units from a client presentation.
     feedRef || ref   — aggSync.
   Both keyings are checked, because a project can collide under one and not the
   other.

     node --env-file=.env.local scripts/qa/ref-collision-check.mjs

   Read-only. Exits 1 if any development holds a collision. */
import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

/* Keyings, in the order they are reported. `pick` mirrors the writer's own
   expression exactly — aggSync reads feedRef first and falls back to ref. */
export const KEYINGS = [
  { name: "ref", pick: (u) => u.ref ?? "", writers: "drive, dropbox, cybarco, client presentations" },
  { name: "feedRef||ref", pick: (u) => u.feedRef || u.ref || "", writers: "agg" },
];

/* The writers skip a unit whose raw ref is falsy, so a row without one cannot
   collide with anything — it is simply never matched. A ref that NORMALIZES to
   the empty string is a different animal: "Villa" and "Unit" are both truthy,
   both survive that check, and both land on key "" together. That is a real
   collision and is reported, flagged separately because the fix is different
   (the refs carry no identifying content at all, rather than being ambiguous). */
export function collisionsFor(dev, normalize) {
  const groups = new Map(); // memberIds (sorted, joined) -> group
  for (const keying of KEYINGS) {
    const byKey = new Map();
    for (const u of dev.units) {
      const raw = keying.pick(u);
      if (!raw) continue;
      const key = normalize(String(raw), dev.publicName ?? "");
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(u);
    }
    for (const [key, members] of byKey) {
      if (members.length < 2) continue;
      const id = members.map((m) => m.id).sort().join("|");
      const existing = groups.get(id);
      if (existing) existing.keyings.push(keying.name);
      else groups.set(id, { key, members, keyings: [keying.name] });
    }
  }
  return [...groups.values()];
}

/* The writers that reconcile existing rows by key, and therefore the ones a
   collision actually costs something in. A development synced any other way
   (or not at all) can still hold duplicate rows worth seeing, but nothing will
   freeze or delete them behind your back. */
export const SYNC_RECONCILED = new Set(["drive", "dropbox", "agg", "cybarco"]);

/* What a collision actually costs, per group. Three independent things can be
   true at once, so these are flags rather than a single severity level. */
export function flagsFor(group, dev) {
  const flags = [];

  /* Two different defects share this symptom, and conflating them buries the
     worse one. If every member carries the same label, the rows are repeats of
     ONE flat — the duplicate-unit bug fixed for Vision in 2026-09-23 and still
     open on the BBF projects; the cure is deleting rows. If the labels differ,
     these are genuinely different flats filed under one key — Georgia 12's
     shape, where the cure is giving them distinguishable refs, and where a sync
     will keep writing one flat's price onto another's until someone does. */
  const labels = new Set(group.members.map((m) => (m.label ?? "").trim().toLowerCase()));
  flags.push(labels.size === 1 ? "DUPLICATE-ROWS" : "DISTINCT-UNITS");

  if (group.key === "") flags.push("EMPTY-KEY");

  // Already visibly wrong: the rows the writer treats as one unit disagree.
  const prices = new Set(group.members.map((m) => m.price ?? "—"));
  const statuses = new Set(group.members.map((m) => m.status ?? "—"));
  if (prices.size > 1 || statuses.size > 1) flags.push("DIVERGED");

  // Only one member is reachable; the writer's Map keeps the last one it saw.
  // Which one that is depends on row order, so name none of them — the point is
  // that the others are frozen, whichever they turn out to be.
  if (SYNC_RECONCILED.has(dev.dev)) {
    flags.push("UNREACHABLE");
    // Pruning deletes rows the sync did not touch, sparing only source:"manual".
    // An unreachable row that is not manual is therefore a deletion candidate.
    if (group.members.some((m) => m.source !== "manual")) flags.push("PRUNABLE");
  }
  return flags;
}

const money = (n) => (n == null ? "—" : "€" + n.toLocaleString("en-US"));
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

async function loadNormalizeRef() {
  // Bundle the real thing rather than restating the rules here: normalizeRef
  // carries several narrowly-guarded block-letter cases, and a copy of them in
  // this script would drift and then quietly disagree with the writers it is
  // supposed to be checking.
  const scratch = join(process.cwd(), "node_modules", ".ref-collision-check");
  mkdirSync(scratch, { recursive: true });
  process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
  const out = await build({
    entryPoints: ["src/lib/unitRef.ts"],
    bundle: true, platform: "node", format: "esm", write: false,
  });
  const f = join(scratch, "unitRef.mjs");
  writeFileSync(f, out.outputFiles[0].text);
  return (await import(f)).normalizeRef;
}

async function main() {
  const normalize = await loadNormalizeRef();
  const prisma = new PrismaClient();
  const devs = await prisma.development.findMany({
    select: {
      slug: true, publicName: true, developerName: true, dev: true, publishStatus: true,
      units: { select: { id: true, ref: true, feedRef: true, label: true, price: true, status: true, source: true, updatedAt: true } },
    },
    orderBy: { publicName: "asc" },
  });

  /* Report the Georgia 12 shape first. A project can hold dozens of duplicate
     rows and exactly one pair of genuinely different flats sharing a key, and
     that one pair is the one that silently rewrites a price. */
  const findings = [];
  for (const dev of devs) {
    const groups = collisionsFor(dev, normalize).map((g) => ({ ...g, flags: flagsFor(g, dev) }));
    if (groups.length) findings.push({ dev, groups });
  }
  const distinct = (f) => f.groups.filter((g) => g.flags.includes("DISTINCT-UNITS")).length;
  findings.sort((a, b) => distinct(b) - distinct(a));

  let found = 0, unitsAffected = 0, distinctGroups = 0;
  for (const { dev, groups } of findings) {
    found++;
    const name = dev.slug ?? dev.publicName ?? dev.developerName ?? "(unnamed)";
    console.log(`\n${name}  —  ${dev.publicName ?? "—"}  [${dev.dev}, ${dev.publishStatus}, ${dev.units.length} units]`);
    groups.sort((a, b) => Number(b.flags.includes("DISTINCT-UNITS")) - Number(a.flags.includes("DISTINCT-UNITS")));
    for (const g of groups) {
      unitsAffected += g.members.length;
      if (g.flags.includes("DISTINCT-UNITS")) distinctGroups++;
      const flags = g.flags;
      const keyLabel = g.key === "" ? '"" (ref normalizes to nothing)' : `"${g.key}"`;
      console.log(`  key ${keyLabel} via ${g.keyings.join(" + ")} — ${g.members.length} units${flags.length ? "   [" + flags.join(" ") + "]" : ""}`);
      for (const m of g.members)
        console.log(`      ${String(m.label ?? "—").padEnd(18)} ref=${JSON.stringify(m.ref ?? null).padEnd(10)} feedRef=${JSON.stringify(m.feedRef ?? null).padEnd(10)} ${money(m.price).padStart(10)}  ${String(m.status ?? "—").padEnd(10)} ${String(m.source).padEnd(7)} upd ${day(m.updatedAt)}`);
    }
  }

  console.log(
    `\n${devs.length} developments scanned, ${found} with colliding unit refs ` +
    `(${unitsAffected} units, ${distinctGroups} group${distinctGroups === 1 ? "" : "s"} of genuinely DIFFERENT units).`,
  );
  if (found) {
    console.log(
      "\nDISTINCT-UNITS is the one to fix first: different flats under one key, so a\n" +
      "sync can only ever reach one of them and writes its price onto the other. Give\n" +
      "them refs that differ after normalization — normalizeRef keeps a block LETTER,\n" +
      "so \"B 101\" and \"101\" are distinct, as are \"Block B 101\" and \"Block A 101\" —\n" +
      "but note that changing a ref the price list still produces makes the next sync\n" +
      "CREATE a row rather than update it.\n\n" +
      "DUPLICATE-ROWS is the other defect: one flat stored several times (same label).\n" +
      "Those rows need deleting, and the sync that wrote them needs the fix applied to\n" +
      "Vision in syncOneProject. DIVERGED means the rows already disagree today.",
    );
  }
  await prisma.$disconnect();
  if (found) process.exitCode = 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
