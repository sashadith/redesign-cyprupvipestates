import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computePublishGate, areaSlugOf, type PublishGateCheck } from "@/lib/developmentPublishGate";
import { findLegacyCounterpart } from "@/lib/legacyCounterpart";
import { computeAvailability, availabilityContradiction } from "@/lib/developmentAvailability";
import BatchDeactivateControl from "./BatchDeactivateControl";

export const dynamic = "force-dynamic";

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

type Row = {
  id: string;
  name: string;
  developer: string;
  units: number;
  gate: PublishGateCheck[];
  passCount: number;
  ready: boolean;
  availabilityWarning: string | null;
  counterpart: { title: string; score: number } | null;
};

export default async function PublishingQueuePage({
  searchParams,
}: {
  searchParams?: { developer?: string; ready?: string; counterpart?: string };
}) {
  const developerFilter = searchParams?.developer || "";
  const readyOnly = searchParams?.ready === "1";
  const counterpartOnly = searchParams?.counterpart === "1";

  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [nonPublished, totalCount, publishedCount, approvedAreas, legacyTitleRows, confirmedPairs] = await Promise.all([
    prisma.development.findMany({
      where: { publishStatus: { not: "published" } },
      include: { override: true, _count: { select: { units: true } }, units: { select: { status: true } } },
    }),
    prisma.development.count(),
    prisma.development.count({ where: { publishStatus: "published" } }),
    prisma.areaDescription.findMany({ where: { status: "approved" }, select: { areaSlug: true } }),
    // Titles only, for the counterpart heuristic — a legacy project can have
    // many locale rows with the same title, dedupe isn't worth the round trip.
    prisma.project.findMany({ where: { status: "PUBLISHED" }, select: { title: true } }),
    prisma.project.findMany({
      where: { language: "en", supersededByDevelopmentId: { not: null } },
      select: { id: true, slug: true, title: true, status: true },
    }),
  ]);

  const approvedSlugs = new Set(approvedAreas.map((a) => a.areaSlug));
  const legacyTitles = Array.from(new Set(legacyTitleRows.map((r) => r.title)));

  const allRows: Row[] = nonPublished.map((d) => {
    const ov = d.override;
    const area = ov?.area || d.area || "";
    const district = ov?.district || d.district || "";
    const lat = ov?.latitude ?? d.latitude;
    const lng = ov?.longitude ?? d.longitude;
    const description = ov?.descriptionEN || d.description || "";
    const gallery = arr(ov?.gallery).length ? arr(ov?.gallery) : arr(d.gallery);
    const name = ov?.alias || d.publicName;

    // Override wins — see DevelopmentOverride.stage's schema comment.
    const resolvedStage = ov?.stage || d.stage;
    const gate = computePublishGate({
      description, area, district, lat, lng, stage: resolvedStage,
      hasAreaDescription: area ? approvedSlugs.has(areaSlugOf(area)) : false,
      gallery, mainImage: ov?.mainImage,
    });
    const passCount = gate.filter((g) => g.ok).length;
    const { soldOut, available } = computeAvailability(d.units);

    return {
      id: d.id,
      name,
      developer: d.developer || d.dev,
      units: d._count.units,
      gate,
      availabilityWarning: availabilityContradiction(resolvedStage, d.status, soldOut, available),
      passCount,
      ready: passCount === gate.length,
      counterpart: findLegacyCounterpart(name, legacyTitles),
    };
  });

  const readyCount = allRows.filter((r) => r.ready).length;
  const missingCount = allRows.length - readyCount;

  const developers = Array.from(new Set(allRows.map((r) => r.developer))).sort();

  let rows = allRows;
  if (developerFilter) rows = rows.filter((r) => r.developer === developerFilter);
  if (readyOnly) rows = rows.filter((r) => r.ready);
  if (counterpartOnly) rows = rows.filter((r) => !!r.counterpart);
  rows = [...rows].sort((a, b) => b.passCount - a.passCount || a.name.localeCompare(b.name));

  const qp = (o: Record<string, string>) => {
    const p = new URLSearchParams({
      ...(developerFilter ? { developer: developerFilter } : {}),
      ...(readyOnly ? { ready: "1" } : {}),
      ...(counterpartOnly ? { counterpart: "1" } : {}),
    });
    Object.entries(o).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    return "?" + p.toString();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#111827]">Publishing Queue</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            <span className="font-medium text-[#111827]">{publishedCount}</span> of {totalCount} Developments published ·{" "}
            <span className="font-medium text-[#166534]">{readyCount}</span> ready to publish ·{" "}
            <span className="font-medium text-[#DC2626]">{missingCount}</span> missing data
          </p>
        </div>
        {isAdmin && (
          <BatchDeactivateControl
            pairs={confirmedPairs.map((p) => ({ id: p.id, slug: p.slug, title: p.title, alreadyArchived: p.status === "ARCHIVED" }))}
          />
        )}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={qp({ developer: "" })} className={`rounded-full px-3 py-1 border ${!developerFilter ? "bg-[#1B4B43] text-white border-[#1B4B43]" : "border-[#E5E7EB] text-[#374151] hover:bg-[#F8F9FA]"}`}>
          All developers
        </Link>
        {developers.map((dv) => (
          <Link key={dv} href={qp({ developer: dv })} className={`rounded-full px-3 py-1 border ${developerFilter === dv ? "bg-[#1B4B43] text-white border-[#1B4B43]" : "border-[#E5E7EB] text-[#374151] hover:bg-[#F8F9FA]"}`}>
            {dv}
          </Link>
        ))}
        <span className="w-px h-5 bg-[#E5E7EB] mx-1" />
        <Link href={qp({ ready: readyOnly ? "" : "1" })} className={`rounded-full px-3 py-1 border ${readyOnly ? "bg-[#166534] text-white border-[#166534]" : "border-[#E5E7EB] text-[#374151] hover:bg-[#F8F9FA]"}`}>
          Ready to publish
        </Link>
        <Link href={qp({ counterpart: counterpartOnly ? "" : "1" })} className={`rounded-full px-3 py-1 border ${counterpartOnly ? "bg-[#92400E] text-white border-[#92400E]" : "border-[#E5E7EB] text-[#374151] hover:bg-[#F8F9FA]"}`}>
          Has legacy counterpart
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Developer</th>
              <th className="text-left font-medium px-4 py-2.5">Units</th>
              <th className="text-left font-medium px-4 py-2.5">Missing</th>
              <th className="text-left font-medium px-4 py-2.5">Legacy counterpart</th>
              <th className="text-left font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-[#F8F9FA] align-top">
                <td className="px-4 py-2.5 font-medium text-[#111827]">{r.name}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{r.developer}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{r.units}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {r.availabilityWarning && (
                      <span title={r.availabilityWarning} className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-800">
                        ⚠ availability
                      </span>
                    )}
                    {r.ready ? (
                      <span className="text-emerald-700 font-medium">Ready</span>
                    ) : (
                      r.gate.filter((g) => !g.ok).map((g) => (
                        <span key={g.key} className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-red-50 text-red-700">
                          {g.chip}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {r.counterpart ? (
                    <span className="text-xs text-amber-800 bg-amber-50 rounded px-1.5 py-0.5">{r.counterpart.title}</span>
                  ) : (
                    <span className="text-xs text-[#9CA3AF]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/developments/${r.id}`} className="text-[#1B4B43] font-medium hover:underline text-xs">
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#9CA3AF]">No Developments match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
