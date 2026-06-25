import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/app/admin/status-badge";

export const dynamic = "force-dynamic";

export default async function CaseStudiesList() {
  const items = await prisma.caseStudy.findMany({ orderBy: [{ language: "asc" }, { title: "asc" }] });
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Case studies <span className="text-base font-normal text-[#6B7280]">({items.length})</span></h1>
        <Link href="/admin/content/case-studies/new" className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-2 hover:bg-[#142E2D]">+ New case study</Link>
      </div>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Title</th>
              <th className="text-left font-medium px-4 py-2.5">Lang</th>
              <th className="text-left font-medium px-4 py-2.5">Category</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[#6B7280]">No case studies.</td></tr>
            ) : items.map((c) => (
              <tr key={c.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/content/case-studies/${c.id}`} className="text-[#1B4B43] font-medium hover:underline">{c.title}</Link>
                  <div className="text-xs text-[#9CA3AF]">/{c.slug}</div>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{c.language.toUpperCase()}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{c.category ?? "—"}</td>
                <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
