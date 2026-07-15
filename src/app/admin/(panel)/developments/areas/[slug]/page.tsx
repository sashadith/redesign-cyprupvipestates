import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { aiConfigured } from "@/lib/ai/anthropic";
import { slugOfArea } from "../slug";
import AreaEditor from "../AreaEditor";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[#F3F4F6] text-[#6B7280]",
  ready: "bg-[#FEF3C7] text-[#92400E]",
  published: "bg-[#DCFCE7] text-[#166534]",
  archived: "bg-[#FEE2E2] text-[#991B1B]",
};
const fmtPrice = (n: number | null) => (n == null ? "—" : "€" + n.toLocaleString("en-US"));

export default async function AreaEditPage({ params, searchParams }: { params: { slug: string }; searchParams?: { name?: string; district?: string } }) {
  const slug = params.slug;
  const existing = await prisma.areaDescription.findUnique({ where: { areaSlug: slug } });

  const allDevs = await prisma.development.findMany({
    select: {
      id: true, publicName: true, dev: true, developer: true, publishStatus: true, priceFrom: true,
      area: true, district: true,
      _count: { select: { units: true } },
      override: { select: { area: true, district: true, alias: true } },
    },
    orderBy: { publicName: "asc" },
  });
  const projects = allDevs.filter((d) => slugOfArea(d.override?.area || d.area || "") === slug);

  let name = existing?.areaName || searchParams?.name || "";
  let district = existing?.district || searchParams?.district || "";
  if (!name && projects[0]) {
    name = projects[0].override?.area || projects[0].area || slug;
    district = projects[0].override?.district || projects[0].district || "";
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link href="/admin/developments/areas" className="text-sm text-[#6B7280] hover:text-[#1B4B43]">← Area descriptions</Link>
        <h1 className="text-xl font-semibold text-[#111827] mt-1">{name || slug}</h1>
        <p className="text-sm text-[#6B7280]">{district ? district + " district · " : ""}{projects.length} project{projects.length === 1 ? "" : "s"} in this area</p>
      </div>

      <AreaEditor
        slug={slug}
        name={name || slug}
        district={district}
        initial={{ en: existing?.textEN ?? "", de: existing?.textDE ?? "", pl: existing?.textPL ?? "", ru: existing?.textRU ?? "" }}
        initialStatus={existing?.status ?? "none"}
        aiReady={aiConfigured()}
      />

      {/* projects using this area */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7EB] text-sm font-semibold text-[#111827]">
          Projects using this area <span className="font-normal text-[#9CA3AF]">({projects.length})</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280] text-left">
            <tr>
              <th className="px-5 py-2.5 font-medium">Project</th>
              <th className="px-5 py-2.5 font-medium">Developer</th>
              <th className="px-5 py-2.5 font-medium text-right">From</th>
              <th className="px-5 py-2.5 font-medium text-right">Units</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {projects.map((d) => (
              <tr key={d.id} className="hover:bg-[#F8F9FA]">
                <td className="px-5 py-2.5">
                  <Link href={`/admin/developments/${d.id}`} className="font-medium text-[#111827] hover:text-[#1B4B43] hover:underline">
                    {d.override?.alias || d.publicName}
                  </Link>
                </td>
                <td className="px-5 py-2.5 text-[#6B7280]">{d.developer || d.dev}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{fmtPrice(d.priceFrom)}</td>
                <td className="px-5 py-2.5 text-right tabular-nums">{d._count.units || "—"}</td>
                <td className="px-5 py-2.5">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[d.publishStatus] ?? "bg-[#F3F4F6] text-[#6B7280]"}`}>{d.publishStatus}</span>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-[#9CA3AF]">No projects currently use this area.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
