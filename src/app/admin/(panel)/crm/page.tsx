import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/app/admin/status-badge";

export const dynamic = "force-dynamic";

export default async function CrmList() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { assignedTo: { select: { name: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">CRM / Leads <span className="text-base font-normal text-[#6B7280]">({leads.length})</span></h1>
        <Link href="/admin/crm/board" className="text-sm text-[#1B4B43] hover:underline">Pipeline view →</Link>
      </div>
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F9FA] text-[#6B7280]">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Contact</th>
              <th className="text-left font-medium px-4 py-2.5">Source</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Assigned</th>
              <th className="text-left font-medium px-4 py-2.5">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {leads.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#6B7280]">No leads yet.</td></tr>
            ) : leads.map((l) => (
              <tr key={l.id} className="hover:bg-[#F8F9FA]">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/crm/${l.id}`} className="text-[#1B4B43] font-medium hover:underline">
                    {l.firstName} {l.lastName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.email}<br />{l.phone}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.source.replace(/_/g, " ")}</td>
                <td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
                <td className="px-4 py-2.5 text-[#6B7280]">{l.assignedTo?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-[#6B7280]">{new Date(l.createdAt).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
