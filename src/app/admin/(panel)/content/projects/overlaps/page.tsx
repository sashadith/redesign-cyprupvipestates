import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { OVERLAP_CANDIDATES } from "./candidates";
import { confirmOverlap, rejectOverlap } from "./actions";
import RevertOverlapControl from "./RevertOverlapControl";

export const dynamic = "force-dynamic";

const CONFIDENCE_STYLE: Record<string, string> = {
  High: "bg-emerald-50 text-emerald-700",
  Medium: "bg-amber-50 text-amber-700",
  "Low-Medium": "bg-amber-50 text-amber-700",
  "Likely false positive": "bg-red-50 text-red-700",
};

export default async function OverlapsAdmin() {
  const legacySlugs = Array.from(new Set(OVERLAP_CANDIDATES.map((c) => c.legacySlug)));
  const devSlugs = Array.from(new Set(OVERLAP_CANDIDATES.map((c) => c.developmentSlug)));

  const [legacyProjects, developments] = await Promise.all([
    prisma.project.findMany({
      where: { language: "en", slug: { in: legacySlugs } },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        supersededByDevelopmentId: true,
        overlapRejectedDevelopmentIds: true,
        redirectTarget: { select: { targetPath: true } },
      },
    }),
    prisma.development.findMany({
      where: { slug: { in: devSlugs } },
      select: { id: true, slug: true, publicName: true, publishStatus: true },
    }),
  ]);
  const legacyBySlug = new Map(legacyProjects.map((p) => [p.slug, p]));
  const devBySlug = new Map(developments.map((d) => [d.slug, d]));

  const rows = OVERLAP_CANDIDATES.map((c) => {
    const legacy = legacyBySlug.get(c.legacySlug);
    const dev = devBySlug.get(c.developmentSlug);
    const rejected = Array.isArray(legacy?.overlapRejectedDevelopmentIds)
      ? (legacy!.overlapRejectedDevelopmentIds as string[])
      : [];
    let state: "confirmed" | "rejected" | "pending" | "missing" = "pending";
    if (!legacy || !dev) state = "missing";
    else if (legacy.supersededByDevelopmentId === dev.id) state = "confirmed";
    else if (rejected.includes(dev.id)) state = "rejected";
    return { ...c, legacy, dev, state };
  });

  const pendingCount = rows.filter((r) => r.state === "pending").length;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Legacy ↔ Development overlaps</h1>
        <p className="text-sm text-[#6B7280] mt-1 max-w-3xl">
          One-time heuristic name-match list from the 2026-07-15 merge audit —
          not a verified identity match. Confirm only pairs you know are the
          same real project; reject the rest. Confirming links the legacy
          project to the Development for the deactivate/redirect flow — it
          does not by itself hide the legacy listing (use the
          Activate/Deactivate toggle on the project itself for that).
        </p>
        <p className="text-sm mt-2">
          <span className="font-medium">{pendingCount}</span> of {rows.length} pending review.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Legacy project</th>
              <th className="text-left font-medium px-4 py-2.5">Proposed Development</th>
              <th className="text-left font-medium px-4 py-2.5">Confidence</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {rows.map((r, i) => (
              <tr key={`${r.legacySlug}-${r.developmentSlug}-${i}`} className="hover:bg-[#F8F9FA] align-top">
                <td className="px-4 py-2.5">
                  {r.legacy ? (
                    <Link href={`/admin/content/projects/${r.legacy.id}`} className="text-[#1B4B43] font-medium hover:underline">
                      {r.legacyTitle}
                    </Link>
                  ) : (
                    <span className="text-red-600">{r.legacyTitle} (not found)</span>
                  )}
                  <div className="text-xs text-[#6B7280]">/{r.legacySlug}</div>
                </td>
                <td className="px-4 py-2.5">
                  {r.dev ? (
                    <Link href={`/admin/developments/${r.dev.id}`} className="text-[#1B4B43] font-medium hover:underline">
                      {r.dev.publicName}
                    </Link>
                  ) : (
                    <span className="text-red-600">{r.developmentName} (not found)</span>
                  )}
                  <div className="text-xs text-[#6B7280]">/{r.developmentSlug}</div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLE[r.confidence]}`}>{r.confidence}</span>
                  {r.note && <div className="text-xs text-[#6B7280] mt-1 max-w-xs">{r.note}</div>}
                </td>
                <td className="px-4 py-2.5">
                  {r.state === "confirmed" && <span className="text-emerald-700 font-medium">Confirmed</span>}
                  {r.state === "rejected" && <span className="text-[#6B7280]">Rejected</span>}
                  {r.state === "pending" && <span className="text-amber-700">Pending</span>}
                  {r.state === "missing" && <span className="text-red-600">Can&apos;t review</span>}
                </td>
                <td className="px-4 py-2.5">
                  {r.state === "pending" && r.legacy && r.dev && (
                    <div className="flex gap-2">
                      <form action={confirmOverlap.bind(null, r.legacy.id, r.dev.id)}>
                        <button type="submit" className="rounded-md bg-[#1B4B43] text-white text-xs px-3 py-1.5 hover:bg-[#142E2D]">
                          Confirm match
                        </button>
                      </form>
                      <form action={rejectOverlap.bind(null, r.legacy.id, r.dev.id)}>
                        <button type="submit" className="rounded-md border border-[#E5E7EB] text-xs px-3 py-1.5 hover:bg-[#F8F9FA]">
                          Reject
                        </button>
                      </form>
                    </div>
                  )}
                  {r.state === "confirmed" && r.legacy && r.dev && (
                    <RevertOverlapControl
                      legacyProjectId={r.legacy.id}
                      developmentId={r.dev.id}
                      legacyArchived={r.legacy.status === "ARCHIVED"}
                      hasRedirect={!!r.legacy.redirectTarget}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#6B7280] mt-4 max-w-3xl">
        5 Developments from the audit had no legacy counterpart at all
        (venus-ridge-villas, prodromi-modern-living, city-gardens,
        kato-paphos-residences, blackpine) and aren&apos;t listed here — there&apos;s
        nothing to link them against.
      </p>
    </div>
  );
}
