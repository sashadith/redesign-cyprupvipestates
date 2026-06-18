import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const LOCALES = ["en", "de", "pl", "ru"];

export default async function ProjectsAdmin({ searchParams }: { searchParams: { lang?: string; q?: string } }) {
  const lang = LOCALES.includes(searchParams.lang ?? "") ? searchParams.lang! : "en";
  const q = (searchParams.q ?? "").trim();
  const projects = await prisma.project.findMany({
    where: { language: lang as any, ...(q ? { title: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: [{ isFeatured: "desc" }, { listingPriority: "desc" }, { title: "asc" }],
    take: 300,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link href="/admin/content/projects/new" className="rounded-md bg-[#1B4B43] text-white text-sm px-4 py-2 hover:bg-[#142E2D]">+ New project</Link>
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1">
          {LOCALES.map((l) => (
            <Link key={l} href={`/admin/content/projects?lang=${l}`}
              className={`rounded-md px-3 py-1.5 text-sm ${l === lang ? "bg-[#1B4B43] text-white" : "bg-white border border-[#E5E7EB] text-[#111827]"}`}>
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
        <form className="flex-1 max-w-xs">
          <input type="hidden" name="lang" value={lang} />
          <input name="q" defaultValue={q} placeholder="Search title…" className="w-full rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm" />
        </form>
        <span className="text-sm text-[#6B7280]">{projects.length} shown</span>
      </div>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Title</th>
              <th className="text-left font-medium px-4 py-2.5">City</th>
              <th className="text-left font-medium px-4 py-2.5">Price</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/content/projects/${p.id}`} className="text-[#1B4B43] font-medium hover:underline">{p.title}</Link>
                  <div className="text-xs text-[#6B7280]">/{p.slug}</div>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{p.city ?? "—"}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{p.price ? `€${p.price.toLocaleString()}` : "—"}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{p.status}</td>
                <td className="px-4 py-2.5 text-xs text-[#6B7280]">{p.isFeatured ? "★ featured " : ""}{p.isSold ? "· sold" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
