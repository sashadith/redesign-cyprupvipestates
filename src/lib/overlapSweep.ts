// Nightly legacy Project <-> Development overlap matching (2026-08-03) — the
// live successor to the frozen, one-time candidates.ts heuristic list. Same
// signals as the manual sweep that found azalea-villas-aristo/serenity-court-
// aristo (title + developer-feed-account + coordinates), run automatically
// so future duplicates surface without a manual audit. See DEPLOYMENT.md for
// why this piggybacks on the existing feed-sync cron rather than getting its
// own crontab entry.
import { prisma } from "@/lib/prisma";

const DISTANCE_HIGH_M = 50; // azalea-villas/serenity-court were both <20m apart

const norm = (s: string | null | undefined): string =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Same formula as src/lib/developmentDistances.ts's haversineKm (meters here,
// not km — copied rather than imported/exported to keep this module's own
// change fully self-contained, not a shared-signature dependency on that
// file's internals).
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type OverlapMatchCandidate = {
  legacyProjectId: string;
  developmentId: string;
  confidence: "High" | "Medium";
  matchType: "exact-title" | "fuzzy-title";
  distanceMeters: number | null;
  note: string;
};

// Pure matching pass — no DB writes. Exported separately from
// sweepOverlapCandidates() so the testbed/verification pass can inspect
// exactly what a run WOULD find without touching the table.
export async function findOverlapCandidates(): Promise<OverlapMatchCandidate[]> {
  const legacyRows = await prisma.project.findMany({
    where: { language: "en", status: "PUBLISHED", supersededByDevelopmentId: null },
    select: { id: true, title: true, latitude: true, longitude: true, developerId: true, overlapRejectedDevelopmentIds: true },
  });
  if (!legacyRows.length) return [];

  const [developers, devAccounts, developments] = await Promise.all([
    prisma.developer.findMany({ select: { id: true, translationGroupId: true } }),
    prisma.developerAccount.findMany({ select: { id: true, developerTranslationGroupId: true } }),
    prisma.development.findMany({ where: { slug: { not: null } }, include: { override: true } }),
  ]);
  const devById = new Map(developers.map((d) => [d.id, d]));
  const accountByGroup = new Map(
    devAccounts.filter((a): a is typeof a & { developerTranslationGroupId: string } => !!a.developerTranslationGroupId)
      .map((a) => [a.developerTranslationGroupId, a]),
  );

  const devIndex = developments.map((d) => ({
    id: d.id,
    developerAccountId: d.developerAccountId,
    latitude: d.override?.latitude ?? d.latitude,
    longitude: d.override?.longitude ?? d.longitude,
    normNames: [norm(d.publicName), norm(d.override?.alias)].filter(Boolean),
  }));

  const candidates: OverlapMatchCandidate[] = [];
  for (const p of legacyRows) {
    const legacyNorm = norm(p.title);
    if (!legacyNorm) continue;
    const rejected = Array.isArray(p.overlapRejectedDevelopmentIds) ? (p.overlapRejectedDevelopmentIds as string[]) : [];
    const legacyDev = p.developerId ? devById.get(p.developerId) : null;
    const legacyAccount = legacyDev?.translationGroupId ? accountByGroup.get(legacyDev.translationGroupId) : null;

    for (const d of devIndex) {
      if (rejected.includes(d.id)) continue; // never re-surface a rejected pair
      const exact = d.normNames.includes(legacyNorm);
      const fuzzy = !exact && d.normNames.some((n) => n.length > 4 && (n.includes(legacyNorm) || legacyNorm.includes(n)));
      if (!exact && !fuzzy) continue;

      const sameAccount = !!(legacyAccount && d.developerAccountId && legacyAccount.id === d.developerAccountId);
      let distanceMeters: number | null = null;
      if (p.latitude != null && p.longitude != null && d.latitude != null && d.longitude != null) {
        distanceMeters = haversineMeters(p.latitude, p.longitude, d.latitude, d.longitude);
      }
      const closeBy = distanceMeters != null && distanceMeters < DISTANCE_HIGH_M;

      // Weighting agreed 2026-08-03: exact title alone is Medium; exact
      // title PLUS a corroborating signal (same developer account, or a
      // <50m coordinate match) is High. A pure fuzzy match needs a
      // corroborating signal too, or it's discarded entirely (never
      // persisted) — the one-off sweep's Tier 4 false positives ("ONE"
      // matching "Onero Residences" on a bare substring) were exactly this
      // case with no corroboration.
      let confidence: "High" | "Medium" | "Low" = "Low";
      if (exact && (sameAccount || closeBy)) confidence = "High";
      else if (exact) confidence = "Medium";
      else if (fuzzy && (sameAccount || closeBy)) confidence = "Medium";
      if (confidence === "Low") continue;

      const noteBits = [
        exact ? "exact title match" : "fuzzy title match",
        sameAccount ? "same developer account" : null,
        closeBy ? `${Math.round(distanceMeters as number)}m apart` : null,
      ].filter(Boolean) as string[];

      candidates.push({
        legacyProjectId: p.id,
        developmentId: d.id,
        confidence,
        matchType: exact ? "exact-title" : "fuzzy-title",
        distanceMeters,
        note: noteBits.join(", "),
      });
    }
  }
  return candidates;
}

// Insert only genuinely NEW pairs — a pair that already has an
// OverlapCandidate row (pending, confirmed, or rejected) is left completely
// untouched, preserving its original foundAt and never re-litigating a
// decision already made. The unique(legacyProjectId, developmentId)
// constraint is the actual guarantee; the pre-check here just avoids a
// pointless failed-insert round trip for the common case.
export async function sweepOverlapCandidates(): Promise<{ found: number; inserted: number }> {
  const candidates = await findOverlapCandidates();
  let inserted = 0;
  for (const c of candidates) {
    const existing = await prisma.overlapCandidate.findUnique({
      where: { legacyProjectId_developmentId: { legacyProjectId: c.legacyProjectId, developmentId: c.developmentId } },
    });
    if (existing) continue;
    await prisma.overlapCandidate.create({ data: c });
    inserted++;
  }
  return { found: candidates.length, inserted };
}
