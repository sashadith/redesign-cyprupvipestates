import { prisma } from "@/lib/prisma";

export type LocationOptions = { districts: string[]; areasByDistrict: Record<string, string[]> };

// District -> Area cascade for the matching panel's location filter (PART 6).
// A development with no district falls back to its town, so nothing gets
// silently excluded from the District list just because a feed left that
// field empty. No auth here: callers check the session.
export async function listPresentationLocationOptions(): Promise<LocationOptions> {
  const rows = await prisma.development.findMany({
    where: { publishStatus: { in: ["published", "ready"] } },
    select: { town: true, district: true, area: true, override: { select: { town: true, district: true, area: true } } },
  });
  const areasByDistrict: Record<string, Set<string>> = {};
  for (const r of rows) {
    const town = r.override?.town || r.town;
    const district = r.override?.district || r.district || town;
    const area = r.override?.area || r.area;
    if (!district) continue;
    (areasByDistrict[district] ??= new Set()).add(area || "");
  }
  const districts = Object.keys(areasByDistrict).sort();
  const out: Record<string, string[]> = {};
  for (const d of districts) out[d] = Array.from(areasByDistrict[d]).filter(Boolean).sort();
  return { districts, areasByDistrict: out };
}
