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

// Generic real-estate vocabulary — excluded from word-overlap matching (see
// below) because it appears across dozens of unrelated projects ("Villas",
// "Park", "Residences"...) and would otherwise collide with everything.
// Distinctive words only (brand names, place names within a project name,
// unusual terms) are meaningful signals.
const GENERIC_WORDS = new Set([
  "villas", "villa", "apartments", "apartment", "apts", "apt", "residences", "residence",
  "homes", "home", "park", "gardens", "garden", "view", "views", "beach", "beachfront",
  "coastal", "hills", "hill", "tower", "towers", "suites", "suite", "court", "life",
  "living", "luxury", "estate", "estates", "houses", "house", "project", "projects",
  "development", "complex", "resort", "bay", "sea", "seaside", "premium", "exclusive",
  "modern", "new", "the", "collection", "quarter", "village", "town", "centre", "center",
]);

const distinctiveTokens = (s: string): Set<string> =>
  new Set(s.split(" ").filter((t) => t.length > 3 && !GENERIC_WORDS.has(t)));

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
  matchType: "exact-title" | "fuzzy-title" | "word-overlap-title";
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

    const legacyTokens = distinctiveTokens(legacyNorm);

    for (const d of devIndex) {
      if (rejected.includes(d.id)) continue; // never re-surface a rejected pair
      const exact = d.normNames.includes(legacyNorm);
      const fuzzy = !exact && d.normNames.some((n) => n.length > 4 && (n.includes(legacyNorm) || legacyNorm.includes(n)));
      // Word-overlap (2026-08-07): catches renamed/consolidated projects that
      // share a distinctive word but aren't a substring either way — e.g.
      // "Trees Apartments" / "Trees Villas" vs "Trees Park" (found tracing
      // why that pair, with the SAME developer 218m apart, was invisible to
      // the sweep: neither title contains the other). Deliberately never
      // upgraded to High and never persisted without corroboration — a
      // shared word alone (especially a place name like "Konia" or a common
      // marketing word) is much weaker evidence than a real substring match,
      // GENERIC_WORDS already strips the real-estate vocabulary that would
      // otherwise collide constantly ("Villas", "Park", "Residences"...).
      let sharedWord: string | null = null;
      const wordOverlap =
        !exact && !fuzzy && legacyTokens.size > 0 &&
        d.normNames.some((n) => {
          const hit = Array.from(distinctiveTokens(n)).find((t) => legacyTokens.has(t));
          if (hit) sharedWord = hit;
          return !!hit;
        });
      if (!exact && !fuzzy && !wordOverlap) continue;

      const sameAccount = !!(legacyAccount && d.developerAccountId && legacyAccount.id === d.developerAccountId);
      let distanceMeters: number | null = null;
      if (p.latitude != null && p.longitude != null && d.latitude != null && d.longitude != null) {
        distanceMeters = haversineMeters(p.latitude, p.longitude, d.latitude, d.longitude);
      }
      const closeBy = distanceMeters != null && distanceMeters < DISTANCE_HIGH_M;
      const corroborated = sameAccount || closeBy;

      // Weighting agreed 2026-08-03 (word-overlap tier added 2026-08-07):
      // exact title alone is Medium; exact title PLUS a corroborating signal
      // (same developer account, or a <50m coordinate match) is High. A pure
      // fuzzy match needs a corroborating signal too, or it's discarded
      // entirely (never persisted) — the one-off sweep's Tier 4 false
      // positives ("ONE" matching "Onero Residences" on a bare substring)
      // were exactly this case with no corroboration. Word-overlap is
      // weaker still than fuzzy, so it's held to the same corroboration
      // requirement and capped at Medium even with one.
      let confidence: "High" | "Medium" | "Low" = "Low";
      let matchType: OverlapMatchCandidate["matchType"] = "exact-title";
      if (exact && corroborated) { confidence = "High"; matchType = "exact-title"; }
      else if (exact) { confidence = "Medium"; matchType = "exact-title"; }
      else if (fuzzy && corroborated) { confidence = "Medium"; matchType = "fuzzy-title"; }
      else if (wordOverlap && corroborated) { confidence = "Medium"; matchType = "word-overlap-title"; }
      if (confidence === "Low") continue;

      const noteBits = [
        matchType === "exact-title" ? "exact title match" : matchType === "fuzzy-title" ? "fuzzy title match" : `shared word "${sharedWord}"`,
        sameAccount ? "same developer account" : null,
        closeBy ? `${Math.round(distanceMeters as number)}m apart` : null,
      ].filter(Boolean) as string[];

      candidates.push({
        legacyProjectId: p.id,
        developmentId: d.id,
        confidence,
        matchType,
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

/* ── Development ↔ Development duplicates (2026-09-16) ───────────────────────
   Everything above matches a legacy Sanity Project against a Development. That
   is what this file was built for, and it is why Eden Golf went unnoticed: BBF
   had the same building twice as two DEVELOPMENTS, and nothing here ever
   compared two of those with each other.

   How it happened: /projects/golf-residences was created by hand on
   2026-07-12. On 2026-08-28 BBF's feed adapter first saw the same building as
   project 38 and made a second row, because a Development's identity is its
   feedKey ("manual:<uuid>" vs "bbf:38") and nothing matches on name. Both
   pages then ran live against each other for two and a half weeks.

   Detect and report only — there is deliberately nothing to confirm. For a
   legacy pair, "confirm" writes Project.supersededByDevelopmentId; between two
   Developments no such relation exists in the schema. The resolution is for an
   operator to archive one, which is exactly what happened on 2026-09-16, and
   an archived side drops the pair out of this function. That archive IS the
   acknowledgement, so no candidate table, no reject list and no migration.

   The corroboration rule is deliberately STRICTER than the legacy one above,
   where an exact title alone is already persisted at Medium. Two Developments
   sharing a name is ordinary and usually legitimate: measured 2026-09-16
   across 288 non-archived rows, exactly two names occurred twice — Eden Golf
   (same BBF account, 30 m apart) and Thea (Domenica vs AGG, 5 064 m apart),
   which are two real, different buildings. Requiring a second signal catches
   the first twice over and never mentions the second. Without it, Thea would
   be reported every night forever and would need a dismissal mechanism to
   silence — which is how a nightly alarm becomes wallpaper.

   Word-overlap, the weakest tier above, is not used here. A shared distinctive
   word between two of the same developer's projects is normal naming ("Aktea
   Residences 2/3/4"), not evidence of duplication. */

export type DuplicateDevelopmentPair = {
  aId: string;
  bId: string;
  aName: string;
  bName: string;
  matchType: "exact-title" | "fuzzy-title";
  sameAccount: boolean;
  distanceMeters: number | null;
  note: string;
};

/* The shape the matcher needs, so it can be exercised without a database —
   unlike findOverlapCandidates() above, which queries Prisma itself and can
   therefore only be tested against live data. */
export type DuplicateScanRow = {
  id: string;
  publicName: string;
  publishStatus: string;
  developerAccountId: string | null;
  latitude: number | null;
  longitude: number | null;
  alias?: string | null;
  overrideLatitude?: number | null;
  overrideLongitude?: number | null;
};

/** Pure matching pass over Development rows. No database access, no writes. */
export function findDuplicateDevelopmentPairs(rows: DuplicateScanRow[]): DuplicateDevelopmentPair[] {
  /* An archived Development is a resolved one — see the header. Filtering here
     rather than in the caller keeps the rule true for any caller. */
  const live = rows.filter((r) => r.publishStatus !== "archived");
  const indexed = live.map((r) => ({
    row: r,
    names: Array.from(new Set([norm(r.publicName), norm(r.alias)].filter(Boolean))),
    lat: r.overrideLatitude ?? r.latitude,
    lng: r.overrideLongitude ?? r.longitude,
  }));

  const pairs: DuplicateDevelopmentPair[] = [];
  for (let i = 0; i < indexed.length; i++) {
    for (let j = i + 1; j < indexed.length; j++) {
      const a = indexed[i], b = indexed[j];
      if (!a.names.length || !b.names.length) continue;

      const exact = a.names.some((n) => b.names.includes(n));
      /* Substring either way, with the same >4 floor the legacy matcher uses —
         "Eden Golf" against "Eden Golf Residences". Below that length a
         substring is noise. */
      const fuzzy = !exact && a.names.some((n) => b.names.some((m) =>
        (n.length > 4 && m.includes(n)) || (m.length > 4 && n.includes(m))));
      if (!exact && !fuzzy) continue;

      const sameAccount = !!(a.row.developerAccountId && b.row.developerAccountId
        && a.row.developerAccountId === b.row.developerAccountId);
      const distanceMeters = (a.lat != null && a.lng != null && b.lat != null && b.lng != null)
        ? haversineMeters(a.lat, a.lng, b.lat, b.lng)
        : null;
      const closeBy = distanceMeters != null && distanceMeters < DISTANCE_HIGH_M;

      /* The strict part, and the two tiers are NOT held to the same bar.

         An exact name needs either signal. A fuzzy one needs PROXIMITY, and
         the same developer account is explicitly not enough for it.

         That asymmetry is measured, not tasteful. Run against production on
         2026-09-16, "fuzzy + same account" reported seven pairs and every one
         of them was a legitimate sibling: VENARA / VENARA VIEW / Venara
         Lifestyle, Trees Park / Trees, and three "<name> 2" phase pairs
         (Celestia, Germasogeia View, Avalon Gardens). Naming a phase after its
         predecessor is how this market names things, so on that tier a shared
         account is the norm rather than evidence.
         Distance separates them cleanly: those six sit 72 m to 209 m apart or
         carry no coordinates at all, while the one pair that does look like a
         real overlap — Domenica's "elements" and
         "elements-oxygen-park-of-colours", 19 units against 2 — shares a
         coordinate exactly, 0 m.
         So: fuzzy + proximity reports that one and stays silent on the six.
         Shipping the looser rule would have opened with seven false alarms on
         day one, which is how a nightly check becomes wallpaper — the same
         failure this file already guards against for Thea. */
      const corroborated = exact ? (sameAccount || closeBy) : closeBy;
      if (!corroborated) continue;

      pairs.push({
        aId: a.row.id,
        bId: b.row.id,
        aName: a.row.publicName,
        bName: b.row.publicName,
        matchType: exact ? "exact-title" : "fuzzy-title",
        sameAccount,
        distanceMeters,
        note: [
          exact ? "same name" : "one name contains the other",
          sameAccount ? "same developer account" : null,
          closeBy ? `${Math.round(distanceMeters as number)}m apart` : null,
        ].filter(Boolean).join(", "),
      });
    }
  }
  return pairs;
}

/** Database wrapper around findDuplicateDevelopmentPairs. Reads only. */
export async function duplicateDevelopmentPairs(): Promise<DuplicateDevelopmentPair[]> {
  const rows = await prisma.development.findMany({
    where: { publishStatus: { not: "archived" } },
    select: {
      id: true, publicName: true, publishStatus: true, developerAccountId: true,
      latitude: true, longitude: true,
      override: { select: { alias: true, latitude: true, longitude: true } },
    },
  });
  return findDuplicateDevelopmentPairs(rows.map((r) => ({
    id: r.id,
    publicName: r.publicName,
    publishStatus: r.publishStatus,
    developerAccountId: r.developerAccountId,
    latitude: r.latitude,
    longitude: r.longitude,
    alias: r.override?.alias ?? null,
    overrideLatitude: r.override?.latitude ?? null,
    overrideLongitude: r.override?.longitude ?? null,
  })));
}
