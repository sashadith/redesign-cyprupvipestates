import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DevelopersList() {
  const items = await prisma.developer.findMany({ orderBy: [{ language: "asc" }, { title: "asc" }] });
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Developers <span className="text-base font-normal text-[#6B7280]">({items.length})</span></h1>
        <Link href="/admin/content/developers/new" className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-2 hover:bg-[#142E2D]">+ New developer</Link>
      </div>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Title</th>
              <th className="text-left font-medium px-4 py-2.5">Lang</th>
              <th className="text-left font-medium px-4 py-2.5">Slug</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[#6B7280]">No developers.</td></tr>
            ) : items.map((d) => (
              <tr key={d.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/content/developers/${d.id}`} className="text-[#1B4B43] font-medium hover:underline">{d.title}</Link>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{d.language.toUpperCase()}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">/{d.slug}</td>
                <td className="px-4 py-2.5">
                  {d.deactivatedAt
                    ? <span className="inline-block rounded px-2 py-0.5 text-xs bg-[#FEE2E2] text-[#991B1B]">Inactive</span>
                    : <span className="inline-block rounded px-2 py-0.5 text-xs bg-[#DCFCE7] text-[#166534]">Active</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
