import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PIPELINE = ["NEW", "QUALIFIED", "CONTACTED", "VIEWING_SCHEDULED", "OFFER", "CLOSED", "LOST"];

export default async function Dashboard() {
  const since7 = new Date(); since7.setDate(since7.getDate() - 7);
  const since30 = new Date(); since30.setDate(since30.getDate() - 30);

  const [leadsTotal, leads7d, leads30d, projects, blogs, pages, recent, byStatus, bySource] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: since7 } } }),
    prisma.lead.count({ where: { createdAt: { gte: since30 } } }),
    prisma.project.count(),
    prisma.blog.count(),
    prisma.singlepage.count(),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.lead.groupBy({ by: ["source"], _count: true }),
  ]);

  const statusCount = (s: string) => byStatus.find((r) => r.status === s)?._count ?? 0;
  const won = statusCount("CLOSED");
  const lost = statusCount("LOST");
  const decided = won + lost;
  const conversion = decided > 0 ? Math.round((won / decided) * 100) : null;

  const stats = [
    { label: "Leads (total)", value: leadsTotal },
    { label: "New (7 days)", value: leads7d },
    { label: "New (30 days)", value: leads30d },
    { label: "Won (closed)", value: won },
    { label: "Conversion (won/decided)", value: conversion === null ? "—" : `${conversion}%` },
    { label: "Projects", value: projects },
  ];

  const sources = bySource.map((r) => ({ key: r.source, count: r._count })).sort((a, b) => b.count - a.count);
  const maxSource = Math.max(1, ...sources.map((s) => s.count));

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

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <h2 className="text-sm font-semibold mb-3">Pipeline</h2>
          <ul className="space-y-1.5">
            {PIPELINE.map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <Link href={`/admin/crm?status=${s}`} className="text-[#6B7280] hover:text-[#1B4B43] hover:underline">{s.replace(/_/g, " ")}</Link>
                <span className="font-medium">{statusCount(s)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
          <h2 className="text-sm font-semibold mb-3">Leads by source</h2>
          {sources.length === 0 ? <p className="text-sm text-[#6B7280]">No leads yet.</p> : (
            <ul className="space-y-2">
              {sources.map((s) => (
                <li key={s.key}>
                  <Link href={`/admin/crm?source=${s.key}`} className="flex items-center justify-between text-sm text-[#6B7280] hover:text-[#1B4B43]">
                    <span>{s.key.replace(/_/g, " ")}</span><span className="font-medium">{s.count}</span>
                  </Link>
                  <div className="h-1.5 bg-[#F1F1F1] rounded mt-1"><div className="h-1.5 bg-[#1B4B43] rounded" style={{ width: `${(s.count / maxSource) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
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
