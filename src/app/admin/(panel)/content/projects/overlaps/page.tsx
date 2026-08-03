import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { confirmOverlap, rejectOverlap } from "./actions";
import RevertOverlapControl from "./RevertOverlapControl";

export const dynamic = "force-dynamic";

const CONFIDENCE_STYLE: Record<string, string> = {
  High: "bg-emerald-50 text-emerald-700",
  Medium: "bg-amber-50 text-amber-700",
  "Low-Medium": "bg-amber-50 text-amber-700",
  "Likely false positive": "bg-red-50 text-red-700",
};

// Reads OverlapCandidate (2026-08-03 nightly sweep, see src/lib/overlapSweep.ts)
// instead of the frozen candidates.ts array it replaces. Confirm/reject
// itself is untouched — Project.supersededByDevelopmentId /
// overlapRejectedDevelopmentIds stay the single source of truth for that,
// exactly as before; this table only supplies the suggestion list.
export default async function OverlapsAdmin() {
  const candidates = await prisma.overlapCandidate.findMany({ orderBy: { foundAt: "asc" } });
  const legacyIds = Array.from(new Set(candidates.map((c) => c.legacyProjectId)));
  const devIds = Array.from(new Set(candidates.map((c) => c.developmentId)));

  const [legacyProjects, developments] = await Promise.all([
    prisma.project.findMany({
      where: { id: { in: legacyIds } },
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
      where: { id: { in: devIds } },
      select: { id: true, slug: true, publicName: true, publishStatus: true },
    }),
  ]);
  const legacyById = new Map(legacyProjects.map((p) => [p.id, p]));
  const devById = new Map(developments.map((d) => [d.id, d]));

  const rows = candidates.map((c) => {
    const legacy = legacyById.get(c.legacyProjectId);
    const dev = devById.get(c.developmentId);
    const rejected = Array.isArray(legacy?.overlapRejectedDevelopmentIds)
      ? (legacy!.overlapRejectedDevelopmentIds as string[])
      : [];
    let state: "confirmed" | "rejected" | "pending" | "missing" = "pending";
    if (!legacy || !dev) state = "missing";
    else if (legacy.supersededByDevelopmentId === dev.id) state = "confirmed";
    else if (rejected.includes(dev.id)) state = "rejected";
    return {
      legacySlug: legacy?.slug ?? c.legacyProjectId,
      legacyTitle: legacy?.title ?? "(unknown legacy project)",
      developmentSlug: dev?.slug ?? c.developmentId,
      developmentName: dev?.publicName ?? "(unknown development)",
      confidence: c.confidence,
      note: c.note,
      foundAt: c.foundAt,
      legacy, dev, state,
    };
  });

  const pendingCount = rows.filter((r) => r.state === "pending").length;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Legacy ↔ Development overlaps</h1>
        <p className="text-sm text-[#6B7280] mt-1 max-w-3xl">
          Found automatically by the nightly sweep (title + developer +
          coordinates) after each feed sync — not a verified identity match.
          Confirm only pairs you know are the same real project; reject the
          rest. Confirming links the legacy project to the Development for
          the deactivate/redirect flow — it does not by itself hide the
          legacy listing (use the Activate/Deactivate toggle on the project
          itself for that).
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
              <th className="text-left font-medium px-4 py-2.5">Found</th>
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
                <td className="px-4 py-2.5 text-xs text-[#6B7280] whitespace-nowrap">
                  {r.foundAt.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
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
    </div>
  );
}
