import { prisma } from "@/lib/prisma";
import { getPreviewProject, listProjectIds, type ProjectVM } from "@/app/preview-project/feeds";
import type { UnitVM } from "@/app/preview-project/UnitsView";
import { mirrorAll, devKeyFor, scheduleAppRestart } from "@/lib/imageMirror";
import { recomputeDevelopmentDistances } from "@/lib/developmentDistances";

/* Feed sync (Phase 1). Pulls every development of a developer from its feed
   (reusing the feeds.ts adapters → canonical ProjectVM) and upserts into
   Development / DevelopmentUnit, keyed by feedKey ("<dev>:<id>"). Admin edits in
   DevelopmentOverride are NEVER touched. Images are stored as the feed URLs for
   now — the mirroring step (Increment 3) rewrites them to our own URLs. */

const DEV_ACCOUNT: Record<string, { slug: string; name: string }> = {
  "island-blue": { slug: "island-blue", name: "Island Blue" },
  inex: { slug: "inex", name: "INEX" },
  bbf: { slug: "bbf", name: "BBF" },
  aristo: { slug: "aristo", name: "Aristo" },
  pafilia: { slug: "pafilia", name: "Pafilia" },
  domenica: { slug: "domenica", name: "Domenica Group" },
  medousa: { slug: "medousa", name: "Medousa" },
  agg: { slug: "agg", name: "AGG Luxury Homes" },
  squareone: { slug: "square-one", name: "Square One" },
};

async function ensureAccount(dev: string): Promise<string> {
  const meta = DEV_ACCOUNT[dev] ?? { slug: dev, name: dev };
  const acct = await prisma.developerAccount.upsert({
    where: { slug: meta.slug },
    update: {},
    create: { slug: meta.slug, name: meta.name },
  });
  return acct.id;
}

const int = (n: number | null | undefined) => (n != null && Number.isFinite(n) ? Math.round(n) : null);

function developmentRow(vm: ProjectVM, dev: string, feedProjectId: string, accountId: string) {
  const available = vm.units.filter((u) => u.status === "available").length;
  return {
    developerAccountId: accountId,
    dev,
    feedProjectId,
    feedKey: `${dev}:${feedProjectId}`,
    developerName: vm.developerName || vm.publicName || "",
    publicName: vm.publicName || "",
    developer: vm.developer || null,
    category: vm.category || null,
    status: vm.status || null,
    stage: vm.stage || null,
    completion: vm.completion || null,
    energy: vm.energy || null,
    district: vm.district || null,
    town: vm.town || null,
    area: vm.area || null,
    priceFrom: int(vm.priceFrom),
    priceTo: int(vm.priceTo),
    currency: vm.currency || "EUR",
    latitude: vm.center?.lat ?? null,
    longitude: vm.center?.lng ?? null,
    unitsTotal: vm.units.length,
    unitsAvailable: available,
    description: vm.description || null,
    amenities: (vm.amenities ?? []) as any,
    gallery: (vm.gallery ?? []) as any,
    plans: (vm.plans ?? []) as any,
    extraFacts: (vm.extraFacts ?? []) as any,
    syncedAt: new Date(),
  };
}

function unitRow(u: UnitVM, developmentId: string, i: number) {
  return {
    developmentId,
    ref: u.ref || null,
    name: u.name || null,
    label: u.label || null,
    type: u.type || null,
    status: u.status || "available",
    price: int(u.price),
    currency: u.currency || "EUR",
    beds: u.beds || null,
    baths: u.baths || null,
    areaBuilt: u.areaBuilt || null,
    areaPlot: u.areaPlot || null,
    areaVeranda: u.areaVeranda || null,
    floor: u.floor || null,
    latitude: u.coords?.lat ?? null,
    longitude: u.coords?.lng ?? null,
    attrs: (u.attrs ?? []) as any,
    amenities: (u.features ?? []) as any,
    photos: (u.photos ?? []) as any,
    plans: (u.plans ?? []) as any,
    sortIndex: i,
  };
}

export type SyncResult = { dev: string; found: number; created: number; updated: number; failed: number };

// Core loop, no restart side-effect — syncAll() calls this per developer so a
// full run schedules exactly ONE restart at the end, not one per developer.
async function syncDeveloperCore(dev: string, opts: { mirror?: boolean } = {}): Promise<SyncResult> {
  const accountId = await ensureAccount(dev);
  const ids = await listProjectIds(dev);
  let created = 0, updated = 0, failed = 0;
  for (const id of ids) {
    try {
      const vm = await getPreviewProject(dev, id);
      if (!vm) { failed++; continue; }
      const feedKey = `${dev}:${id}`;
      if (opts.mirror) {
        const dk = devKeyFor(feedKey);
        vm.gallery = await mirrorAll(vm.gallery, dk);
        for (const u of vm.units) u.photos = await mirrorAll(u.photos, dk);
      }
      const existing = await prisma.development.findUnique({ where: { feedKey }, select: { id: true } });
      const data = developmentRow(vm, dev, id, accountId);
      const development = existing
        ? await prisma.development.update({ where: { feedKey }, data })
        : await prisma.development.create({ data });
      // Auto recompute (haversine, src/lib/developmentDistances.ts) — resolves
      // override lat/lng first, so a deliberately-corrected admin pin is never
      // clobbered by the feed's own (possibly wrong) coordinates.
      await recomputeDevelopmentDistances(development.id);
      // If a human imported the real unit list (manual units exist), the feed's
      // partial list is ignored entirely — never re-add feed units on top.
      const manualUnits = await prisma.developmentUnit.count({ where: { developmentId: development.id, source: "manual" } });
      if (manualUnits === 0) {
        await prisma.developmentUnit.deleteMany({ where: { developmentId: development.id, source: "feed" } });
        if (vm.units.length) await prisma.developmentUnit.createMany({ data: vm.units.map((u, i) => unitRow(u, development.id, i)) });
      }
      existing ? updated++ : created++;
    } catch {
      failed++;
    }
  }
  return { dev, found: ids.length, created, updated, failed };
}

// Public single-developer entry (admin "Sync now" for one dev, debug route) —
// mirroring writes new files under public/uploads/, so it MUST restart the app
// afterward or a fresh request for one of those URLs 404s into the [lang]/[...slug]
// catch-all and crashes (see the big comment on scheduleAppRestart in imageMirror.ts).
// This bit us in production once already: an unrestarted app after a mirror run
// crash-looped on the first request for a newly-mirrored image.
export async function syncDeveloper(dev: string, opts: { mirror?: boolean } = {}): Promise<SyncResult> {
  const result = await syncDeveloperCore(dev, opts);
  if (opts.mirror) scheduleAppRestart();
  return result;
}

export async function syncAll(opts: { mirror?: boolean } = {}): Promise<SyncResult[]> {
  const devs = ["island-blue", "inex", "bbf", "aristo", "pafilia", "domenica", "medousa", "agg", "squareone"];
  const out: SyncResult[] = [];
  for (const d of devs) out.push(await syncDeveloperCore(d, opts));
  if (opts.mirror) scheduleAppRestart();
  return out;
}
