import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default async function FeedsPage() {
  const developers = await prisma.developerAccount.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { analyses: true } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#111827]">Developer Feeds</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Discovery tool — analyze what data each developer provides. No import or changes to public projects.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/feeds/compare" className="rounded-md border border-[#E5E7EB] text-sm px-4 py-2 hover:bg-[#F8F9FA]">
            Field comparison →
          </Link>
          <Link href="/admin/feeds/new" className="rounded-md bg-[#1B4B43] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#142E2D]">
            + New developer
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Developer</th>
              <th className="text-left font-medium px-4 py-2.5">Website</th>
              <th className="text-left font-medium px-4 py-2.5">Analyses</th>
              <th className="text-left font-medium px-4 py-2.5">Last analyzed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {developers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#6B7280]">
                  No developers yet. Add one to analyze its feed.
                </td>
              </tr>
            )}
            {developers.map((d) => (
              <tr key={d.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/feeds/${d.id}`} className="text-[#1B4B43] font-medium hover:underline">
                    {d.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">
                  {d.website ? (
                    <a href={d.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {d.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2.5">{d._count.analyses}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{fmtDate(d.analyses[0]?.createdAt ?? null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
