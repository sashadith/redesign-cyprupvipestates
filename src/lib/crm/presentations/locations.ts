import { prisma } from "@/lib/prisma";
import { canonicalPlaceLabels, placeKey } from "@/lib/crm/placeNames";

export type LocationOptions = { districts: string[]; areasByDistrict: Record<string, string[]> };

// District -> Area cascade for the matching panel's location filter (PART 6).
// A development with no district falls back to its town, so nothing gets
// silently excluded from the District list just because a feed left that
// field empty. Spellings of one place collapse into one chip (placeNames.ts);
// the matcher compares the same keys, so the chip still finds every spelling.
// No auth here: callers check the session.
export async function listPresentationLocationOptions(): Promise<LocationOptions> {
  const rows = await prisma.development.findMany({
    where: { publishStatus: { in: ["published", "ready"] } },
    select: { town: true, district: true, area: true, override: { select: { town: true, district: true, area: true } } },
  });
  const places = rows.map((r) => {
    const town = r.override?.town || r.town;
    return { district: r.override?.district || r.district || town || "", area: r.override?.area || r.area || "" };
  });
  const districtLabel = canonicalPlaceLabels(places.map((p) => p.district));
  const areaLabel = canonicalPlaceLabels(places.map((p) => p.area));
  const areasByDistrict: Record<string, Set<string>> = {};
  for (const p of places) {
    const district = districtLabel.get(placeKey(p.district));
    if (!district) continue;
    const set = (areasByDistrict[district] ??= new Set());
    const area = areaLabel.get(placeKey(p.area));
    if (area) set.add(area);
  }
  const districts = Object.keys(areasByDistrict).sort();
  const out: Record<string, string[]> = {};
  for (const d of districts) out[d] = Array.from(areasByDistrict[d]).sort();
  return { districts, areasByDistrict: out };
}
