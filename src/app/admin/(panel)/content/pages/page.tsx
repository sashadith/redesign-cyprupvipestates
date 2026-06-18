import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const LOCALES = ["en", "de", "pl", "ru"];

export default async function PagesAdmin({ searchParams }: { searchParams: { lang?: string } }) {
  const lang = LOCALES.includes(searchParams.lang ?? "") ? searchParams.lang! : "en";
  const pages = await prisma.singlepage.findMany({ where: { language: lang as any }, orderBy: { slug: "asc" } });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Pages</h1>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1">
          {LOCALES.map((l) => (
            <Link key={l} href={`/admin/content/pages?lang=${l}`}
              className={`rounded-md px-3 py-1.5 text-sm ${l === lang ? "bg-[#1B4B43] text-white" : "bg-white border border-[#E5E7EB]"}`}>
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
        <span className="text-sm text-[#6B7280]">{pages.length} pages</span>
      </div>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Title</th>
              <th className="text-left font-medium px-4 py-2.5">Slug</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {pages.map((p) => (
              <tr key={p.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/content/pages/${p.id}`} className="text-[#1B4B43] font-medium hover:underline">{p.title}</Link>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">/{p.slug}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
