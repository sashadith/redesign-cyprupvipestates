import { prisma } from "@/lib/prisma";
import {
  aggApiBase, fetchAggProjects, parseShareOneDriveUrl, findAggPricelist, downloadAggPricelist,
  type AggProject, type ShareOneDriveRef, type DiscoveredPricelist,
} from "./agg";
import { extractAggUnits, type AggUnit } from "./ai/aggPricelist";
import { generateProjectDescription } from "./ai/projectDescription";
import { toTitleCaseName } from "@/lib/textCase";
import { normalizeRef } from "./unitRef";
import { recomputeDevelopmentDistances } from "./developmentDistances";
import { recomputeDevelopmentDerivedState } from "./developmentDerivedState";
import { mirrorAll, devKeyFor, beginSyncWindow, scheduleAppRestart } from "./imageMirror";

/* AGG Luxury Homes' two-source sync (2026-08-28) — see src/lib/agg.ts for the two
   sources (WordPress REST for identity/media, a ShareOneDrive folder for the price
   list) and src/lib/ai/aggPricelist.ts for how a slide of unit cards becomes units.

   The shape here differs from every other adapter: identity/media and units live
   apart and are joined by NAME. A price-list project "VASILEON SIGNATURE
   RESIDENCES" is matched to the REST project the site slugs `vasileon`; the REST
   slug is the identity anchor (feedKey "agg:<slug>"), never the price-list name and
   never anything a model produced.

   THE PRICE LIST IS DISCOVERED, NOT PINNED. AGG keep exactly one PDF in the
   "1.Pricelist" folder of their ShareOneDrive root and change only its NAME (the
   export date, "Projects Pricelist 270826 AF.pdf"). Each run walks to that folder,
   reads the current file's name, and — this is the whole trigger — SKIPS unless the
   name differs from the one last synced (DeveloperAccount.driveFileModified). So a
   new upload is picked up automatically (new name → sync), and an unchanged list
   costs two folder-listing calls and nothing more. --force overrides the skip (to
   re-gather photos/description without waiting for a new price list).

   The price list drives which projects exist: a Development is written only for a
   project the list actually sells (its REST twin supplies photos and copy). AGG's
   ~19 completed/portfolio REST projects have no price list and are skipped.

   Everything writes DRAFT. A project matching an existing Development this sync did
   not create (dev !== "agg") is skipped untouched, published projects are frozen,
   and a unit that drops out of the price list flips to "unlisted" (never deleted,
   never silently sold) — the same rules as FEED-ADAPTER-GUIDE.md §4. */

const MAX_IMAGES = 40;

const nn = (v: string | null | undefined) => (v && String(v).trim() ? String(v).trim() : null);
const num = (v: string) => { const n = parseFloat((v || "").replace(/,/g, "")); return Number.isFinite(n) ? String(n) : null; };

// Join key: lower-case alphanumerics, with the noise words that differ between a
// price-list name and a REST title dropped ("VILLAS", "SIGNATURE RESIDENCES",
// "SUITES"). "VICTORIA SUITES" ↔ slug victoriasuites, "MAREASOL VILLAS" ↔
// mareasolvillas, "VASILEON SIGNATURE RESIDENCES" ↔ vasileon all collapse to the
// same key; "KALAMOS DUO" stays distinct from the portfolio "KALAMOS".
const joinKey = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/\b(villas?|signature|residences?|suites?|homes?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

/** Resolve a price-list project name to its REST project. Exact key first, then a
 *  slug/startsWith fallback; a name that matches two REST projects is left
 *  unmatched (reported by the dry run) rather than guessed. */
function matchRestProject(name: string, rest: AggProject[]): AggProject | null {
  const k = joinKey(name);
  const exact = rest.filter((p) => joinKey(p.title) === k || p.slug.replace(/-/g, "") === k);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const partial = rest.filter((p) => joinKey(p.title).startsWith(k) || k.startsWith(joinKey(p.title)));
  return partial.length === 1 ? partial[0] : null;
}

const townFromLocation = (loc: string[]) =>
  /limassol/i.test(loc.join(" ")) ? "Limassol" : /paf|paph/i.test(loc.join(" ")) ? "Paphos" : loc[0] || null;

// Cron fires DAILY; the developer's driveSyncInterval is used only as an on/off
// switch here ("off" disables scheduled runs) — the real "should we sync?" gate is
// the price-list filename, not a timer.
const intervalOff = (i: string | null | undefined) => i === "off";

/* ── Discovery + plan building (no writes) ────────────────────────────────── */

export type AggProjectPlan = {
  feedKey: string;
  feedProjectId: string; // REST slug
  projectName: string; // price-list name
  restSlug: string | null;
  units: AggUnit[];
  priceFrom: number | null;
  priceTo: number | null;
  available: number;
  rest: AggProject | null;
  matchedExisting: { publicName: string; dev: string; publishStatus: string } | null;
};

/** Resolve the account's ShareOneDrive module coordinates from its stored link. */
function aggRef(driveFolderUrl: string): ShareOneDriveRef {
  return parseShareOneDriveUrl(driveFolderUrl);
}

/** Download the price list, parse its units, fetch REST, and match the two by name. */
async function buildAggPlans(
  developerAccountId: string,
  website: string | null,
  ref: ShareOneDriveRef,
  pricelist: DiscoveredPricelist,
): Promise<{ plans: AggProjectPlan[]; notes: string[] }> {
  const base = aggApiBase(website);
  const rest = await fetchAggProjects(base);
  const { buffer } = await downloadAggPricelist(ref, pricelist);
  const units = await extractAggUnits(buffer, rest.map((p) => p.title));

  const existing = await prisma.development.findMany({
    where: { developerAccountId },
    select: { publicName: true, dev: true, publishStatus: true, feedKey: true },
  });
  const byFeedKey = new Map(existing.map((e) => [e.feedKey, e]));

  const notes: string[] = [];
  const byProject = new Map<string, AggUnit[]>();
  for (const u of units) {
    const list = byProject.get(u.project) ?? [];
    list.push(u);
    byProject.set(u.project, list);
  }

  const plans: AggProjectPlan[] = [];
  for (const [projectName, projUnits] of Array.from(byProject.entries())) {
    const restProj = matchRestProject(projectName, rest);
    if (!restProj) notes.push(`No REST match for price-list project "${projectName}" — created without photos/description`);
    const feedProjectId = restProj?.slug || joinKey(projectName) || projectName.toLowerCase().replace(/\s+/g, "-");
    const feedKey = `agg:${feedProjectId}`;
    const prices = projUnits.map((u) => u.price).filter((p): p is number => typeof p === "number");
    const matched = byFeedKey.get(feedKey) ?? null;
    plans.push({
      feedKey, feedProjectId, projectName, restSlug: restProj?.slug ?? null,
      units: projUnits,
      priceFrom: prices.length ? Math.min(...prices) : null,
      priceTo: prices.length ? Math.max(...prices) : null,
      available: projUnits.filter((u) => u.status === "available").length,
      rest: restProj,
      matchedExisting: matched && matched.dev !== "agg" ? { publicName: matched.publicName, dev: matched.dev, publishStatus: matched.publishStatus } : null,
    });
  }
  return { plans, notes };
}

export async function previewAggSync(developerAccountId: string): Promise<{ plans: AggProjectPlan[]; pricelist: DiscoveredPricelist; notes: string[] }> {
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct?.driveFolderUrl) throw new Error("AGG account or its ShareOneDrive link (driveFolderUrl) not found");
  const ref = aggRef(acct.driveFolderUrl);
  const pricelist = await findAggPricelist(ref);
  const { plans, notes } = await buildAggPlans(developerAccountId, acct.website, ref, pricelist);
  return { plans, pricelist, notes };
}

/* ── Dry run (read everything, write nothing) ─────────────────────────────── */

export async function dryRunAggSync(developerAccountId: string) {
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct?.driveFolderUrl) throw new Error("AGG account or its ShareOneDrive link (driveFolderUrl) not found");
  const { plans, pricelist, notes } = await previewAggSync(developerAccountId);
  const projects = plans.map((p) => ({
    project: p.projectName,
    restSlug: p.restSlug,
    feedKey: p.feedKey,
    units: p.units.length,
    available: p.available,
    priceFrom: p.priceFrom,
    priceTo: p.priceTo,
    images: p.rest?.images.length ?? 0,
    brochures: p.rest?.pdfs.length ?? 0,
    skippedReason: p.matchedExisting ? `matches existing "${p.matchedExisting.publicName}" (dev:${p.matchedExisting.dev}) — never overwritten` : null,
  }));
  const totalUnits = plans.reduce((n, p) => n + p.units.length, 0);
  return {
    ok: true as const,
    pricelistFile: pricelist.name,
    changedSinceLastSync: pricelist.name !== acct.driveFileModified,
    lastSyncedFile: acct.driveFileModified,
    projects,
    notes,
    summary: `${plans.length} price-list projects, ${totalUnits} units; current file "${pricelist.name}"${pricelist.name !== acct.driveFileModified ? " (CHANGED — a real run would sync)" : " (unchanged — a real run would skip)"}`,
  };
}

/* ── Write (DRAFT) ─────────────────────────────────────────────────────────── */

export type AggWriteResult = {
  created: { project: string; units: number }[];
  updated: { project: string; units: number }[];
  skippedExisting: { project: string; reason: string }[];
  skippedEmpty: string[];
  notes: string[];
  notDue?: string;
  pricelistFile?: string;
};

export async function writeAggDraft(developerAccountId: string, opts: { force?: boolean; respectInterval?: boolean } = {}): Promise<AggWriteResult> {
  const acct = await prisma.developerAccount.findUnique({ where: { id: developerAccountId } });
  if (!acct?.driveFolderUrl) throw new Error("AGG account or its ShareOneDrive link (driveFolderUrl) not found");

  // "off" disables scheduled runs entirely (the interval field's only role here).
  if (opts.respectInterval && !opts.force && intervalOff(acct.driveSyncInterval)) {
    return { created: [], updated: [], skippedExisting: [], skippedEmpty: [], notes: [], notDue: "Interval is off — scheduled run skipped." };
  }

  const ref = aggRef(acct.driveFolderUrl);
  // Cheap trigger check FIRST (two folder-listing calls, no download): the current
  // price-list filename vs the one we last synced. Unchanged → do nothing.
  const pricelist = await findAggPricelist(ref);
  if (!opts.force && pricelist.name === acct.driveFileModified) {
    return { created: [], updated: [], skippedExisting: [], skippedEmpty: [], notes: [], notDue: `Price list unchanged ("${pricelist.name}") — skipped.`, pricelistFile: pricelist.name };
  }

  const releaseSyncWindow = beginSyncWindow("agg");
  try {
    const { plans } = await buildAggPlans(developerAccountId, acct.website, ref, pricelist);

    const created: { project: string; units: number }[] = [];
    const updated: { project: string; units: number }[] = [];
    const skippedExisting: { project: string; reason: string }[] = [];
    const skippedEmpty: string[] = [];
    const unlistedNotes: string[] = [];
    let mediaChanged = false;

    for (const plan of plans) {
      if (plan.matchedExisting) {
        skippedExisting.push({ project: plan.projectName, reason: `matches existing "${plan.matchedExisting.publicName}" (dev:${plan.matchedExisting.dev}) — never overwritten` });
        continue;
      }
      const units = plan.units.filter((u) => u.ref.trim());
      if (!units.length) { skippedEmpty.push(plan.projectName); continue; }

      const existingRow = await prisma.development.findUnique({ where: { feedKey: plan.feedKey }, select: { id: true, gallery: true, publishStatus: true } });
      const published = existingRow?.publishStatus === "published";
      // Gather rich content once — for a new project, or a units-only row whose
      // gallery is still empty, or an explicit --force refresh. Never for a
      // published (frozen) project.
      const needsContent = !published && (opts.force || !existingRow || !(existingRow.gallery as string[] | null)?.length);

      const rest = plan.rest;
      const town = rest ? townFromLocation(rest.location) : null;
      const stage = rest?.listingStatus[0] || null;

      let gallery: string[] = [];
      let description: { en: string; de: string; pl: string; ru: string } | null = null;
      const extraFacts: { label: string; value: string }[] = [];

      if (needsContent && rest) {
        const devKey = devKeyFor(plan.feedKey);
        const imageUrls = [rest.featuredImage, ...rest.images.map((i) => i.url)].filter((u): u is string => !!u);
        const uniqueUrls = Array.from(new Set(imageUrls)).slice(0, MAX_IMAGES);
        if (uniqueUrls.length) {
          const m = await mirrorAll(uniqueUrls, devKey);
          gallery = m.urls;
          if (m.anyNew) mediaChanged = true;
        }
        // Brochure PDFs are the developer's own collateral — linked, not mirrored.
        for (const b of rest.pdfs) extraFacts.push({ label: b.title || "Brochure", value: b.url });

        if (rest.description) {
          description = await generateProjectDescription({
            district: "", town: town || "", area: "",
            category: rest.propertyType.join(", "),
            stage: stage || "",
            projectAmenities: [], unitAmenities: [],
            unitSummary: `${units.length} units, ${plan.available} available`,
            sourceText: rest.description,
            words: 130,
          }).catch(() => null);
        }
      }

      const dev = await prisma.development.upsert({
        where: { feedKey: plan.feedKey },
        create: {
          developerAccountId, dev: "agg", feedProjectId: plan.feedProjectId, feedKey: plan.feedKey,
          developerName: plan.projectName, publicName: rest ? toTitleCaseName(rest.title) : toTitleCaseName(plan.projectName),
          developer: acct.name,
          category: rest?.propertyType.join(", ") || null,
          status: stage, stage, town,
          currency: "EUR",
          publishStatus: "draft",
          unitsTotal: units.length, unitsAvailable: plan.available,
          priceFrom: plan.priceFrom, priceTo: plan.priceTo,
          syncedAt: new Date(),
          ...(gallery.length ? { gallery } : {}),
          ...(extraFacts.length ? { extraFacts } : {}),
        },
        update: {
          // publicName intentionally NOT updated — an admin may have renamed it.
          category: rest?.propertyType.join(", ") || undefined,
          status: stage ?? undefined, stage: stage ?? undefined, town: town ?? undefined,
          unitsTotal: units.length, unitsAvailable: plan.available,
          priceFrom: plan.priceFrom, priceTo: plan.priceTo,
          syncedAt: new Date(),
          ...(gallery.length ? { gallery } : {}),
          ...(extraFacts.length ? { extraFacts } : {}),
        },
      });
      await recomputeDevelopmentDistances(dev.id);

      if (description) {
        await prisma.developmentOverride.upsert({
          where: { developmentId: dev.id },
          create: { developmentId: dev.id, descriptionEN: description.en, descriptionDE: description.de, descriptionPL: description.pl, descriptionRU: description.ru },
          update: { descriptionEN: description.en, descriptionDE: description.de, descriptionPL: description.pl, descriptionRU: description.ru },
        });
      }

      // Units — matched on feedRef (the price list's own per-project key), never on
      // the admin-editable `ref`. `ref`/`label` belong to the admin once a row exists.
      const existingUnits = await prisma.developmentUnit.findMany({
        where: { developmentId: dev.id },
        select: { id: true, ref: true, feedRef: true, source: true, status: true, label: true, name: true },
      });
      const existingByKey = new Map(
        existingUnits.filter((u) => u.feedRef || u.ref).map((u) => [normalizeRef((u.feedRef || u.ref || "").toString(), plan.projectName), u]),
      );
      const touchedIds = new Set<string>();

      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const syncedFields = {
          feedRef: u.ref,
          type: nn(u.type),
          price: typeof u.price === "number" ? Math.round(u.price) : null,
          status: u.status,
          beds: nn(u.beds),
          baths: nn(u.baths),
          areaBuilt: num(u.areaBuilt),
          areaInternal: num(u.areaInternal),
          areaPlot: num(u.areaPlot),
          areaVeranda: num(u.areaVeranda),
          areaVerandaOpen: num(u.areaVerandaOpen),
          floor: nn(u.floor),
          unitNumber: nn(u.unit.split(/\s+/).pop() || ""), // "APARTMENT A101" → "A101"
          guestWc: u.guestWc || null,
          sortIndex: i,
        };
        const existingUnit = existingByKey.get(normalizeRef(u.ref, plan.projectName));
        if (existingUnit) {
          touchedIds.add(existingUnit.id);
          await prisma.developmentUnit.update({ where: { id: existingUnit.id }, data: syncedFields });
        } else {
          const createdUnit = await prisma.developmentUnit.create({ data: { developmentId: dev.id, ref: u.ref, label: u.label, ...syncedFields } });
          touchedIds.add(createdUnit.id);
        }
      }
      await recomputeDevelopmentDerivedState(dev.id);

      // A unit no longer in the price list → "unlisted": not deleted, not marked
      // sold, keeps its history, drops off public surfaces, and returns if the next
      // list has it. Manual, already-sold and already-unlisted rows are untouched.
      const vanished = existingUnits.filter((eu) => eu.source !== "manual" && !touchedIds.has(eu.id) && eu.status !== "sold" && eu.status !== "unlisted");
      if (vanished.length) {
        await prisma.developmentUnit.updateMany({ where: { id: { in: vanished.map((u) => u.id) } }, data: { status: "unlisted" } });
        await recomputeDevelopmentDerivedState(dev.id);
        unlistedNotes.push(`${plan.projectName}: ${vanished.length} unit(s) no longer in the list → unlisted (${vanished.slice(0, 5).map((u) => u.ref || u.label || u.name || u.id).join(", ")})`);
      }

      (existingRow ? updated : created).push({ project: plan.projectName, units: units.length });
    }

    if (mediaChanged) scheduleAppRestart();
    // Stamp the filename we just synced — the trigger for the NEXT run's skip check.
    await prisma.developerAccount.update({
      where: { id: developerAccountId },
      data: { driveSyncedAt: new Date(), driveFileModified: pricelist.name },
    });

    return { created, updated, skippedExisting, skippedEmpty, notes: unlistedNotes, pricelistFile: pricelist.name };
  } finally {
    releaseSyncWindow();
  }
}
