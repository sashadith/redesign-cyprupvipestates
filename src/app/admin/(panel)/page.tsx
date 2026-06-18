import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [leadsTotal, leadsNew, leads7d, projects, blogs, pages, recent] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "NEW" } }),
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.project.count(),
    prisma.blog.count(),
    prisma.singlepage.count(),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const stats = [
    { label: "Leads (total)", value: leadsTotal },
    { label: "New leads", value: leadsNew },
    { label: "Leads (7 days)", value: leads7d },
    { label: "Projects", value: projects },
    { label: "Blog posts", value: blogs },
    { label: "Pages", value: pages },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-[#E5E7EB] p-5">
            <div className="text-3xl font-semibold text-[#1B4B43]">{s.value}</div>
            <div className="text-sm text-[#6B7280] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-[#E5E7EB]">
        <div className="px-5 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent leads</h2>
          <Link href="/admin/crm" className="text-sm text-[#1B4B43] hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#6B7280]">No leads yet.</p>
        ) : (
          <ul className="divide-y divide-[#E5E7EB]">
            {recent.map((l) => (
              <li key={l.id}>
                <Link href={`/admin/crm/${l.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-[#F8F9FA]">
                  <span className="text-sm">{l.firstName} {l.lastName} · <span className="text-[#6B7280]">{l.email}</span></span>
                  <span className="text-xs text-[#6B7280]">{new Date(l.createdAt).toLocaleString("en-GB")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
