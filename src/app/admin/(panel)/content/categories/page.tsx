import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CategoriesList() {
  const items = await prisma.category.findMany({ orderBy: [{ language: "asc" }, { title: "asc" }] });
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Categories <span className="text-base font-normal text-[#6B7280]">({items.length})</span></h1>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Title</th>
              <th className="text-left font-medium px-4 py-2.5">Lang</th>
              <th className="text-left font-medium px-4 py-2.5">Slug</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {items.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-[#6B7280]">No categories.</td></tr>
            ) : items.map((c) => (
              <tr key={c.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/content/categories/${c.id}`} className="text-[#1B4B43] font-medium hover:underline">{c.title}</Link>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{c.language.toUpperCase()}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">/{c.slug}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
