import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuthorsList() {
  const items = await prisma.author.findMany({ orderBy: [{ language: "asc" }, { name: "asc" }] });
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Authors <span className="text-base font-normal text-[#6B7280]">({items.length})</span></h1>
        <Link href="/admin/content/authors/new" className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-2 hover:bg-[#142E2D]">+ New author</Link>
      </div>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Lang</th>
              <th className="text-left font-medium px-4 py-2.5">Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {items.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-[#6B7280]">No authors.</td></tr>
            ) : items.map((a) => (
              <tr key={a.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/content/authors/${a.id}`} className="text-[#1B4B43] font-medium hover:underline">{a.name}</Link>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{a.language.toUpperCase()}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{a.position ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
